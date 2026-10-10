import React, { useState, useEffect } from 'react';
import { fetchCentralUsers } from '../utils/centralUserDb';
import { CentralUser } from '../types';
import { VerifiedBadge, isVerifiedUser } from './common/VerifiedBadge';
import { ProfileCover } from './ProfileCover';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Music, 
  Compass, 
  Volume2, 
  ShieldCheck, 
  AlertCircle,
  Heart,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PublicProfileProps {
  companyName: string;
  logoUrl: string;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ companyName, logoUrl }) => {
  const [user, setUser] = useState<CentralUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const pathname = window.location.pathname;
        const parts = pathname.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
        
        let slug = '';
        if (parts[0] === 'u' && parts[1]) {
          slug = parts[1];
        } else if (parts.length === 1 && parts[0]) {
          slug = parts[0];
        }

        if (slug && (slug.toLowerCase() === 'juniorsantti' || slug.toLowerCase() === 'juniorsantti92')) {
          slug = 'jrsantti';
          window.history.replaceState(null, '', '/jrsantti');
        }

        if (slug && !['admin', 'home', 'activate-account', 'tickets', 'store', 'vaquinhas', 'passagens', 'artistas', 'music', 'assinaturas', 'dashboard', 'submit_music', 'my_submissions'].includes(slug.toLowerCase())) {
          const list = await fetchCentralUsers();
          const found = list.find(u =>
            u.slug?.toLowerCase() === slug.toLowerCase() ||
            u.id === slug ||
            (u.username && u.username.toLowerCase() === slug.toLowerCase()) ||
            (slug.toLowerCase() === 'jrsantti' && (u.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || u.id === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2'))
          );
          if (found) {
            setUser(found);
            localStorage.setItem('voxa_referrer_user_id', found.id || found.uid || '');
            
            // Dynamic SEO
            const title = `${found.name} (@${found.username || found.slug}) | VOXA`;
            const desc = found.bio || `Confira o perfil de ${found.name} no VOXA — Uma nova dimensão social.`;
            document.title = title;
            
            // Meta tags (fallback for basic client-side SEO)
            const metaDescription = document.querySelector('meta[name="description"]');
            if (metaDescription) metaDescription.setAttribute('content', desc);
            
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) ogTitle.setAttribute('content', title);
            
            const ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc) ogDesc.setAttribute('content', desc);
            
            const ogUrl = document.querySelector('meta[property="og:url"]');
            if (ogUrl) ogUrl.setAttribute('content', window.location.href);
            
            if (found.photoURL) {
              const ogImage = document.querySelector('meta[property="og:image"]');
              if (ogImage) ogImage.setAttribute('content', found.photoURL);
            }
          } else {
            setIsError(true);
          }
        } else {
          setIsError(true);
        }
      } catch (err) {
        console.error("Failed to load public profile:", err);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleCopyLink = (text: string, type: 'referral' | 'profile') => {
    navigator.clipboard.writeText(text);
    setCopySuccess(type);
    setTimeout(() => {
      setCopySuccess(null);
    }, 2500);
  };

  const getProfileRoleLabel = (role?: string) => {
    if (!role) return 'MEMBRO OFICIAL';
    const upper = role.toUpperCase().trim();
    if (upper.includes('ARTISTA')) return 'CRIADOR / ARTISTA';
    if (upper.includes('PRODUTORA')) return 'PRODUTOR DE MÍDIA';
    if (upper.includes('EMPRESA')) return 'EMPRESA PARCEIRA';
    return 'MEMBRO DO VOXA';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080710] text-white flex flex-col items-center justify-center font-orbitron p-6">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin"></div>
          <div className="absolute font-black text-xs text-violet-400">VX</div>
        </div>
        <p className="text-xs text-gray-400 tracking-widest uppercase animate-pulse">Carregando Perfil...</p>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen bg-[#080710] text-white flex flex-col items-center justify-center font-orbitron p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-violet-400 mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black mb-2 tracking-wide uppercase">Perfil não encontrado</h1>
        <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed mb-8">
          O link que você acessou pode estar incorreto, expirado ou o perfil do usuário foi alterado.
        </p>
        <a 
          href="/"
          className="bg-white hover:bg-gray-100 text-black px-6 py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300"
        >
          Voltar ao Início
        </a>
      </div>
    );
  }

  const profileUrl = `${window.location.origin}/${user.username || user.slug}`;
  const referralUrl = `${window.location.origin}/register?ref=${user.referralCode || (user.username || user.slug || '').toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#080710] text-white font-sans flex flex-col justify-between relative overflow-hidden pb-12">
      {/* Background aesthetics */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-violet-600/10 to-transparent rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Container */}
      <div className="max-w-md w-full mx-auto px-6 pt-12 flex flex-col items-center">
        {/* VOXA Brand Header */}
        <div className="flex items-center space-x-2.5 mb-6 bg-[#12111d] border border-white/10 py-1.5 px-3.5 rounded-full backdrop-blur-md">
          <span className="w-4 h-4 rounded bg-violet-600 flex items-center justify-center text-[10px] font-bold">V</span>
          <span className="font-orbitron font-black text-[10px] tracking-widest text-white uppercase">VOXA SOCIAL</span>
        </div>

        {/* Profile Card: Cover + High-Contrast Light Identity Surface */}
        <div className="w-full rounded-[28px] overflow-hidden bg-white border border-neutral-200 shadow-2xl mb-6 text-neutral-950">
          <div className="border-b-4 border-[#FF0033]">
            <ProfileCover
              userId={user.uid || user.id}
              coverUrl={user.coverUrl || user.coverURL}
              banners={user.profileBanners}
              heightClass="h-48 sm:h-56"
            />
          </div>

          <div className="px-6 pb-6 pt-0 flex flex-col items-center relative z-10">
            {/* Overlapping Avatar frame */}
            <div className="relative -mt-14 mb-3 group">
              <div className="p-1 rounded-full bg-white shadow-xl ring-2 ring-[#FF0033]">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-900 border-2 border-neutral-100 relative z-10 overflow-hidden flex items-center justify-center">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.name} 
                      sizes="(max-width: 640px) 112px, 128px"
                      width={128}
                      height={128}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-gray-300 font-orbitron font-black text-3xl">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Identity Details on Light Surface */}
            <div className="space-y-1.5 text-center w-full">
              <h2 className="text-xl sm:text-2xl font-black font-orbitron tracking-tight text-neutral-950 uppercase flex items-center justify-center gap-2">
                <span>{user.name}</span>
                {isVerifiedUser(user) && <VerifiedBadge user={user} size="lg" />}
              </h2>
              <p className="text-sm font-mono text-neutral-700 font-bold">
                @{user.username || user.slug || 'membro'}
              </p>
              
              <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
                {(!user.slug || user.slug === 'username-nao-definido' || user.slug.includes('user-') || user.slug === 'membro') ? (
                  <span className="bg-amber-50 border border-amber-300 px-3 py-0.5 rounded-md text-[9px] font-orbitron font-black text-amber-800 uppercase tracking-wider">
                    PERFIL EM ATUALIZAÇÃO
                  </span>
                ) : (
                  <>
                    <span className="bg-neutral-100 border border-neutral-300 px-3 py-0.5 rounded-md text-[9px] font-orbitron font-black text-neutral-800 uppercase tracking-wider">
                      {getProfileRoleLabel(user.role)}
                    </span>
                    {user.categoryName && user.categoryName !== 'Sem categoria' && (
                      <span className="bg-red-50 border border-[#FF0033]/30 px-3 py-0.5 rounded-md text-[9px] font-orbitron font-black text-[#FF0033] uppercase tracking-wider">
                        {user.categoryName}
                      </span>
                    )}
                  </>
                )}
              </div>
              {user.bio && (
                <p className="text-xs text-neutral-800 mt-2 max-w-xs mx-auto leading-relaxed">
                  {user.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        {user.role === 'ARTISTA' && (
          <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-[#12111d] border border-white/5 p-3.5 rounded-2xl text-center">
              <span className="text-[9px] font-orbitron text-gray-500 uppercase block font-bold">Ranking Geral</span>
              <span className="font-mono text-lg font-black text-white">#0{user.leagueDivision || 124}</span>
            </div>
            <div className="bg-[#12111d] border border-white/5 p-3.5 rounded-2xl text-center">
              <span className="text-[9px] font-orbitron text-gray-500 uppercase block font-bold">Engajamento</span>
              <span className="font-mono text-lg font-black text-violet-400">{user.leaguePoints || 0} PTS</span>
            </div>
          </div>
        )}

        {/* Dynamic Buttons Area */}
        <div className="w-full space-y-3.5">
          {/* Action: Vaquinhas (Only if enabled) */}
          {user.features?.fundraisers && (
            <a
              href={`/vaquinhas?user=${user.username || user.slug}`}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4.5 px-6 rounded-2xl flex items-center justify-between font-orbitron font-black text-xs tracking-wider transition-all duration-300 shadow-lg shadow-emerald-500/10 cursor-pointer text-left"
            >
              <div className="flex items-center space-x-3">
                <Heart className="w-4 h-4 text-white animate-pulse" />
                <div className="text-left">
                  <span className="block text-[10px] font-black tracking-widest uppercase">APOIAR VAQUINHAS</span>
                  <span className="block text-[9px] text-white/80 font-sans tracking-normal font-normal">Contribua com as campanhas ativas</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white" />
            </a>
          )}

          {/* Action 1: Referral Program (INDICAÇÃO) */}
          <button
            onClick={() => handleCopyLink(referralUrl, 'referral')}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-750 text-white py-4.5 px-6 rounded-2xl flex items-center justify-between font-orbitron font-black text-xs tracking-wider transition-all duration-300 shadow-lg shadow-violet-500/10 cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <Sparkles className="w-4 h-4 animate-pulse text-violet-200" />
              <div className="text-left">
                <span className="block text-[10px] font-black tracking-widest uppercase">CONVIDAR PESSOAS</span>
                <span className="block text-[9px] text-white/80 font-sans tracking-normal font-normal">Copiar link de convite personalizado</span>
              </div>
            </div>
            {copySuccess === 'referral' ? (
              <Check className="w-4 h-4 text-white animate-bounce" />
            ) : (
              <Copy className="w-4 h-4 text-white" />
            )}
          </button>

          {/* Action 2: Main Website */}
          <a
            href="/"
            className="w-full bg-[#12111d] hover:bg-[#18162b] text-white py-4 px-6 rounded-2xl border border-white/10 flex items-center justify-between font-orbitron font-bold text-xs tracking-wider transition-all duration-300 hover:border-white/20 cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <Compass className="w-4 h-4 text-gray-400" />
              <span>Entrar no ecossistema VOXA</span>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>

          {/* Action 3: Compartilhar Perfil */}
          <button
            onClick={() => handleCopyLink(profileUrl, 'profile')}
            className="w-full bg-[#12111d]/60 hover:bg-[#12111d] text-white py-4 px-6 rounded-2xl border border-white/5 flex items-center justify-between font-orbitron font-bold text-xs tracking-wider transition-all duration-300 hover:border-violet-500/30 cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <Share2 className="w-4 h-4 text-gray-400" />
              <span>Copiar Link do Meu Perfil</span>
            </div>
            {copySuccess === 'profile' ? (
              <Check className="w-4 h-4 text-violet-400 animate-bounce" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Copy Toast Banner */}
        <AnimatePresence>
          {copySuccess && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-violet-500/30 text-white px-5 py-3 rounded-2xl font-orbitron text-[10px] font-bold tracking-widest shadow-2xl flex items-center space-x-2 z-50 uppercase"
            >
              <Check className="w-3.5 h-3.5 text-violet-400" />
              <span>
                {copySuccess === 'referral' ? 'Link de Indicação Copiado!' : 'Link do Perfil Copiado!'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer VOXA */}
      <div className="text-center font-orbitron text-[8px] text-gray-600 uppercase tracking-widest px-6 mt-12 select-none">
        © {new Date().getFullYear()} {companyName} • UMA NOVA DIMENSÃO SOCIAL
      </div>
    </div>
  );
};
