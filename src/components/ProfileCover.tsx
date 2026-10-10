import React, { useState, useEffect, useMemo } from 'react';
import { CENTRAL_USERS_BACKUP_KEY } from '../utils/centralUserDb';
import { ProfileBanner } from '../types';
import { ChevronLeft, ChevronRight, ExternalLink, Volume2, VolumeX, Megaphone } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';

export interface ProfileCoverProps {
  userId?: string;
  coverUrl?: string | null;
  banners?: ProfileBanner[];
  className?: string;
  heightClass?: string;
  children?: React.ReactNode;
  autoPlayIntervalMs?: number;
}

export function buildResponsiveSrcSet(rawUrl: string, widths: number[]): string | undefined {
  if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return undefined;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('unsplash.com') || host.includes('images.pexels.com') || host.includes('cloudinary.com')) {
      return widths
        .map((w) => {
          const u = new URL(rawUrl);
          if (host.includes('unsplash.com')) {
            u.searchParams.set('w', String(w));
            u.searchParams.set('auto', 'format');
            u.searchParams.set('fit', 'crop');
            u.searchParams.set('q', '80');
          } else if (host.includes('pexels.com')) {
            u.searchParams.set('w', String(w));
            u.searchParams.set('auto', 'compress');
            u.searchParams.set('cs', 'tinysrgb');
          }
          return `${u.toString()} ${w}w`;
        })
        .join(', ');
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function extractYouTubeVideoId(urlOrId?: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0] || '';
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v') || '';
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.findIndex(p => p === 'embed' || p === 'shorts' || p === 'v');
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) return match[1];
  }
  return '';
}

/**
 * Componente canônico de Carrossel de Banner do Perfil para o VOXA.
 * Suporta de 0 a 4 banners (Imagem, GIF, Vídeo MP4, YouTube), link de redirecionamento,
 * anúncios patrocinados do VOXA Ads e mantém 100% de compatibilidade com coverUrl existente.
 */
