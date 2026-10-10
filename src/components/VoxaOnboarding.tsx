import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserCheck, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  Sparkles, 
  User, 
  Compass, 
  Award, 
  Tag, 
  Layers, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where, limit, updateDoc } from 'firebase/firestore';
import { uploadFile } from '../utils/upload';

interface VoxaOnboardingProps {
  currentUser: any;
  onComplete: (updatedUser: any) => void;
}

export const VoxaOnboarding: React.FC<VoxaOnboardingProps> = ({ currentUser, onComplete }) => {
  const [step, setStep] = useState(1);
  
  // State elements
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.photoURL || '');
  const [coverUrl, setCoverUrl] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [profileType, setProfileType] = useState('Pessoa'); // Pessoa | Criador | Artista | Empresa

  // Status flags
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'avatar' | 'cover' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const INTEREST_OPTIONS = [
    'Música & Festivais',
    'Artes Visuais',
    'Streetwear & Moda',
    'Tecnologia & Web3',
    'Games & Esports',
    'Cultura Urbana',
    'Fotografia & Cinema',
    'Negócios & Marketing'
  ];

  const handleToggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(prev => prev.filter(i => i !== interest));
    } else {
      setSelectedInterests(prev => [...prev, interest]);
    }
  };

  const handleCheckUsername = async (val: string) => {
    const cleanUsername = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleanUsername);
    setUsernameSuccess(false);

    if (cleanUsername.length < 3) {
      setUsernameError('O username precisa ter no mínimo 3 caracteres.');
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError('');
    try {
      if (isFirebaseConfigured()) {
        const usernameRef = doc(db, 'usernames', cleanUsername);
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists()) {
          setUsernameError('Este @username já está em uso na VOXA.');
        } else {
          setUsernameSuccess(true);
        }
      } else {
        // Mock check
        const existing = JSON.parse(localStorage.getItem('voxa_reserved_usernames') || '{}');
        if (existing[cleanUsername]) {
          setUsernameError('Este @username já está em uso.');
        } else {
          setUsernameSuccess(true);
        }
      }
    } catch (err) {
      console.warn("Error checking username uniqueness:", err);
      setUsernameSuccess(true); // Fail open if connection is blocked in builder
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadType(type);
    setUploadProgress(0);

    try {
      const result = await uploadFile(file, type, (prog) => {
        setUploadProgress(Math.round(prog.percentage));
      });
      if (type === 'avatar') {
        setAvatarUrl(result.url);
      } else {
        setCoverUrl(result.url);
      }
    } catch (err: any) {
      alert("Erro ao enviar imagem: " + err.message);
    } finally {
      setIsUploading(false);
      setUploadType(null);
    }
  };

  const handleCompleteOnboarding = async () => {
    setSubmitting(true);
    const normalizedUsername = username.toLowerCase().trim();

    try {
      if (isFirebaseConfigured()) {
        // 1. Double check username to prevent race condition
        const usernameRef = doc(db, 'usernames', normalizedUsername);
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists() && usernameSnap.data()?.uid !== currentUser.uid) {
          alert("Este @username foi reservado por outro usuário recentemente. Escolha outro.");
          setStep(2);
          setSubmitting(false);
          return;
        }

        // 2. Write username reservation atomically
        await setDoc(usernameRef, { uid: currentUser.uid });

        // 3. Write profile details into user document
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          name,
          username: normalizedUsername,
          slug: normalizedUsername,
          referralCode: normalizedUsername.toUpperCase(),
          photoURL: avatarUrl,
          coverURL: coverUrl,
          bio,
          interests: selectedInterests,
          accountType: profileType,
          profileComplete: true, // Complete onboarding!
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          followersList: [],
          followingList: [],
          balance: 0
        });

        try {
          const { qualifyPendingReferralForUser } = await import('../utils/leagueDb');
          await qualifyPendingReferralForUser(currentUser.uid);
        } catch (refErr) {
          console.warn("Onboarding referral qualification notice:", refErr);
        }
      } else {
        // Local simulation fallback
        const existingUsernames = JSON.parse(localStorage.getItem('voxa_reserved_usernames') || '{}');
        existingUsernames[normalizedUsername] = currentUser.uid;
        localStorage.setItem('voxa_reserved_usernames', JSON.stringify(existingUsernames));
      }

      // Update session local storage and callback app
      const updatedUserObj = {
        ...currentUser,
        name,
        username: normalizedUsername,
        photoURL: avatarUrl,
        coverURL: coverUrl,
        bio,
        interests: selectedInterests,
        accountType: profileType,
        profileComplete: true
      };
      localStorage.setItem('voxa_current_user', JSON.stringify(updatedUserObj));
      
      onComplete(updatedUserObj);
    } catch (err: any) {
      console.error("Failed to complete VOXA onboarding:", err);
      alert("Erro ao finalizar cadastro: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080710] flex items-center justify-center p-4 md:p-8 font-sans text-white relative overflow-hidden select-none">
      {/* Aesthetic blur effects */}
      <div className="absolute top-[-10%] left-[-15%] w-[50%] aspect-square rounded-full bg-red-950/15 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-15%] w-[50%] aspect-square rounded-full bg-red-950/15 blur-[130px] pointer-events-none"></div>

      <div className="w-full max-w-xl bg-[#12111d]/90 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl p-8 md:p-12 relative z-10 backdrop-blur-xl flex flex-col justify-between">
        
        {/* Step Indicator Top Bar */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-8">
          <div className="flex items-center space-x-2">
            <span className="w-5 h-5 rounded bg-[#FF0033] flex items-center justify-center text-[10px] font-black">V</span>
            <span className="font-orbitron font-extrabold text-[10px] tracking-widest text-white">VOXA ONBOARDING</span>
          </div>
          <span className="text-[10px] font-orbitron font-bold text-gray-500">PASSO {step} DE 7</span>
        </div>

        {/* Dynamic Wizard Step Render */}
        <div className="flex-1 min-h-[300px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: CHOOSE NAME */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 1 • Identidade</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Como prefere ser chamado?</h2>
                  <p className="text-xs text-gray-400">Seu nome de exibição aparecerá no seu perfil, posts e store.</p>
                </div>

                <div className="pt-2">
                  <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider mb-1.5">Nome Completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: José da Silva"
                    className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-white/20 focus:outline-none transition-all placeholder:text-gray-600"
                    required
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 2: CHOOSE UNIQUE USERNAME */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 2 • Endereço Único</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Escolha seu @username único</h2>
                  <p className="text-xs text-gray-400">Esta será sua marca registrada na VOXA. Permite que outros o encontrem.</p>
                </div>

                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Username @</label>
                    <span className="text-[10px]">
                      {isCheckingUsername && <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />}
                      {usernameSuccess && <span className="text-emerald-400 font-bold">Disponível</span>}
                      {usernameError && <span className="text-red-400 font-bold">Incorreto</span>}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-gray-500 font-bold">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => handleCheckUsername(e.target.value)}
                      placeholder="username"
                      className={`w-full bg-[#1b1928] border rounded-xl pl-8 pr-4 py-3 text-xs text-white focus:outline-none transition-all placeholder:text-gray-600 ${
                        usernameSuccess ? 'border-emerald-500/50 focus:border-emerald-500' :
                        usernameError ? 'border-red-500/50 focus:border-red-500' :
                        'border-white/10 focus:border-white/20'
                      }`}
                    />
                  </div>
                  {usernameError && (
                    <div className="text-[10px] text-red-400 font-sans flex items-center space-x-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{usernameError}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: UPLOAD AVATAR */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 3 • Imagem de Perfil</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Sua foto de avatar</h2>
                  <p className="text-xs text-gray-400">Carregue uma imagem para representar seu rosto no ecossistema.</p>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-[#1b1928]/40 border border-white/5 rounded-2xl text-center space-y-4">
                  <div className="w-24 h-24 rounded-full border-2 border-white/20 overflow-hidden relative bg-zinc-800 flex items-center justify-center text-gray-500 shadow-md">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8" />
                    )}
                    {isUploading && uploadType === 'avatar' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white font-bold font-mono">
                        {uploadProgress}%
                      </div>
                    )}
                  </div>

                  <label className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-orbitron font-bold text-[10px] tracking-wider py-2.5 px-4 rounded-xl cursor-pointer flex items-center space-x-2 transition-all">
                    <Upload className="w-3.5 h-3.5 text-white" />
                    <span>FAZER UPLOAD DE FOTO</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} className="hidden" />
                  </label>
                </div>
              </motion.div>
            )}

            {/* STEP 4: UPLOAD COVER */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 4 • Capa do Perfil</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Capa do seu canal (Opcional)</h2>
                  <p className="text-xs text-gray-400">Uma capa estilosa dará um toque especial e futurista ao seu perfil.</p>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-[#1b1928]/40 border border-white/5 rounded-2xl text-center space-y-4">
                  <div className="w-full aspect-[21/9] rounded-xl overflow-hidden relative bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/10 shadow-sm">
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-orbitron tracking-widest text-gray-600">SEM IMAGEM DE CAPA</span>
                    )}
                    {isUploading && uploadType === 'cover' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white font-bold font-mono">
                        {uploadProgress}%
                      </div>
                    )}
                  </div>

                  <label className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-orbitron font-bold text-[10px] tracking-wider py-2.5 px-4 rounded-xl cursor-pointer flex items-center space-x-2 transition-all">
                    <Upload className="w-3.5 h-3.5 text-white" />
                    <span>FAZER UPLOAD DE CAPA</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} className="hidden" />
                  </label>
                </div>
              </motion.div>
            )}

            {/* STEP 5: BIO & INTERESTS */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 5 • Biografia & Interesses</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Conte um pouco sobre você</h2>
                  <p className="text-xs text-gray-400">Escreva sua biografia curta e escolha seus interesses favoritos na VOXA.</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Bio curta</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ex: Criador de artes 3D digitais e apaixonado por música..."
                      rows={2}
                      className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-white/20 focus:outline-none transition-all placeholder:text-gray-600 resize-none font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Selecione seus interesses</label>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map((interest) => {
                        const isSelected = selectedInterests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            onClick={() => handleToggleInterest(interest)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-orbitron font-bold transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-white text-black font-bold shadow-md' 
                                : 'bg-[#1b1928] text-gray-400 border border-white/5 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 6: CHOOSE PROFILE TYPE */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 6 • Tipo de Perfil</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Sua categoria no ecossistema</h2>
                  <p className="text-xs text-gray-400">Escolha o papel principal que deseja desempenhar na VOXA.</p>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {[
                    { type: 'Pessoa', desc: 'Usuário Comum' },
                    { type: 'Criador', desc: 'Produtor de Mídia' },
                    { type: 'Artista', desc: 'DJ / Cantor / Banda' },
                    { type: 'Empresa', desc: 'Lojas & Negócios' }
                  ].map((item) => {
                    const isSelected = profileType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setProfileType(item.type)}
                        className={`p-4 rounded-2xl text-left border flex flex-col justify-between h-24 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-white/10 border-white/20 shadow-lg' 
                            : 'bg-[#1b1928]/50 border-white/5 hover:bg-[#1b1928] hover:border-white/10'
                        }`}
                      >
                        <span className="font-orbitron font-black text-white text-sm tracking-wide uppercase">{item.type}</span>
                        <span className="text-[10px] text-gray-400 font-sans">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 7: READY TO GO */}
            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 text-center"
              >
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20/30 flex items-center justify-center text-white animate-bounce">
                    <Sparkles className="w-8 h-8" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-white font-orbitron text-[9px] tracking-widest font-black uppercase">PASSO 7 • Sucesso</span>
                  <h2 className="font-orbitron font-black text-2xl text-white">Tudo pronto, @{username}!</h2>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Seu perfil social está configurado. Bem-vindo à nova era descentralizada do VOXA Social Network!
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Navigation Action Buttons (BACK / NEXT) */}
        <div className="flex items-center justify-between border-t border-white/10 pt-6 mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(prev => prev - 1)}
              className="bg-white/5 hover:bg-white/10 text-white font-orbitron font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <div></div>
          )}

          {step < 7 ? (
            <button
              onClick={() => setStep(prev => prev + 1)}
              disabled={
                (step === 1 && !name.trim()) ||
                (step === 2 && (!usernameSuccess || !username.trim()))
              }
              className="bg-white hover:bg-neutral-200 text-black font-semibold text-white font-orbitron font-bold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCompleteOnboarding}
              disabled={submitting}
              className="bg-gradient-to-r from-[#FF0033] to-red-600 hover:from-[#d6002b] hover:to-red-700 text-white font-orbitron font-black text-xs py-3 px-6 rounded-xl transition-all cursor-pointer flex items-center space-x-2"
            >
              {submitting ? (
                <span>CRIANDO CANAL...</span>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>ENTRAR NA VOXA</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
