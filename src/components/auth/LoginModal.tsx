import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, Mail, X, ArrowRight, UserCheck, UserPlus, CheckCircle2 } from 'lucide-react';
import { getGlobalCompanyLogo, getGlobalCompanyName, isRealLogo } from '../../utils/company';
import { fetchCompanySettings } from '../../utils/storeDb';
import { auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, isFirebaseConfigured, signInAnonymously, sendPasswordResetEmail, db, doc, setDoc, getDoc } from '../../lib/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; email: string; role: string }) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountRole, setAccountRole] = useState('Usuário Comum');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [logoUrl, setLogoUrl] = useState(getGlobalCompanyLogo());
  const [companyName, setCompanyName] = useState(getGlobalCompanyName());

  React.useEffect(() => {
    if (!isOpen) return;
    const loadSettings = async () => {
      try {
        const settings = await fetchCompanySettings();
        if (settings) {
          setLogoUrl(settings.logoUrl);
          setCompanyName(settings.tradeName || settings.companyName || 'VOXA');
        }
      } catch (err) {
        console.error("Failed to fetch settings in login modal:", err);
      }
    };
    loadSettings();

    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.settings) {
        setLogoUrl(detail.settings.logoUrl || '');
        setCompanyName(detail.settings.tradeName || detail.settings.companyName || 'VOXA');
      }
    };
    window.addEventListener('company_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('company_settings_updated', handleSettingsUpdated);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const mapLegacyRole = (legacyRole: string, email?: string): { role: string; isAdmin: boolean } => {
    const r = (legacyRole || '').trim();
    const rLower = r.toLowerCase();
    const emailLower = (email || '').trim().toLowerCase();
    const isAdminEmail = emailLower === 'lockdownprodutora@gmail.com' || emailLower === 'admin@lockdownprodutora.com.br';
    
    let mappedRole = 'Usuário Comum';
    if (rLower === 'artista' || rLower === 'dj' || rLower === 'artista / dj' || rLower === 'artista/dj' || rLower === 'produtor' || rLower === 'produtor musical') {
      mappedRole = 'Artista / DJ';
    } else if (rLower === 'cantor' || rLower === 'mc' || rLower === 'mc / cantor' || rLower === 'mc/cantor') {
      mappedRole = 'Cantor';
    } else if (rLower === 'produtora') {
      mappedRole = 'Produtora';
    } else if (rLower === 'empresa' || rLower === 'empresário' || rLower === 'vendedor' || rLower === 'seller') {
      mappedRole = 'Empresa';
    } else if (rLower === 'usuário' || rLower === 'usuario' || rLower === 'user' || rLower === 'usuário comum') {
      mappedRole = 'Usuário Comum';
    } else {
      const officialTypes = ['Usuário Comum', 'Artista / DJ', 'Cantor', 'Produtora', 'Empresa'];
      const found = officialTypes.find(t => t.toLowerCase() === rLower);
      if (found) {
        mappedRole = found;
      }
    }

    const isAdmin = isAdminEmail || rLower === 'admin' || rLower === 'administrador';
    return { role: mappedRole, isAdmin };
  };

  const saveUserToRegistry = (userData: { uid?: string; name: string; email: string; role: string; photoURL?: string; mustChangePassword?: boolean }) => {
    const usersKey = 'lockdown_registered_users';
    const existing = JSON.parse(localStorage.getItem(usersKey) || '[]');
    const existsIdx = existing.findIndex((u: any) => u.email === userData.email);

    const uid = userData.uid || `user-${Date.now()}`;
    const mapped = mapLegacyRole(userData.role, userData.email);
    const finalRole = mapped.role;
    const finalIsAdmin = mapped.isAdmin;

    let fullUser = {
      uid: uid,
      id: uid,
      name: userData.name,
      artisticName: userData.name,
      email: userData.email,
      role: finalRole,
      isAdmin: finalIsAdmin,
      status: 'Ativo',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      lastLogin: 'Agora mesmo',
      photoURL: userData.photoURL || '',
      purchases: 0,
      tickets: 0,
      musics: 0,
      productsCount: 0
    };

    if (existsIdx >= 0) {
      existing[existsIdx] = {
        ...existing[existsIdx],
        lastLogin: 'Agora mesmo',
        name: userData.name || existing[existsIdx].name,
        role: finalRole,
        isAdmin: finalIsAdmin
      };
      fullUser = existing[existsIdx];
    } else {
      existing.push(fullUser);
    }

    localStorage.setItem(usersKey, JSON.stringify(existing));

    // Save to Firestore asynchronously
    if (isFirebaseConfigured() && userData.uid) {
      import("firebase/firestore").then(({ doc, setDoc }) => {
        import("../../lib/firebase").then(({ db }) => {
          const userRef = doc(db, 'users', userData.uid!);
          setDoc(userRef, {
            uid: userData.uid,
            name: fullUser.name,
            email: fullUser.email,
            role: fullUser.role,
            isAdmin: fullUser.isAdmin === true,
            status: fullUser.status,
            createdAt: fullUser.createdAt,
            lastLogin: new Date().toLocaleDateString('pt-BR'),
            photoURL: fullUser.photoURL
          }, { merge: true }).catch(err => console.warn("Failed to setDoc on users in login:", err));
        });
      }).catch(err => console.warn("Failed to load firebase/firestore:", err));
    }

    localStorage.setItem('voxa_current_user', JSON.stringify({
      uid: fullUser.uid,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      isAdmin: fullUser.isAdmin === true,
      photoURL: fullUser.photoURL,
      mustChangePassword: userData.mustChangePassword === true
    }));

    return {
      uid: fullUser.uid,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      isAdmin: fullUser.isAdmin === true,
      photoURL: fullUser.photoURL,
      mustChangePassword: userData.mustChangePassword === true
    };
  };

  const saveUserToRegistryAsync = async (userData: { uid: string; name: string; email: string; role: string; photoURL?: string }) => {
    const usersKey = 'lockdown_registered_users';
    const existing = JSON.parse(localStorage.getItem(usersKey) || '[]');
    const existsIdx = existing.findIndex((u: any) => u.email === userData.email);

    const uid = userData.uid;
    const mapped = mapLegacyRole(userData.role, userData.email);
    const finalRole = mapped.role;
    const finalIsAdmin = mapped.isAdmin;

    let fullUser = {
      uid: uid,
      id: uid,
      name: userData.name,
      artisticName: userData.name,
      email: userData.email,
      role: finalRole,
      isAdmin: finalIsAdmin,
      status: 'Ativo',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      lastLogin: new Date().toLocaleDateString('pt-BR'),
      photoURL: userData.photoURL || '',
      purchases: 0,
      tickets: 0,
      musics: 0,
      productsCount: 0
    };

    if (existsIdx >= 0) {
      existing[existsIdx] = {
        ...existing[existsIdx],
        lastLogin: new Date().toLocaleDateString('pt-BR'),
        name: userData.name || existing[existsIdx].name,
        role: finalRole,
        isAdmin: finalIsAdmin
      };
      fullUser = existing[existsIdx];
    } else {
      existing.push(fullUser);
    }

    localStorage.setItem(usersKey, JSON.stringify(existing));

    // Save to Firestore synchronously
    if (isFirebaseConfigured() && uid) {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid: uid,
        name: fullUser.name,
        email: fullUser.email,
        role: fullUser.role,
        isAdmin: fullUser.isAdmin === true,
        status: fullUser.status,
        createdAt: fullUser.createdAt,
        lastLogin: new Date().toLocaleDateString('pt-BR'),
        photoURL: fullUser.photoURL
      }, { merge: true });
    }

    localStorage.setItem('voxa_current_user', JSON.stringify({
      uid: fullUser.uid,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      isAdmin: fullUser.isAdmin === true,
      photoURL: fullUser.photoURL
    }));

    return {
      uid: fullUser.uid,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      isAdmin: fullUser.isAdmin === true,
      photoURL: fullUser.photoURL
    };
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      let userData;
      if (isFirebaseConfigured()) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const existingData = docSnap.data();
          const statusLower = (existingData.status || '').toLowerCase();
          const accountStatusLower = (existingData.accountStatus || '').toLowerCase();
          
          if (
            statusLower === 'suspenso' || 
            statusLower === 'inativo' || 
            statusLower === 'bloqueado' || 
            statusLower === 'blocked' ||
            accountStatusLower === 'bloqueado'
          ) {
            await auth.signOut();
            setErrorMsg('Esta conta foi suspensa ou desativada pelo Administrador. Para mais informações, entre em contato com o suporte.');
            setIsLoading(false);
            return;
          }

          userData = saveUserToRegistry({
            uid: user.uid,
            name: existingData.name || user.displayName || 'Usuário Google',
            email: user.email || 'usuario@google.com',
            role: existingData.role || 'Usuário Comum',
            photoURL: existingData.photoURL || user.photoURL || undefined
          });
        } else {
          // If profile does not exist in Firestore, this is a Google registration.
          // Create the central profile synchronously (atomic signup) with Active status
          userData = await saveUserToRegistryAsync({
            uid: user.uid,
            name: user.displayName || 'Usuário Google',
            email: user.email || 'usuario@google.com',
            role: 'Usuário Comum',
            photoURL: user.photoURL || undefined
          });
        }
      } else {
        userData = saveUserToRegistry({
          uid: user.uid,
          name: user.displayName || 'Usuário Google',
          email: user.email || 'usuario@google.com',
          role: 'Usuário Comum',
          photoURL: user.photoURL || undefined
        });
      }

      setSuccessMsg('Login com Google realizado com sucesso!');
      setTimeout(() => {
        setIsLoading(false);
        setSuccessMsg('');
        onLoginSuccess(userData);
      }, 700);
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setErrorMsg('A janela de login com o Google foi fechada antes de concluir o processo.');
      } else {
        setErrorMsg(`Erro no login com Google: ${err.message || 'Provedor indisponível ou popup bloqueado.'}`);
      }
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Por favor, informe seu e-mail para a recuperação.');
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
        setSuccessMsg('Simulação: E-mail de recuperação enviado com sucesso!');
      }
      setTimeout(() => {
        setIsLoading(false);
        setIsResetPassword(false);
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      setErrorMsg(`Erro ao enviar e-mail de recuperação: ${err.message || 'Verifique as informações'}`);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    const usersKey = 'lockdown_registered_users';
    const existingUsers = JSON.parse(localStorage.getItem(usersKey) || '[]');

    if (isFirebaseConfigured()) {
      try {
        if (isRegister) {
          if (!name.trim()) {
            setErrorMsg('Por favor, informe seu nome.');
            setIsLoading(false);
            return;
          }
          if (!email.trim() || !password.trim()) {
            setErrorMsg('Informe e-mail e senha válidos.');
            setIsLoading(false);
            return;
          }

          // Real Firebase Sign Up
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const userData = await saveUserToRegistryAsync({
            uid: userCredential.user.uid,
            name,
            email,
            role: accountRole,
            photoURL: userCredential.user.photoURL || undefined
          });

          setSuccessMsg('Cadastro realizado no Cloud com sucesso! Entrando...');
          setTimeout(() => {
            setIsLoading(false);
            setSuccessMsg('');
            onLoginSuccess(userData);
          }, 800);
        } else {
          // Real Firebase Sign In
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userEmail = userCredential.user.email || email;
            
            // Check if profile exists before logging in
            const docRef = doc(db, 'users', userCredential.user.uid);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
              await auth.signOut();
              setErrorMsg('Seu cadastro no VOXA não foi encontrado. Faça seu cadastro novamente ou entre em contato com o suporte.');
              setIsLoading(false);
              return;
            }
            
            const existingData = docSnap.data();
            const statusLower = (existingData.status || '').toLowerCase();
            const accountStatusLower = (existingData.accountStatus || '').toLowerCase();
            
            if (
              statusLower === 'suspenso' || 
              statusLower === 'inativo' || 
              statusLower === 'bloqueado' || 
              statusLower === 'blocked' ||
              accountStatusLower === 'bloqueado'
            ) {
              await auth.signOut();
              setErrorMsg('Esta conta foi suspensa ou desativada pelo Administrador. Para mais informações, entre em contato com o suporte.');
              setIsLoading(false);
              return;
            }

            const userData = saveUserToRegistry({
              uid: userCredential.user.uid,
              name: existingData.name || userCredential.user.displayName || 'Membro VOXA',
              email: userEmail,
              role: existingData.role || 'Usuário Comum',
              photoURL: existingData.photoURL || userCredential.user.photoURL || undefined,
              mustChangePassword: existingData.mustChangePassword === true
            });

            setSuccessMsg('Login efetuado no Cloud com sucesso!');
            setTimeout(() => {
              setIsLoading(false);
              setSuccessMsg('');
              onLoginSuccess(userData);
            }, 800);
          } catch (signInErr: any) {
            // Tratar mensagem de erro padrão ou provedor desativado
            if (signInErr.code === 'auth/operation-not-allowed') {
              setErrorMsg('Erro: O método de login por E-mail/Senha está desativado no Console do Firebase. Ative "Email/Password" em Firebase Auth para autorizar acessos.');
              setIsLoading(false);
            } else if (signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential') {
              setErrorMsg('E-mail ou senha incorretos. Verifique suas credenciais.');
              setIsLoading(false);
            } else if (signInErr.code === 'auth/user-not-found') {
              setErrorMsg('E-mail não encontrado. Crie uma conta abaixo.');
              setIsLoading(false);
            } else {
              setErrorMsg(`Erro no login Cloud: ${signInErr.message || 'Credenciais inválidas'}`);
              setIsLoading(false);
            }
          }
        }
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setErrorMsg('Este e-mail já está em uso por outro usuário.');
        } else if (err.code === 'auth/weak-password') {
          setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
        } else {
          setErrorMsg(`Erro no cadastro Cloud: ${err.message || 'Verifique as informações'}`);
        }
        setIsLoading(false);
      }
    } else {
      // Fallback local caso offline / sem Firebase real
      setTimeout(() => {
        setIsLoading(false);

        if (isRegister) {
          if (!name.trim()) {
            setErrorMsg('Por favor, informe seu nome.');
            return;
          }
          if (!email.trim() || !password.trim()) {
            setErrorMsg('Informe e-mail e senha válidos.');
            return;
          }

          const userExists = existingUsers.find((u: any) => u.email === email);
          if (userExists) {
            setErrorMsg('Este e-mail já está cadastrado. Faça login.');
            setIsRegister(false);
            return;
          }

          const userData = saveUserToRegistry({
            name,
            email,
            role: accountRole
          });

          setSuccessMsg('Cadastro realizado com sucesso! Entrando...');
          setTimeout(() => {
            setSuccessMsg('');
            onLoginSuccess(userData);
          }, 800);
        } else {
          // Login check local
          if (email === 'lockdownprodutora@gmail.com' || email === 'admin@lockdownprodutora.com.br') {
            const adminData = saveUserToRegistry({
              name: 'Chefe Kronos',
              email: email,
              role: 'Administrador'
            });
            setSuccessMsg('Login efetuado com sucesso!');
            setTimeout(() => {
              setSuccessMsg('');
              onLoginSuccess(adminData);
            }, 800);
            return;
          }

          const found = existingUsers.find((u: any) => u.email === email);
          if (found) {
            const userData = {
              name: found.name,
              email: found.email,
              role: found.role === 'Administrador' ? 'admin' : found.role
            };
            found.lastLogin = 'Agora mesmo';
            localStorage.setItem(usersKey, JSON.stringify(existingUsers));
            localStorage.setItem('voxa_current_user', JSON.stringify(userData));

            setSuccessMsg('Login efetuado com sucesso!');
            setTimeout(() => {
              setSuccessMsg('');
              onLoginSuccess(userData);
            }, 800);
          } else {
            setErrorMsg('E-mail ou senha inválidos. Ou cadastre-se abaixo.');
          }
        }
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white text-black max-w-md w-full p-8 rounded-3xl border border-gray-200 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black transition-colors p-2 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Official Company Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          {isRealLogo(logoUrl) && (
            <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-300 overflow-hidden mb-3 shadow-md flex items-center justify-center">
              <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
            </div>
          )}
          <span className="font-orbitron text-[10px] text-[#FF0033] font-bold tracking-widest">{companyName}</span>
          <h2 className="font-orbitron font-black text-2xl text-black mt-1">
            {isResetPassword ? 'Recuperar senha' : isRegister ? 'Criar nova conta' : 'Entrar na sua conta'}
          </h2>
          <p className="text-xs text-gray-600 font-sans mt-1">
            {isResetPassword ? 'Enviaremos um link de recuperação para seu e-mail.' : isRegister ? 'Cadastre-se no VOXA (Clientes e Artistas).' : 'Acesse sua conta VOXA.'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4 text-xs font-orbitron">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl mb-4 text-xs font-orbitron flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isResetPassword && (
          <>
            {/* Google Sign In Button */}
            <div className="mb-4 flex items-center justify-center w-full">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full mx-auto bg-white hover:bg-gray-50 border border-gray-300 text-black font-orbitron font-bold py-3.5 px-6 rounded-xl text-xs flex items-center justify-center text-center shadow-sm transition-all cursor-pointer uppercase tracking-wider"
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

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-3 text-[10px] font-orbitron text-gray-400">OU COM E-MAIL</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
          </>
        )}

        <form onSubmit={isResetPassword ? handleForgotPassword : handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">NOME COMPLETO</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-black placeholder-gray-400 focus:border-[#FF0033] focus:outline-none font-sans shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">COMO PRETENDE USAR O VOXA?</label>
                <select
                  value={accountRole}
                  onChange={(e) => setAccountRole(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-xs font-orbitron font-bold text-black focus:border-[#FF0033] focus:outline-none shadow-sm"
                >
                  <option value="Usuário Comum">Usuário Comum / Fã / Cliente</option>
                  <option value="Artista / DJ">Artista / DJ</option>
                  <option value="Cantor">Cantor</option>
                  <option value="Produtora">Produtora</option>
                  <option value="Empresa">Empresa</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">E-MAIL</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm text-black placeholder-gray-400 focus:border-[#FF0033] focus:outline-none font-sans shadow-sm"
                required
              />
            </div>
          </div>

          {!isResetPassword && (
            <div>
              <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">SENHA</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm text-black placeholder-gray-400 focus:border-[#FF0033] focus:outline-none font-sans shadow-sm"
                  required
                />
              </div>
            </div>
          )}

          {!isRegister && !isResetPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setIsResetPassword(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs text-gray-500 hover:text-[#FF0033] underline cursor-pointer"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {isResetPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setIsResetPassword(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs text-gray-500 hover:text-[#FF0033] underline cursor-pointer"
              >
                Voltar ao Login
              </button>
            </div>
          )}

          <div className="pt-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-extrabold py-3.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer"
            >
              {isLoading ? (
                <span className="animate-pulse">PROCESSANDO...</span>
              ) : isResetPassword ? (
                <>
                  <Mail className="w-4 h-4" />
                  <span>RECUPERAR SENHA</span>
                </>
              ) : isRegister ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>CRIAR CONTA</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>ENTRAR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </form>

        {!isResetPassword && (
          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-gray-600">
              {isRegister ? 'Já possui conta?' : 'Ainda não tem uma conta?'}
            </span>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMsg('');
              }}
              className="text-black font-orbitron font-bold hover:text-[#FF0033] transition-colors cursor-pointer underline"
            >
              {isRegister ? 'Fazer Login' : 'Criar conta'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};


