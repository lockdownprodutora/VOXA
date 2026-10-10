import React, { useState } from 'react';
import { normalizeUserProfile } from '../utils/centralUserDb';
import { CENTRAL_USERS_BACKUP_KEY } from '../utils/centralUserDb';

export interface UserAvatarProps {
  userId?: string;
  photoURL?: string | null;
  displayName?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  borderColor?: string;
  fallbackColor?: string;
  onClick?: () => void;
  showHoverEffect?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
  '3xl': 'w-32 h-32 text-4xl sm:w-36 sm:h-36 md:w-40 md:h-40'
};

const responsiveImageSizes: Record<string, string> = {
  xs: '24px',
  sm: '32px',
  md: '40px',
  lg: '48px',
  xl: '64px',
  '2xl': '96px',
  '3xl': '(max-width: 640px) 128px, (max-width: 768px) 144px, 160px'
};

const imagePixelDimensions: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
  '3xl': 160
};

function buildAvatarSrcSet(rawUrl: string): string | undefined {
  if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return undefined;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('unsplash.com') || host.includes('images.pexels.com')) {
      return [96, 160, 320]
        .map((w) => {
          const u = new URL(rawUrl);
          u.searchParams.set('w', String(w));
          u.searchParams.set('h', String(w));
          u.searchParams.set('fit', 'crop');
          return `${u.toString()} ${w}w`;
        })
        .join(', ');
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Componente canônico de Avatar para o VOXA.
 * Garante que:
 * 1. A foto venha de photoURL ou resolva pelo cache/Firestore caso falte no objeto local.
 * 2. Erros temporários de rede (onError) exibam o fallback sem apagar photoURL no banco.
 * 3. Consistência de bordas, cores e dimensões em todo o aplicativo.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  photoURL,
  displayName,
  size = 'md',
  className = '',
  borderColor,
  fallbackColor = 'bg-zinc-800 text-white',
  onClick,
  showHoverEffect = false
}) => {
  const [hasError, setHasError] = useState(false);

  // 1. Tentar resolver photoURL canônica direta
  let resolvedPhoto = (photoURL && typeof photoURL === 'string' && photoURL.trim() !== '') 
    ? photoURL.trim() 
    : '';

  // 2. Se não houver photoURL direta mas tivermos userId, consultar cache seguro
  if (!resolvedPhoto && userId) {
    try {
      const cached = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
      if (cached) {
        const users = JSON.parse(cached);
        if (Array.isArray(users)) {
          const found = users.find((u: any) => (u.uid || u.id) === userId);
          if (found && (found.photoURL || found.avatarUrl)) {
            resolvedPhoto = String(found.photoURL || found.avatarUrl).trim();
          }
        }
      }
    } catch (e) {
      // Ignora erro de parsing
    }
  }

  // 3. Letra inicial para fallback
  const initial = (displayName && displayName.trim().length > 0)
    ? displayName.trim().charAt(0).toUpperCase()
    : 'V';

  const sizeCls = sizeClasses[size] || sizeClasses.md;
  const borderCls = borderColor ? borderColor : 'border-white/10';
  const hoverCls = showHoverEffect ? 'transition-transform duration-300 hover:scale-105' : '';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden select-none ${sizeCls} ${borderCls} ${hoverCls} ${className}`}
    >
      {resolvedPhoto && !hasError ? (
        <img
          src={resolvedPhoto}
          srcSet={buildAvatarSrcSet(resolvedPhoto)}
          sizes={responsiveImageSizes[size] || '40px'}
          width={imagePixelDimensions[size] || 40}
          height={imagePixelDimensions[size] || 40}
          alt={displayName || 'Avatar'}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center font-orbitron font-black ${fallbackColor}`}>
          {initial}
        </div>
      )}
    </div>
  );
};
