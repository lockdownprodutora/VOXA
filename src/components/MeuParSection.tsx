import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  X, 
  User, 
  MapPin, 
  Sparkles, 
  CheckCircle, 
  MessageSquare, 
  Settings, 
  ArrowLeft,
  Upload,
  ShieldAlert
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  serverTimestamp, 
  updateDoc 
} from 'firebase/firestore';
import { uploadFile } from '../utils/upload';

interface MeuParSectionProps {
  currentUser: any;
  onVisitProfile?: (username: string) => void;
  triggerToast: (msg: string) => void;
  activeUserData: any;
}

export function MeuParSection({ currentUser, onVisitProfile, triggerToast, activeUserData }: MeuParSectionProps) {
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [ageVerified, setAgeVerified] = useState<boolean>(false);
  const [ageCheckError, setAgeCheckError] = useState<string>('');
  
  // Profile Form States
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(18);
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState('amizade');
  const [photoURL, setPhotoURL] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // App State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [currentProfileIndex, setCurrentProfileIndex] = useState<number>(0);
  const [myActions, setMyActions] = useState<Record<string, 'like' | 'pass' | 'block'>>({});
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [showMatchModal, setShowMatchModal] = useState<any | null>(null);
  const [datingAdInterval, setDatingAdInterval] = useState<number>(5);
  
  // Available interests list
  const availableInterests = [
    "Música", "Esportes", "Viagens", "Jogos", "Filmes & Séries", 
    "Gastronomia", "Artes & Desenho", "Tecnologia", "Dança", "Livros",
    "Baladas & Eventos", "Fotografia", "Moda", "Negócios"
  ];

  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
    checkDatingProfile();
    loadActiveCampaigns();
    loadDatingConfig();
  }, [currentUser]);

  const loadDatingConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'ad_config', 'settings'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.datingAdInterval) {
          setDatingAdInterval(Number(data.datingAdInterval));
        }
      }
    } catch (e) {
      console.warn("Failed to load dating config:", e);
    }
  };

  const loadActiveCampaigns = async () => {
    try {
      const q = query(
        collection(db, 'ad_campaigns'), 
        where('status', '==', 'active'),
        where('placement', '==', 'Meu Par')
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setActiveCampaigns(list);
    } catch (e) {
      console.warn("Failed to load ad campaigns for dating:", e);
    }
  };

  const checkDatingProfile = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const profileSnap = await getDoc(doc(db, 'dating_profiles', currentUser.uid));
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setOptIn(data.optIn || false);
        setAgeVerified(data.ageVerified || false);
        setName(data.name || currentUser.name || '');
        setAge(data.age || 18);
        setCity(data.city || '');
        setBio(data.bio || '');
        setInterests(data.interests || []);
        setLookingFor(data.lookingFor || 'amizade');
        setPhotoURL(data.photoURL || currentUser.photoURL || '');
        
        if (data.optIn) {
          await loadActionsAndProfiles(currentUser.uid);
        }
      } else {
        setOptIn(false);
        setName(currentUser.name || '');
        setPhotoURL(currentUser.photoURL || '');
      }
    } catch (err) {
      console.error("Error loading dating profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadActionsAndProfiles = async (myUid: string) => {
    try {
      const actionsSnap = await getDocs(query(collection(db, 'dating_actions'), where('userId', '==', myUid)));
      const actionsMap: Record<string, 'like' | 'pass' | 'block'> = {};
      actionsSnap.forEach(d => {
        const act = d.data();
        actionsMap[act.targetUserId] = act.actionType;
      });
      setMyActions(actionsMap);

      const matchesSnap = await getDocs(query(
        collection(db, 'dating_matches'), 
        where('users', 'array-contains', myUid)
      ));
      const matchesList: any[] = [];
      matchesSnap.forEach(d => {
        matchesList.push({ id: d.id, ...d.data() });
      });
      setMyMatches(matchesList);

      const profilesSnap = await getDocs(query(collection(db, 'dating_profiles'), where('optIn', '==', true)));
      let list: any[] = [];
      profilesSnap.forEach(d => {
        const data = d.data();
        if (d.id !== myUid && !actionsMap[d.id]) {
          list.push({ id: d.id, ...data });
        }
      });

      if (list.length === 0) {
        const seedUsers = [
          {
            id: 'seed_alex',
            name: 'Alexandre Souza',
            age: 24,
            city: 'São Paulo',
            bio: 'Amo música eletrônica, festivais e produção de som. Procuro conexões reais e boas conversas.',
            interests: ['Música', 'Baladas & Eventos', 'Tecnologia'],
            lookingFor: 'relacionamento',
            photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600'
          },
          {
            id: 'seed_mari',
            name: 'Mariana Costa',
            age: 22,
            city: 'Rio de Janeiro',
            bio: 'DJ de final de semana, amante de livros de romance e viagens espontâneas.',
            interests: ['Música', 'Livros', 'Viagens', 'Fotografia'],
            lookingFor: 'conhecer pessoas',
            photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=600'
          },
          {
            id: 'seed_lucas',
            name: 'Lucas Mendes',
            age: 27,
            city: 'Belo Horizonte',
            bio: 'Cozinhar, ouvir jazz e jogar basquete. Busco amizades e parcerias.',
            interests: ['Gastronomia', 'Esportes', 'Jogos'],
            lookingFor: 'amizade',
            photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600'
          },
          {
            id: 'seed_ana',
            name: 'Ana Carolina',
            age: 25,
            city: 'Curitiba',
            bio: 'Fotógrafa nas horas vagas, apaixonada por moda sustentável e novas culturas.',
            interests: ['Fotografia', 'Moda', 'Viagens', 'Artes & Desenho'],
            lookingFor: 'networking social',
            photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600'
          }
        ];
        list = seedUsers.filter(u => !actionsMap[u.id]);
      }

      setAllProfiles(list);
      setCurrentProfileIndex(0);
    } catch (e) {
      console.error("Error loading dating matches/profiles:", e);
    }
  };

  const handleVerifyAge = (e: React.FormEvent) => {
    e.preventDefault();
    if (age < 18) {
      setAgeCheckError('Você precisa ser maior de 18 anos para acessar o Meu Par.');
      return;
    }
    setAgeVerified(true);
    setAgeCheckError('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    
    if (age < 18) {
      alert("É necessário possuir 18 anos completos para ativar.");
      return;
    }

    try {
      const data = {
        uid: currentUser.uid,
        name: name.trim() || currentUser.name || 'Usuário VOXA',
        age: Number(age),
        city: city.trim(),
        bio: bio.trim(),
        interests,
        lookingFor,
        photoURL: photoURL || currentUser.photoURL || '',
        optIn: true,
        ageVerified: true,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'dating_profiles', currentUser.uid), data, { merge: true });
      setOptIn(true);
      setAgeVerified(true);
      setIsEditingProfile(false);
      triggerToast("Seu perfil do Meu Par foi ativado!");
      await loadActionsAndProfiles(currentUser.uid);
    } catch (err: any) {
      alert("Erro ao salvar perfil: " + err.message);
    }
  };

  const handleOptOut = async () => {
    if (!window.confirm("Deseja realmente desativar seu perfil no Meu Par?")) return;
    try {
      await updateDoc(doc(db, 'dating_profiles', currentUser.uid), {
        optIn: false
      });
      setOptIn(false);
      triggerToast("Você desativou seu perfil no Meu Par.");
    } catch (err: any) {
      alert("Erro ao desativar: " + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFile(file, 'user', (prog) => {
        setUploadProgress(Math.round(prog.percentage));
      });
      setPhotoURL(result.url);
      triggerToast("Foto carregada com sucesso!");
    } catch (err: any) {
      alert("Erro no upload: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAction = async (targetId: string, actionType: 'like' | 'pass' | 'block') => {
    if (!currentUser?.uid) return;

    try {
      const actionId = `${currentUser.uid}_${targetId}`;
      await setDoc(doc(db, 'dating_actions', actionId), {
        userId: currentUser.uid,
        targetUserId: targetId,
        actionType,
        timestamp: serverTimestamp()
      });

      setMyActions(prev => ({ ...prev, [targetId]: actionType }));

      if (actionType === 'like') {
        if (targetId.startsWith('seed_')) {
          const isMatch = Math.random() > 0.4;
          if (isMatch) {
            const targetProfile = allProfiles[currentProfileIndex];
            const matchData = {
              userA: currentUser.uid,
              userB: targetId,
              users: [currentUser.uid, targetId],
              matchedAt: new Date().toISOString(),
              targetName: targetProfile.name,
              targetPhoto: targetProfile.photoURL
            };
            const matchRef = await addDoc(collection(db, 'dating_matches'), matchData);
            setMyMatches(prev => [...prev, { id: matchRef.id, ...matchData }]);
            setShowMatchModal({ ...targetProfile, matchId: matchRef.id });
          }
        } else {
          const recQuery = query(
            collection(db, 'dating_actions'), 
            where('userId', '==', targetId),
            where('targetUserId', '==', currentUser.uid),
            where('actionType', '==', 'like')
          );
          const recSnap = await getDocs(recQuery);
          if (!recSnap.empty) {
            const targetProfile = allProfiles[currentProfileIndex];
            const matchData = {
              userA: currentUser.uid,
              userB: targetId,
              users: [currentUser.uid, targetId],
              matchedAt: new Date().toISOString(),
              targetName: targetProfile.name,
              targetPhoto: targetProfile.photoURL
            };
            const matchRef = await addDoc(collection(db, 'dating_matches'), matchData);
            setMyMatches(prev => [...prev, { id: matchRef.id, ...matchData }]);
            setShowMatchModal({ ...targetProfile, matchId: matchRef.id });
          }
        }
      }

      setCurrentProfileIndex(prev => prev + 1);
    } catch (err: any) {
      console.error("Error executing dating action:", err);
    }
  };

  const toggleInterest = (interestName: string) => {
    if (interests.includes(interestName)) {
      setInterests(prev => prev.filter(i => i !== interestName));
    } else {
      if (interests.length >= 5) {
        alert("Escolha no máximo 5 interesses principais.");
        return;
      }
      setInterests(prev => [...prev, interestName]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-black">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-orbitron text-gray-500 uppercase tracking-widest">Carregando Meu Par...</p>
      </div>
    );
  }

  // --- 1. OPT IN ENTRY POINT (PURE PREMIUM WHITE THEME) ---
  if (!optIn && !isEditingProfile) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-10 text-center space-y-8 shadow-sm">
        <div className="w-20 h-20 bg-red-50 text-[#FF0033] rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Heart className="w-10 h-10 animate-pulse" />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-orbitron font-black text-[#171717] uppercase tracking-wider">Meu Par</h2>
          <p className="text-xs text-gray-600 font-sans leading-relaxed max-w-md mx-auto">
            A plataforma de relacionamentos exclusivos do VOXA. Encontre pessoas reais com interesses idênticos aos seus de forma segura e minimalista.
          </p>
        </div>

        <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl p-6 text-left space-y-4">
          <h3 className="text-[10px] font-orbitron font-black text-[#171717] uppercase tracking-widest">Privacidade & Diretrizes</h3>
          <ul className="text-xs text-gray-600 font-sans space-y-3.5">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
              <span>Apenas membros ativos voluntariamente aparecem no feed de descobertas.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
              <span>Saldos, carteiras, contatos privados e e-mails permanecem 100% ocultos e protegidos.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
              <span>Você pode pausar ou desativar o Meu Par instantaneamente a qualquer momento.</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => setIsEditingProfile(true)}
          className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-4 px-6 rounded-2xl transition-all shadow-md uppercase tracking-wider cursor-pointer"
        >
          Ativar Meu Par e Encontrar Pessoas
        </button>
      </div>
    );
  }

  // --- 2. SETUP PROFILE ---
  if (isEditingProfile) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-8 space-y-6 shadow-sm text-black">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditingProfile(false)}
            className="text-neutral-500 hover:text-black transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-orbitron font-black text-[#171717] uppercase tracking-wider">Configurar Perfil</h2>
            <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Aparência do Meu Par</p>
          </div>
        </div>

        {!ageVerified ? (
          <form onSubmit={handleVerifyAge} className="space-y-6 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-orbitron font-bold text-[#171717] uppercase">Verificação de Idade</h3>
              <p className="text-xs text-gray-500 font-sans leading-relaxed">
                Este espaço é reservado exclusivamente para maiores de 18 anos. Insira sua idade real abaixo para continuar.
              </p>
            </div>
            <div className="max-w-xs mx-auto space-y-4">
              <input 
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-4 py-3 text-black font-mono text-center focus:border-black outline-none"
                required
              />
              {ageCheckError && (
                <p className="text-xs text-red-500 font-semibold font-sans mt-1">{ageCheckError}</p>
              )}
              <button
                type="submit"
                className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-3 rounded-xl transition-all uppercase cursor-pointer"
              >
                Confirmar Idade
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-5 text-left">
            <div className="space-y-2">
              <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Foto do Perfil</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] overflow-hidden relative flex items-center justify-center shrink-0">
                  {photoURL ? (
                    <img src={photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center">
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[8px] font-mono text-gray-600 mt-1">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="cursor-pointer bg-[#FAFAFA] hover:bg-gray-100 border border-[#E5E5E5] text-[#171717] text-[10px] font-orbitron font-bold px-4 py-2 rounded-xl inline-flex items-center gap-2 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    CARREGAR FOTO
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                  <p className="text-[9px] text-gray-500 font-sans leading-relaxed">Arquivos recomendados: JPG ou PNG. Formato quadrado.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Nome de Exibição</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Apelido no Meu Par"
                  className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Cidade / Estado</label>
                <input 
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: São Paulo, SP"
                  className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Sua Biografia Curta</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Fale um pouco sobre você e o que gosta..."
                rows={3}
                className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs resize-none"
                maxLength={200}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Objetivo</label>
                <select
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                >
                  <option value="relacionamento">Relacionamento sério</option>
                  <option value="amizade">Amizade</option>
                  <option value="conhecer pessoas">Conhecer pessoas</option>
                  <option value="casual">Algo casual</option>
                  <option value="networking social">Networking social</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Sua Idade</label>
                <input 
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  min="18"
                  max="110"
                  className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-mono focus:border-black outline-none text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Seus Interesses (Até 5)</label>
                <span className="text-[9px] font-mono text-gray-500">{interests.length}/5</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl">
                {availableInterests.map((interest) => {
                  const selected = interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`text-[10px] font-orbitron font-bold px-2.5 py-1.5 rounded-lg transition-all border ${
                        selected 
                          ? 'bg-[#FF0033] text-white border-[#FF0033]' 
                          : 'bg-white text-gray-700 border-[#E5E5E5] hover:border-black'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="w-1/2 bg-gray-200 hover:bg-gray-300 text-[#171717] font-orbitron font-black text-xs py-3 rounded-xl transition-all uppercase cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="w-1/2 bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-3 rounded-xl transition-all uppercase cursor-pointer"
              >
                Salvar e Ativar
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // --- 3. SWIPER / DISCOVERY VIEW (PURE HIGH-CONTRAST LIGHT & ACCENTS) ---
  const showAdSlot = currentProfileIndex > 0 && currentProfileIndex % datingAdInterval === 0;

  const renderAdBlock = () => {
    const adCampaign = activeCampaigns.length > 0 
      ? activeCampaigns[Math.floor(Math.random() * activeCampaigns.length)]
      : null;

    return (
      <div className="max-w-sm mx-auto bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between h-[520px] relative text-left">
        <div className="absolute top-4 left-4 bg-black text-white font-orbitron font-black text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider z-10">
          Patrocinado
        </div>
        
        {adCampaign ? (
          <>
            <div className="h-64 bg-gray-100 relative">
              <img src={adCampaign.mediaUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-orbitron font-black text-black uppercase mt-1 leading-snug">{adCampaign.title}</h3>
                <p className="text-xs text-gray-600 font-sans line-clamp-3 leading-relaxed">{adCampaign.description}</p>
              </div>
              <a
                href={adCampaign.ctaLink || '#'}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-[11px] py-3.5 rounded-xl text-center uppercase tracking-widest transition-all block"
              >
                {adCampaign.ctaText || 'Saiba Mais'}
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="h-64 bg-neutral-50 flex flex-col items-center justify-center p-8 text-center border-b border-[#E5E5E5] shrink-0">
              <Sparkles className="w-12 h-12 text-[#FF0033] mb-4 animate-bounce" />
              <h3 className="text-xl font-orbitron font-black text-black uppercase">Sua Marca no VOXA</h3>
              <p className="text-xs text-gray-600 font-sans mt-2">
                Anuncie para toda a rede VOXA de forma direta e impulsione sua marca.
              </p>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">VOXA ADS SPONSOR</span>
                <p className="text-xs text-gray-600 font-sans leading-relaxed">
                  Campanhas de alto engajamento com fotos e segmentações dinâmicas. Acesse a aba ADS para criar.
                </p>
              </div>
              <button
                onClick={() => triggerToast("Abra a aba VOXA Ads para criar sua primeira campanha!")}
                className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-[11px] py-3.5 rounded-xl text-center uppercase tracking-widest transition-all cursor-pointer"
              >
                Criar Anúncio Agora
              </button>
            </div>
          </>
        )}

        <div className="p-4 border-t border-[#E5E5E5] bg-[#FAFAFA] text-center">
          <button
            onClick={() => setCurrentProfileIndex(prev => prev + 1)}
            className="text-[10px] font-mono text-gray-500 hover:text-black transition-all uppercase tracking-widest cursor-pointer"
          >
            Pular Anúncio e Continuar
          </button>
        </div>
      </div>
    );
  };

  const activeCard = allProfiles[currentProfileIndex];

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-black">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 text-[#FF0033] rounded-full flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-orbitron font-black text-[#171717] uppercase tracking-wider">Meu Par</h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Descobertas e conexões</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setIsEditingProfile(true)}
            className="bg-[#FAFAFA] hover:bg-gray-100 border border-[#E5E5E5] text-[#171717] font-orbitron font-bold text-[10px] py-2.5 px-4 rounded-xl transition-all tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            MEU PERFIL DATING
          </button>
          <button
            onClick={handleOptOut}
            className="bg-red-50 hover:bg-red-100 border border-red-200 text-[#FF0033] font-orbitron font-bold text-[10px] py-2.5 px-4 rounded-xl transition-all tracking-wider cursor-pointer"
          >
            SAIR DO MEU PAR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Swiper Swiping Cards */}
        <div className="lg:col-span-8 flex flex-col justify-center">
          {showAdSlot ? (
            renderAdBlock()
          ) : activeCard ? (
            <div className="max-w-sm mx-auto w-full bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-sm flex flex-col h-[520px] relative text-left">
              <div className="relative h-[310px] bg-gray-100 shrink-0">
                {activeCard.photoURL ? (
                  <img src={activeCard.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                    <User className="w-20 h-20" />
                  </div>
                )}
                <div className="absolute top-4 left-4 flex gap-1.5 z-10">
                  <span className="text-[9px] font-orbitron font-black bg-black/90 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {activeCard.lookingFor || 'Amizade'}
                  </span>
                </div>
                {/* Overlay card shadow for text contrast on photos */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pt-12 pb-4 px-6">
                  <h3 className="text-xl font-orbitron font-black text-white uppercase tracking-wide truncate">
                    {activeCard.name}, {activeCard.age}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-300 font-sans">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{activeCard.city || 'São Paulo'}</span>
                  </div>
                </div>
              </div>

              {/* Card Body and Controls */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-gray-700 font-sans line-clamp-3 leading-relaxed">
                    {activeCard.bio || 'Sem descrição de perfil no momento.'}
                  </p>
                  
                  {activeCard.interests && activeCard.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {activeCard.interests.slice(0, 3).map((int: string) => (
                        <span key={int} className="text-[8px] font-orbitron font-bold bg-[#FAFAFA] border border-[#E5E5E5] text-gray-700 px-2 py-1 rounded-md uppercase">
                          {int}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Action Swiper Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-1 shrink-0">
                  <button
                    onClick={() => handleAction(activeCard.id, 'pass')}
                    className="bg-gray-100 hover:bg-red-50 border border-[#E5E5E5] hover:border-red-200 text-red-500 py-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer"
                    title="Pular"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (activeCard.username || activeCard.id) {
                        onVisitProfile?.(activeCard.username || activeCard.id);
                      }
                    }}
                    className="bg-gray-100 hover:bg-blue-50 border border-[#E5E5E5] hover:border-blue-200 text-blue-600 py-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer"
                    title="Ver Perfil"
                  >
                    <User className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleAction(activeCard.id, 'like')}
                    className="bg-red-50 hover:bg-[#FF0033] border border-red-200 hover:border-[#FF0033] text-[#FF0033] hover:text-white py-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer"
                    title="Tenho Interesse"
                  >
                    <Heart className="w-5 h-5 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-sm mx-auto text-center py-16 bg-white border border-[#E5E5E5] rounded-3xl p-8 space-y-4 shadow-xs">
              <Sparkles className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
              <h3 className="text-lg font-orbitron font-black text-black uppercase">Fim da Lista</h3>
              <p className="text-xs text-gray-600 font-sans leading-relaxed">
                Você viu todos os perfis cadastrados no momento. Volte em breve para novos pares!
              </p>
              <button
                onClick={() => {
                  setCurrentProfileIndex(0);
                  triggerToast("Lista reiniciada!");
                }}
                className="bg-[#FAFAFA] hover:bg-gray-100 border border-[#E5E5E5] text-black font-orbitron font-black text-[10px] py-2.5 px-4 rounded-xl transition-all uppercase tracking-widest cursor-pointer"
              >
                Rever Perfis
              </button>
            </div>
          )}
        </div>

        {/* Right column: Connections */}
        <div className="lg:col-span-4 bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-xs space-y-6 text-left h-[520px] flex flex-col">
          <div className="border-b border-[#E5E5E5] pb-4 shrink-0">
            <h3 className="text-sm font-orbitron font-black text-[#171717] uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#FF0033]" />
              Suas Conexões ({myMatches.length})
            </h3>
            <p className="text-[9px] text-gray-500 font-mono uppercase mt-1">Interesses Mútuos</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {myMatches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Heart className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-500 font-sans">Nenhuma conexão ainda. Continue swipando para encontrar matches!</p>
              </div>
            ) : (
              myMatches.map(m => (
                <div key={m.id} className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-2xl flex items-center justify-between hover:border-[#FF0033]/25 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-[#E5E5E5] overflow-hidden shrink-0">
                      <img src={m.targetPhoto || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="text-xs font-orbitron font-black text-black uppercase">{m.targetName || 'Membro VOXA'}</h4>
                      <p className="text-[9px] text-red-500 font-mono font-bold">Vocês deram par!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerToast("Abra as Mensagens para iniciar um chat privado com sua conexão!")}
                    className="bg-[#171717] hover:bg-black text-white p-2 rounded-xl transition-all cursor-pointer"
                    title="Enviar Mensagem"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MATCH POPUP MODAL */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full bg-white border border-[#E5E5E5] rounded-3xl p-8 text-center space-y-6 relative animate-in zoom-in duration-200 text-black">
            <div className="w-16 h-16 bg-red-50 text-[#FF0033] rounded-full flex items-center justify-center mx-auto animate-bounce shadow-xs">
              <Heart className="w-8 h-8 fill-current" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-3xl font-orbitron font-black text-[#171717] uppercase tracking-wider">Deu Par!</h3>
              <p className="text-sm text-gray-600 font-sans leading-relaxed">
                Você e **{showMatchModal.name}** deram match mútuo! Já podem começar a conversar.
              </p>
            </div>

            <div className="flex justify-center items-center -space-x-4 py-4">
              <div className="w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-sm">
                <img src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-sm">
                <img src={showMatchModal.photoURL} alt="" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowMatchModal(null);
                  triggerToast("Inicie o chat privado nas mensagens!");
                }}
                className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-3.5 rounded-xl uppercase tracking-widest transition-all cursor-pointer"
              >
                Enviar Mensagem Direta
              </button>
              <button
                onClick={() => setShowMatchModal(null)}
                className="w-full bg-transparent hover:bg-gray-100 text-gray-500 hover:text-black font-orbitron font-bold text-xs py-2.5 rounded-xl uppercase tracking-widest transition-all cursor-pointer"
              >
                Continuar Swipando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
