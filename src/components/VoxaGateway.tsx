import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Mail, UserCheck, UserPlus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, isFirebaseConfigured, sendPasswordResetEmail, db, doc, setDoc, getDoc, getDocs, collection, query, where, limit } from '../lib/firebase';
import {
  capturePendingReferralFromUrl,
  getPendingReferralCode,
  setPendingReferralCode,
  clearPendingReferralCode,
  trackReferralClick,
  validateReferralCodeBackend,
  recordReferral
} from '../utils/leagueDb';

interface VoxaGatewayProps {
  onLoginSuccess: (user: any) => void;
}

export const VoxaGateway: React.FC<VoxaGatewayProps> = ({ onLoginSuccess }) => {
  console.log("[VOXA BOOT] VoxaGateway renderizou");
  const [isRegister, setIsRegister] = useState(() => {
    const pathname = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const captured = capturePendingReferralFromUrl();
    if (pathname === '/login' || pathname === '/entrar') {
      return false;
    }
    return (
      pathname === '/register' ||
      pathname === '/cadastro' ||
      search.includes('register=true') ||
      search.includes('source=sussurro') ||
      search.includes('ref=') ||
      search.includes('invite=') ||
      Boolean(captured)
    );
  });
  const [isResetPassword, setIsResetPassword] = useState(false);
  
  // Forms state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('Pessoa'); // 'Pessoa' | 'Criador' | 'Artista' | 'Empresa' | 'Loja' | 'Notícias'
  const [referralCodeInput, setReferralCodeInput] = useState(() => {
    return capturePendingReferralFromUrl() || getPendingReferralCode() || '';
  });
  const [referralLockedFromUrl, setReferralLockedFromUrl] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return Boolean((params.get('ref') || params.get('invite') || params.get('referral') || '').trim());
    } catch {
      return false;
    }
  });
  const [referralValidationStatus, setReferralValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referrerPreviewName, setReferrerPreviewName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Persist referral code temporarily and track CLICKED stage when arriving via referral link
  useEffect(() => {
    const code = (referralCodeInput || getPendingReferralCode() || '').trim().toUpperCase();
    if (code) {
      setPendingReferralCode(code);
      trackReferralClick(code, window.location.pathname.includes('sussurro') ? 'sussurro_referral' : 'referral_link').catch(() => {});
      let cancelled = false;
      setReferralValidationStatus('checking');
      validateReferralCodeBackend(code).then((res) => {
        if (cancelled) return;
        if (res.valid) {
          setReferralValidationStatus('valid');
          setReferrerPreviewName(res.referrerUsername ? `@${res.referrerUsername}` : (res.referrerName || ''));
        } else {
          setReferralValidationStatus('invalid');
          setReferrerPreviewName('');
        }
      }).catch(() => {
        if (!cancelled) setReferralValidationStatus('idle');
      });
      return () => { cancelled = true; };
    } else {
      setReferralValidationStatus('idle');
      setReferrerPreviewName('');
    }
  }, [referralCodeInput]);
  
  // Validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const checkUsernameUniqueness = async (val: string) => {
    const cleanVal = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanVal || cleanVal.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      if (isFirebaseConfigured()) {
        const q = query(
          collection(db, 'users'),
          where('username', '==', cleanVal),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setUsernameStatus('taken');
        } else {
          setUsernameStatus('available');
        }
      } else {
        const existing = JSON.parse(localStorage.getItem('voxa_registered_users') || '[]');
        const found = existing.some((u: any) => (u.username || '').toLowerCase() === cleanVal);
        if (found) {
          setUsernameStatus('taken');
        } else {
          setUsernameStatus('available');
        }
      }
    } catch (e) {
      console.warn("Uniqueness check error:", e);
      setUsernameStatus('available');
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanVal = rawVal.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleanVal);
    
    const timeout = setTimeout(() => {
      checkUsernameUniqueness(cleanVal);
    }, 400);
    return () => clearTimeout(timeout);
  };

  const mapLegacyRole = (legacyRole: string, email?: string): { role: string; isAdmin: boolean } => {
    const r = (legacyRole || '').trim();
    const rLower = r.toLowerCase();
    const emailLower = (email || '').trim().toLowerCase();
    const isAdminEmail = emailLower === 'admin@voxa.com.br' || emailLower === 'admin@lockdownprodutora.com.br' || emailLower === 'lockdownprodutora@gmail.com';
    
    let mappedRole = 'Usuário Comum';
    if (rLower === 'artista' || rLower === 'artista / dj' || rLower === 'cantor') {
      mappedRole = 'Artista / DJ';
    } else if (rLower === 'empresa' || rLower === 'loja') {
      mappedRole = 'Empresa';
    } else {
      mappedRole = 'Usuário Comum';
    }
    return { role: mappedRole, isAdmin: isAdminEmail };
  };

  const saveUserToVoxaRegistry = async (userData: { uid: string; name: string; email: string; username: string; accountType: string; photoURL?: string; profileComplete?: boolean; isNewSignup?: boolean }) => {
    const usersKey = 'voxa_registered_users';
    const existing = JSON.parse(localStorage.getItem(usersKey) || '[]');
    
    const mapped = mapLegacyRole(userData.accountType, userData.email);
    const nowIso = new Date().toISOString();
    const ownReferralCode = userData.username.toUpperCase();
    
    const newUserObj = {
      uid: userData.uid,
      id: userData.uid,
      name: userData.name,
      username: userData.username.toLowerCase(),
      slug: userData.username.toLowerCase(),
      referralCode: ownReferralCode,
      email: userData.email,
      role: mapped.role,
      isAdmin: mapped.isAdmin,
      status: 'Ativo',
      accountType: userData.accountType,
      createdAt: nowIso,
      lastLogin: nowIso,
      photoURL: userData.photoURL || '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      followersList: [],
      followingList: [],
      balance: 0,
      profileComplete: userData.profileComplete !== undefined ? userData.profileComplete : true
    };

    const existsIdx = existing.findIndex((u: any) => u.email === userData.email);
    if (existsIdx >= 0) {
      existing[existsIdx] = { ...existing[existsIdx], lastLogin: nowIso };
    } else {
      existing.push(newUserObj);
    }
    localStorage.setItem(usersKey, JSON.stringify(existing));

    if (isFirebaseConfigured() && userData.uid) {
      const userRef = doc(db, 'users', userData.uid);
      const payloadToSave: Record<string, any> = {
        uid: userData.uid,
        id: userData.uid,
        name: userData.name,
        username: userData.username.toLowerCase(),
        slug: userData.username.toLowerCase(),
        referralCode: ownReferralCode,
        email: userData.email,
        role: mapped.role,
        isAdmin: mapped.isAdmin,
        accountType: userData.accountType,
        status: 'Ativo',
        lastLogin: nowIso,
        photoURL: userData.photoURL || '',
        profileComplete: userData.profileComplete !== undefined ? userData.profileComplete : true
      };
      if (userData.isNewSignup) {
        payloadToSave.createdAt = nowIso;
        payloadToSave.followersCount = 0;
        payloadToSave.followingCount = 0;
        payloadToSave.postsCount = 0;
        payloadToSave.followersList = [];
        payloadToSave.followingList = [];
        payloadToSave.balance = 0;
      }
      await setDoc(userRef, payloadToSave, { merge: true });

      try {
        const { applyDefaultOfficialFollows } = await import('../utils/centralUserDb');
        await applyDefaultOfficialFollows(userData.uid);
      } catch (err) {
        console.warn("Error running default follows on registration:", err);
      }

      const effectiveReferralCode = (referralCodeInput.trim() || getPendingReferralCode() || '').trim().toUpperCase();
      if (userData.isNewSignup && effectiveReferralCode) {
        try {
          const validation = await validateReferralCodeBackend(effectiveReferralCode);
          if (validation.valid && validation.referrerUid !== userData.uid) {
            await setDoc(userRef, {
              referredByCode: validation.referralCode || effectiveReferralCode,
              referredByUid: validation.referrerUid
            }, { merge: true });
            await recordReferral({
              referrerCode: validation.referralCode || effectiveReferralCode,
              referredUserId: userData.uid,
              source: userData.profileComplete === false ? 'google_oauth_signup' : 'signup_gateway',
              qualifyImmediately: userData.profileComplete !== false
            });
            if (userData.profileComplete !== false) {
              clearPendingReferralCode();
            }
          }
        } catch (refErr) {
          console.warn("Referral registration notice:", refErr);
        }
      }
    }

    const sessionObj = {
      uid: userData.uid,
      id: userData.uid,
      name: userData.name,
      email: userData.email,
      username: userData.username.toLowerCase(),
      referralCode: ownReferralCode,
      role: mapped.role,
      isAdmin: mapped.isAdmin,
      accountType: userData.accountType,
      photoURL: userData.photoURL || '',
      profileComplete: userData.profileComplete !== undefined ? userData.profileComplete : true
    };
    localStorage.setItem('voxa_current_user', JSON.stringify(sessionObj));
    return sessionObj;
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    // Preserve referral code before opening Google OAuth popup
    const codeBeforeOAuth = (referralCodeInput.trim() || getPendingReferralCode() || '').trim().toUpperCase();
    if (codeBeforeOAuth) {
      setPendingReferralCode(codeBeforeOAuth);
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      let finalUsername = (user.email?.split('@')[0] || `user_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      let userData;
      if (isFirebaseConfigured()) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const existingData = docSnap.data();
          if (existingData.status === 'Suspenso' || existingData.status === 'Inativo') {
            await auth.signOut();
            setErrorMsg('Esta conta foi desativada pelo Administrador do VOXA.');
            setIsLoading(false);
            return;
          }
          userData = await saveUserToVoxaRegistry({
            uid: user.uid,
            name: existingData.name || user.displayName || 'Membro VOXA',
            email: user.email || '',
            username: existingData.username || finalUsername,
            accountType: existingData.accountType || 'Pessoa',
            photoURL: existingData.photoURL || user.photoURL || undefined,
            profileComplete: existingData.profileComplete !== undefined ? existingData.profileComplete : true,
            isNewSignup: false
          });
        } else {
          const checkQ = query(collection(db, 'users'), where('username', '==', finalUsername), limit(1));
          const checkSnap = await getDocs(checkQ);
          if (!checkSnap.empty) {
            finalUsername = `${finalUsername}_${Math.floor(Math.random() * 1000)}`;
          }

          userData = await saveUserToVoxaRegistry({
            uid: user.uid,
            name: user.displayName || 'Membro VOXA',
            email: user.email || '',
            username: finalUsername,
            accountType: 'Pessoa',
            photoURL: user.photoURL || undefined,
            profileComplete: false,
            isNewSignup: true
          });
        }
      } else {
        userData = await saveUserToVoxaRegistry({
          uid: user.uid,
          name: user.displayName || 'Membro VOXA',
          email: user.email || '',
          username: finalUsername,
          accountType: 'Pessoa',
          photoURL: user.photoURL || undefined,
          profileComplete: false,
          isNewSignup: true
        });
      }

      setSuccessMsg('Conectado ao VOXA com sucesso!');
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess(userData);
      }, 800);
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setErrorMsg('A janela do Google foi fechada antes de concluir o login.');
      } else {
        setErrorMsg(`Erro na autenticação: ${err.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Informe seu e-mail cadastrado.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (isFirebaseConfigured()) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('E-mail de recuperação enviado com sucesso!');
      } else {
        setSuccessMsg('Simulação: E-mail de recuperação enviado!');
      }
      setTimeout(() => {
        setIsLoading(false);
        setIsResetPassword(false);
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      setErrorMsg(`Erro: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    if (isRegister) {
      if (!name.trim()) {
        setErrorMsg('Nome é obrigatório.');
        setIsLoading(false);
        return;
      }
      if (!username.trim() || username.length < 3) {
        setErrorMsg('Escolha um username de pelo menos 3 caracteres.');
        setIsLoading(false);
        return;
      }
      if (usernameStatus === 'taken') {
        setErrorMsg('Este @username já está em uso.');
        setIsLoading(false);
        return;
      }

      try {
        if (isFirebaseConfigured()) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const userData = await saveUserToVoxaRegistry({
            uid: userCredential.user.uid,
            name,
            username,
            email,
            accountType,
            isNewSignup: true
          });
          setSuccessMsg('Sua conta VOXA foi criada! Entrando...');
          setTimeout(() => {
            setIsLoading(false);
            onLoginSuccess(userData);
          }, 800);
        } else {
          const userData = await saveUserToVoxaRegistry({
            uid: `voxa-uid-${Date.now()}`,
            name,
            username,
            email,
            accountType,
            isNewSignup: true
          });
          setSuccessMsg('Sua conta VOXA foi criada! Entrando...');
          setTimeout(() => {
            setIsLoading(false);
            onLoginSuccess(userData);
          }, 800);
        }
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setErrorMsg('Este e-mail já possui cadastro.');
        } else if (err.code === 'auth/weak-password') {
          setErrorMsg('A senha deve conter pelo menos 6 caracteres.');
        } else {
          setErrorMsg(`Erro: ${err.message}`);
        }
        setIsLoading(false);
      }
    } else {
      try {
        if (isFirebaseConfigured()) {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const docRef = doc(db, 'users', userCredential.user.uid);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            await auth.signOut();
            setErrorMsg('Perfil não encontrado no VOXA.');
            setIsLoading(false);
            return;
          }

          const existingData = docSnap.data();
          if (existingData.status === 'Suspenso' || existingData.status === 'Inativo') {
            await auth.signOut();
            setErrorMsg('Esta conta foi desativada pela moderação.');
            setIsLoading(false);
            return;
          }

          const userData = await saveUserToVoxaRegistry({
            uid: userCredential.user.uid,
            name: existingData.name || 'Membro VOXA',
            email: userCredential.user.email || email,
            username: existingData.username || existingData.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user',
            accountType: existingData.accountType || 'Pessoa',
            photoURL: existingData.photoURL || undefined
          });

          setSuccessMsg('Conectado ao VOXA!');
          setTimeout(() => {
            setIsLoading(false);
            onLoginSuccess(userData);
          }, 800);
        } else {
          const existing = JSON.parse(localStorage.getItem('voxa_registered_users') || '[]');
          const found = existing.find((u: any) => u.email === email);
          if (found) {
            const sessionObj = {
              uid: found.uid,
              name: found.name,
              email: found.email,
              username: found.username,
              role: found.role,
              isAdmin: found.isAdmin,
              accountType: found.accountType,
              photoURL: found.photoURL
            };
            localStorage.setItem('voxa_current_user', JSON.stringify(sessionObj));
            setSuccessMsg('Bem-vindo ao VOXA!');
            setTimeout(() => {
              setIsLoading(false);
              onLoginSuccess(sessionObj);
            }, 800);
          } else {
            if (email === 'admin@voxa.com.br' || email === 'admin@lockdownprodutora.com.br' || email === 'lockdownprodutora@gmail.com') {
              const adminUser = await saveUserToVoxaRegistry({
                uid: 'voxa-admin',
                name: 'VOXA Admin',
                email: email,
                username: 'admin',
                accountType: 'Pessoa'
              });
              setSuccessMsg('Painel Administrativo Conectado!');
              setTimeout(() => {
                setIsLoading(false);
                onLoginSuccess(adminUser);
              }, 800);
            } else {
              setErrorMsg('E-mail ou senha incorretos.');
              setIsLoading(false);
            }
          }
        }
      } catch (err: any) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setErrorMsg('E-mail ou senha incorretos.');
        } else {
          setErrorMsg(`Erro no login: ${err.message}`);
        }
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 md:p-8 font-sans text-white relative overflow-hidden">
      
      <div className="w-full max-w-5xl bg-[#12111d] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 relative z-10 backdrop-blur-xl">
        
        {/* Left column: Epic branding visual showcase */}
        <div className="lg:col-span-6 bg-black relative flex flex-col justify-between p-8 md:p-12 overflow-hidden border-r border-white/10 text-left">
          
          <div className="relative z-10 flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black tracking-tight text-black font-orbitron shadow-lg shadow-white/10">
              V
            </div>
            <span className="font-orbitron font-extrabold tracking-widest text-lg text-white">VOXA</span>
          </div>

          <div className="relative z-10 space-y-4 my-auto pt-24 pb-8">
            <h1 className="font-orbitron font-black text-4xl md:text-5xl leading-tight text-white tracking-tight uppercase">
              VOXA
            </h1>
            <h2 className="font-orbitron font-extrabold text-xl text-white tracking-wide">
              Uma nova dimensão social.
            </h2>
            <p className="text-gray-400 text-xs font-sans max-w-md leading-relaxed">
              Uma nova dimensão social. Uma rede social futurista e ecossistema digital completo.
            </p>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-6 flex items-center gap-6 text-[10px] text-gray-500 uppercase tracking-widest">
            <div>
              <span className="font-bold text-white block text-sm font-mono tracking-tight">2026</span>
              <span>Next Gen Social</span>
            </div>
            <span aria-hidden="true" className="text-white/20">|</span>
            <div>
              <span className="font-bold text-white block text-sm font-mono tracking-tight">100% SECURE</span>
              <span>Cloud Vault</span>
            </div>
          </div>
        </div>

        {/* Right column: Action form card */}
        <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-center space-y-6 text-left">
          <div className="space-y-1">
            <span className="text-[#FF0033] font-orbitron text-[9px] tracking-widest block font-black uppercase">VOXA ECOSSISTEMA</span>
            <h2 className="font-orbitron font-black text-2xl text-white uppercase tracking-wider">
              {isResetPassword ? 'Recuperação de Senha' : isRegister ? 'Criar Conta na VOXA' : 'Entrar'}
            </h2>
            <p className="text-xs text-gray-400">
              {isResetPassword ? 'Enviaremos as instruções de recuperação.' : isRegister ? 'Cadastre seu perfil único para receber sussurros e participar.' : 'Acesse sua conta para entrar em uma nova dimensão social.'}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-3.5 rounded-xl text-xs font-orbitron flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs font-orbitron flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={isResetPassword ? handleForgotPassword : handleSubmit} className="space-y-4">
            
            {isRegister && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Nome Completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Pedro Santos"
                    className="w-full bg-[#1b1928] border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:border-[#FF0033] focus:outline-none transition-all placeholder:text-gray-600 font-sans"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Username Único (@)</label>
                    <span className="text-[10px]">
                      {usernameStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />}
                      {usernameStatus === 'available' && <span className="text-emerald-400 font-black font-orbitron text-[9px] uppercase tracking-widest">Disponível</span>}
                      {usernameStatus === 'taken' && <span className="text-red-500 font-black font-orbitron text-[9px] uppercase tracking-widest">Indisponível</span>}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-xs text-gray-500 font-bold">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={handleUsernameChange}
                      placeholder="usuario"
                      className={`w-full bg-[#1b1928] border rounded-2xl pl-9 pr-4 py-3.5 text-xs text-white focus:outline-none transition-all placeholder:text-gray-600 font-sans ${
                        usernameStatus === 'available' ? 'border-emerald-500/50 focus:border-emerald-500' :
                        usernameStatus === 'taken' ? 'border-red-500/50 focus:border-red-500' :
                        'border-white/10 focus:border-[#FF0033]'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Tipo de Perfil</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full bg-[#1b1928] border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white font-orbitron font-bold focus:border-[#FF0033] focus:outline-none cursor-pointer"
                  >
                    <option value="Pessoa">Pessoa / Usuário Comum</option>
                    <option value="Criador">Criador de Conteúdo</option>
                    <option value="Artista">Artista / DJ / Músico</option>
                    <option value="Empresa">Empresa / Negócio PJ</option>
                    <option value="Loja">Vendedor / Loja Store</option>
                    <option value="Notícias">Portal de Notícias</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">
                      Código de indicação
                    </label>
                    <span className="text-[10px]">
                      {referralValidationStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />}
                      {referralValidationStatus === 'valid' && (
                        <span className="text-emerald-400 font-black font-orbitron text-[9px] uppercase tracking-widest">
                          Código válido {referrerPreviewName ? `(${referrerPreviewName})` : ''}
                        </span>
                      )}
                      {referralValidationStatus === 'invalid' && referralCodeInput.trim().length > 0 && (
                        <span className="text-amber-400 font-black font-orbitron text-[9px] uppercase tracking-widest">
                          Código não encontrado
                        </span>
                      )}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={referralCodeInput}
                    readOnly={referralLockedFromUrl && referralValidationStatus === 'valid'}
                    onChange={(e) => {
                      const nextCode = e.target.value.toUpperCase().replace(/[^A-Z0-9_@-]/g, '');
                      setReferralCodeInput(nextCode);
                      if (nextCode) {
                        setPendingReferralCode(nextCode);
                      } else {
                        clearPendingReferralCode();
                      }
                    }}
                    placeholder="Ex: ABC123"
                    className={`w-full bg-[#1b1928] border rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none transition-all placeholder:text-gray-600 font-mono uppercase ${
                      referralValidationStatus === 'valid'
                        ? 'border-emerald-500/50 focus:border-emerald-500'
                        : 'border-white/10 focus:border-[#FF0033]'
                    }`}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@voxa.com.br"
                className="w-full bg-[#1b1928] border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:border-[#FF0033] focus:outline-none transition-all placeholder:text-gray-600 font-sans"
                required
              />
            </div>

            {!isResetPassword && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Senha</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => setIsResetPassword(true)}
                      className="text-[10px] text-gray-500 hover:text-white transition-colors cursor-pointer font-orbitron uppercase tracking-wider"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  className="w-full bg-[#1b1928] border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:border-[#FF0033] focus:outline-none transition-all placeholder:text-gray-600 font-sans"
                  required
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || (isRegister && usernameStatus === 'taken')}
                className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black py-4 px-6 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-red-600/10 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
              >
                {isLoading ? (
                  <span className="animate-pulse">PROCESSANDO...</span>
                ) : isResetPassword ? (
                  <span>SOLICITAR RECUPERAÇÃO</span>
                ) : isRegister ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Cadastrar Conta</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {!isResetPassword && (
            <div className="space-y-4 w-full flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-center text-[10px] text-gray-500 font-orbitron uppercase tracking-widest font-bold">
                <div className="flex-1 border-t border-white/10"></div>
                <span className="px-3 text-center">ou</span>
                <div className="flex-1 border-t border-white/10"></div>
              </div>

              <div className="w-full flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full mx-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-orbitron font-black py-4 px-6 rounded-2xl text-xs flex items-center justify-center text-center transition-all cursor-pointer uppercase tracking-widest shadow-md hover:scale-[1.01]"
                >
                  <span className="inline-flex items-center justify-center gap-3 mx-auto">
                    <svg className="w-4 h-4 shrink-0 block" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.23 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.39-1.49-.39-2.24s.14-1.52.39-2.24V6.6H1.18C.43 8.12 0 9.8 0 12s.43 3.88 1.18 5.4l4.09-3.16z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.68 1.18 6.6l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
                    </svg>
                    <span className="leading-none text-center">Continuar com Google</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/5 space-y-4">
            {isResetPassword ? (
              <div className="text-center">
                <button
                  onClick={() => setIsResetPassword(false)}
                  className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer font-orbitron uppercase tracking-wider"
                >
                  ← Voltar ao login
                </button>
              </div>
            ) : isRegister ? (
              <div className="text-center space-y-3">
                <span className="block text-[11px] text-gray-400 font-sans">Já possui uma conta?</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                    const preservedRef = (referralCodeInput || getPendingReferralCode() || '').trim();
                    if (preservedRef) setPendingReferralCode(preservedRef);
                    const suffix = preservedRef ? `?ref=${encodeURIComponent(preservedRef)}` : window.location.search;
                    window.history.replaceState(null, '', `/login${suffix || ''}`);
                  }}
                  className="w-full bg-[#1b1928] hover:bg-[#252237] border border-white/10 text-white font-orbitron font-black py-4 px-6 rounded-2xl text-xs tracking-widest uppercase transition-all cursor-pointer hover:scale-[1.01]"
                >
                  Entrar
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <span className="block text-[11px] text-gray-400 font-sans">Ainda não tem uma conta?</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                    const preservedRef = (referralCodeInput || getPendingReferralCode() || '').trim();
                    if (preservedRef && !referralCodeInput) {
                      setReferralCodeInput(preservedRef);
                    }
                    const suffix = preservedRef ? `?ref=${encodeURIComponent(preservedRef)}` : window.location.search;
                    window.history.replaceState(null, '', `/register${suffix || ''}`);
                  }}
                  className="w-full bg-white hover:bg-neutral-200 text-black font-orbitron font-black py-4 px-6 rounded-2xl text-xs tracking-widest uppercase transition-all cursor-pointer hover:scale-[1.01] shadow-lg shadow-white/5"
                >
                  Criar conta na VOXA
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-gray-600 space-x-4 pointer-events-auto">
        <a href="#terms" onClick={() => alert("Termos de Uso do VOXA...")} className="hover:text-gray-400 transition-colors">Termos de Uso</a>
        <span>·</span>
        <a href="#privacy" onClick={() => alert("Diretrizes de Privacidade do VOXA...")} className="hover:text-gray-400 transition-colors">Privacidade</a>
        <span>·</span>
        <span className="font-orbitron font-bold">VOXA © 2026</span>
      </div>
    </div>
  );
};