export const ProfileCover: React.FC<ProfileCoverProps> = ({
  userId,
  coverUrl,
  banners: propBanners,
  className = '',
  heightClass = 'h-56 sm:h-72',
  children,
  autoPlayIntervalMs = 5000
}) => {
  const [hasErrorMap, setHasErrorMap] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVideoPlayingWithSound, setIsVideoPlayingWithSound] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [remoteBanners, setRemoteBanners] = useState<ProfileBanner[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // Carregar banners da coleção canônica `profile_banners` para este perfil
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const loadProfileBanners = async () => {
      try {
        // 1. Verificar localStorage para resposta imediata
        const localKey = `voxa_profile_banners_${userId}`;
        const localSaved = localStorage.getItem(localKey);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed) && isMounted) {
            setRemoteBanners(parsed);
          }
        }

        // 2. Consultar coleção profile_banners no Firestore
        if (isFirebaseConfigured()) {
          const q = query(collection(db, 'profile_banners'), where('ownerUid', '==', userId));
          const snap = await getDocs(q);
          if (!snap.empty && isMounted) {
            const fetched: ProfileBanner[] = [];
            snap.forEach(d => {
              const data = d.data() as ProfileBanner;
              fetched.push({
                ...data,
                bannerId: data.bannerId || d.id
              });
            });
            setRemoteBanners(fetched);
            localStorage.setItem(localKey, JSON.stringify(fetched));
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
    };

    loadProfileBanners();

    const handleBannerUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (!detail || detail.ownerUid === userId) {
        loadProfileBanners();
      }
    };
    window.addEventListener('voxa_profile_banners_updated', handleBannerUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('voxa_profile_banners_updated', handleBannerUpdated);
    };
  }, [userId]);

  // 1. Tentar resolver coverUrl canônica direta ou cache para compatibilidade retroativa
  const resolvedLegacyCover = useMemo(() => {
    let direct = (coverUrl && typeof coverUrl === 'string' && coverUrl.trim() !== '')
      ? coverUrl.trim()
      : '';
    if (!direct && userId) {
      try {
        const cached = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
        if (cached) {
          const users = JSON.parse(cached);
          if (Array.isArray(users)) {
            const found = users.find((u: any) => (u.uid || u.id) === userId);
            if (found && (found.coverUrl || found.coverURL || found.bannerUrl)) {
              direct = String(found.coverUrl || found.coverURL || found.bannerUrl).trim();
            }
          }
        }
      } catch {}
    }
    return direct;
  }, [coverUrl, userId]);

  // 2. Construir lista canônica de até 4 banners ativos
  const activeBanners = useMemo<ProfileBanner[]>(() => {
    const now = Date.now();
    const sourceList = (propBanners && propBanners.length > 0)
      ? propBanners
      : remoteBanners;

    // Filtrar ativos e não expirados
    const valid = sourceList
      .filter(b => {
        if (!b || b.active === false) return false;
        if (b.expiresAt) {
          const exp = new Date(b.expiresAt).getTime();
          if (!isNaN(exp) && exp < now) return false;
        }
        if (b.type === 'youtube') {
          return Boolean(extractYouTubeVideoId(b.youtubeVideoId || b.mediaUrl));
        }
        return Boolean(b.mediaUrl && b.mediaUrl.trim() !== '');
      })
      .sort((a, b) => (a.position || 1) - (b.position || 1));

    // Compatibilidade com coverUrl existente: se o usuário tem coverUrl e ela ainda não está na lista de banners,
    // interpretá-la como o primeiro banner sem perder a capa existente
    const result: ProfileBanner[] = [...valid];
    if (resolvedLegacyCover) {
      const alreadyIncluded = result.some(b => b.mediaUrl === resolvedLegacyCover);
      if (!alreadyIncluded && result.length < 4) {
        const isVideo = resolvedLegacyCover.toLowerCase().endsWith('.mp4');
        const isGif = resolvedLegacyCover.toLowerCase().endsWith('.gif');
        result.unshift({
          bannerId: `legacy_cover_${userId || 'default'}`,
          ownerUid: userId || '',
          type: isVideo ? 'video' : isGif ? 'gif' : 'image',
          mediaUrl: resolvedLegacyCover,
          position: 1,
          active: true,
          createdAt: new Date().toISOString()
        });
      }
    }

    return result.slice(0, 4).map((b, idx) => ({
      ...b,
      position: idx + 1
    }));
  }, [propBanners, remoteBanners, resolvedLegacyCover, userId]);

  // Ajustar índice se o número de banners mudar
  useEffect(() => {
    if (currentIndex >= activeBanners.length) {
      setCurrentIndex(0);
    }
  }, [activeBanners.length, currentIndex]);

  // Rotação automática quando houver de 2 a 4 banners (pausa ao interagir ou reproduzir vídeo com som)
  useEffect(() => {
    if (activeBanners.length <= 1 || isPaused || isVideoPlayingWithSound) return;
    const currentBanner = activeBanners[currentIndex];
    const delay = (currentBanner?.type === 'video' || currentBanner?.type === 'youtube')
      ? Math.max(autoPlayIntervalMs, 8000)
      : autoPlayIntervalMs;

    const timer = window.setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeBanners.length);
    }, delay);

    return () => window.clearInterval(timer);
  }, [activeBanners, currentIndex, isPaused, isVideoPlayingWithSound, autoPlayIntervalMs]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchEndX !== null && activeBanners.length > 1) {
      const distance = touchStartX - touchEndX;
      const minSwipeDistance = 40;
      if (distance > minSwipeDistance) {
        setCurrentIndex(prev => (prev + 1) % activeBanners.length);
      } else if (distance < -minSwipeDistance) {
        setCurrentIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
      }
    }
    setTouchStartX(null);
    setTouchEndX(null);
    setTimeout(() => setIsPaused(false), 2500);
  };

  const handleBannerClick = async (banner: ProfileBanner) => {
    if (!banner.redirectUrl) return;
    const cleanUrl = banner.redirectUrl.trim();
    if (!cleanUrl) return;

    // Registrar clique na coleção profile_banners se for persistido
    if (isFirebaseConfigured() && banner.bannerId && !banner.bannerId.startsWith('legacy_')) {
      try {
        await updateDoc(doc(db, 'profile_banners', banner.bannerId), {
          clicksCount: increment(1)
        });
      } catch {}
    }

    const targetUrl = /^https?:\/\//i.test(cleanUrl) || cleanUrl.startsWith('/')
      ? cleanUrl
      : `https://${cleanUrl}`;

    if (targetUrl.startsWith('/')) {
      window.location.href = targetUrl;
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const currentBanner = activeBanners[currentIndex] || null;

  return (
    <div
      className={`relative overflow-hidden group bg-gradient-to-tr from-black via-zinc-950 to-neutral-900 ${heightClass} ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {currentBanner && !hasErrorMap[currentBanner.bannerId] ? (
        <div className="w-full h-full relative">
          {currentBanner.type === 'youtube' ? (
            (() => {
              const videoId = extractYouTubeVideoId(currentBanner.youtubeVideoId || currentBanner.mediaUrl);
              if (!videoId) return null;
              const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&playsinline=1`;
              return (
                <div className="w-full h-full relative bg-black overflow-hidden">
                  <iframe
                    key={`${currentBanner.bannerId}_${isMuted}`}
                    src={embedUrl}
                    title={currentBanner.title || 'YouTube Profile Banner'}
                    className="w-full h-[140%] -top-[20%] relative object-cover pointer-events-none select-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  {/* Camada clicável se houver redirectUrl */}
                  {currentBanner.redirectUrl && (
                    <div
                      onClick={() => handleBannerClick(currentBanner)}
                      className="absolute inset-0 z-10 cursor-pointer"
                      title={currentBanner.title || currentBanner.redirectUrl}
                    />
                  )}
                </div>
              );
            })()
          ) : currentBanner.type === 'video' ? (
            currentBanner.mediaUrl && currentBanner.mediaUrl.trim() !== '' ? (
              <video
                key={currentBanner.bannerId}
                src={currentBanner.mediaUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                onPlay={() => {
                  if (!isMuted) setIsVideoPlayingWithSound(true);
                }}
                onPause={() => setIsVideoPlayingWithSound(false)}
                onClick={() => currentBanner.redirectUrl && handleBannerClick(currentBanner)}
                onError={() => setHasErrorMap(prev => ({ ...prev, [currentBanner.bannerId]: true }))}
                className={`w-full h-full object-cover transition-transform duration-700 ${currentBanner.redirectUrl ? 'cursor-pointer' : ''}`}
              />
            ) : null
          ) : (
            currentBanner.mediaUrl && currentBanner.mediaUrl.trim() !== '' ? (
              <img
                key={currentBanner.bannerId}
                src={currentBanner.mediaUrl}
                srcSet={buildResponsiveSrcSet(currentBanner.mediaUrl, [480, 768, 1024, 1440])}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
                loading="lazy"
                decoding="async"
                alt={currentBanner.title || 'Banner do Perfil'}
                onClick={() => currentBanner.redirectUrl && handleBannerClick(currentBanner)}
                onError={() => setHasErrorMap(prev => ({ ...prev, [currentBanner.bannerId]: true }))}
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${currentBanner.redirectUrl ? 'cursor-pointer' : ''}`}
              />
            ) : null
          )}

          {/* Badge de Anúncio Patrocinado (VOXA Ads) ou Título/Link do Banner */}
          <div className="absolute bottom-3 left-4 z-20 flex flex-wrap items-center gap-2 max-w-[75%]">
            {(currentBanner.isSponsoredAd || currentBanner.isAdvertisement) && (
              <span className="bg-black/80 backdrop-blur-md border border-[#FF0033]/50 text-white text-[9px] font-orbitron font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 tracking-wider shadow-lg">
                <Megaphone className="w-3 h-3 text-[#FF0033]" />
                <span>VOXA Ads {currentBanner.sponsorUsername ? `• @${currentBanner.sponsorUsername}` : '• Patrocinado'}</span>
              </span>
            )}

            {currentBanner.redirectUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBannerClick(currentBanner);
                }}
                className="bg-black/75 hover:bg-white hover:text-black text-white backdrop-blur-md border border-white/15 text-[9px] font-orbitron font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5 tracking-wider transition-all cursor-pointer shadow-lg"
              >
                <span className="truncate max-w-[180px]">{currentBanner.title || 'Acessar Link'}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </button>
            )}
          </div>

          {/* Botão de Som para Vídeos / YouTube */}
          {(currentBanner.type === 'video' || currentBanner.type === 'youtube') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(prev => {
                  const next = !prev;
                  setIsVideoPlayingWithSound(!next);
                  return next;
                });
              }}
              className="absolute bottom-3 right-4 z-20 bg-black/75 hover:bg-black text-white border border-white/15 p-2 rounded-full transition-all cursor-pointer shadow-lg"
              title={isMuted ? 'Ativar som do banner' : 'Silenciar banner'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#FF0033]" />}
            </button>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-black via-[#080710] to-[#FF0033]/15 flex items-center justify-center">
          <span className="font-orbitron font-black text-white/10 text-6xl sm:text-7xl select-none tracking-widest">
            VOXA
          </span>
        </div>
      )}

      {/* Setas de navegação e indicadores do Carrossel (quando houver 2 a 4 banners) */}
      {activeBanners.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(prev => (prev + 1) % activeBanners.length);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
            aria-label="Próximo banner"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots indicadores */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            {activeBanners.map((b, idx) => (
              <button
                key={b.bannerId || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex ? 'w-5 bg-[#FF0033]' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Ir para banner ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Shadow overlay para profundidade nos controles do banner */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>

      {children}
    </div>
  );
};
