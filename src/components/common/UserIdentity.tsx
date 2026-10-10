import React, { useState, useEffect } from 'react';
import { User as UserIcon, Shield, Star } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import { VerifiedBadge } from './VerifiedBadge';

import { normalizeUserProfile } from '../../utils/centralUserDb';

interface UserAvatarProps {
  userId?: string;
  user?: {
    photoURL?: string;
    avatarUrl?: string;
    name?: string;
    artisticName?: string;
  } | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  user: initialUser,
  className = '',
  size = 'md'
}) => {
  const [resolvedUser, setResolvedUser] = useState<any>(initialUser ? normalizeUserProfile(initialUser) : null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (initialUser) {
      setResolvedUser(normalizeUserProfile(initialUser));
      setImgError(false);
      return;
    }
    if (!userId) return;

    // Fetch user from cache or Firestore
    const cacheKey = `voxa_avatar_user_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setResolvedUser(normalizeUserProfile(JSON.parse(cached)));
      } catch (e) {}
    }

    const fetchUser = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const userData = normalizeUserProfile({ id: userSnap.id, uid: userSnap.id, ...userSnap.data() });
          setResolvedUser(userData);
          localStorage.setItem(cacheKey, JSON.stringify(userData));
        }
      } catch (err) {
        console.warn("Error fetching user avatar info:", err);
      }
    };

    fetchUser();
  }, [userId, initialUser]);

  const avatarUrl = resolvedUser?.photoURL || resolvedUser?.avatarUrl || '';
  const name = resolvedUser?.name || resolvedUser?.artisticName || resolvedUser?.slug || 'V';
  const initial = name.charAt(0).toUpperCase();

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl'
  };

  const selectedSizeClass = sizeClasses[size];

  return (
    <div className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-tr from-white to-neutral-800 p-[2px] ${selectedSizeClass} ${className}`}>
      <div className="w-full h-full rounded-full overflow-hidden bg-zinc-950 flex items-center justify-center">
        {avatarUrl && !imgError ? (
          <img 
            src={avatarUrl} 
            alt={name} 
            className="w-full h-full object-cover rounded-full" 
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <span className="font-orbitron font-black text-white uppercase tracking-wider select-none">
            {initial}
          </span>
        )}
      </div>
    </div>
  );
};

interface UserIdentityProps {
  userId?: string;
  user?: any | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export const UserIdentity: React.FC<UserIdentityProps> = ({
  userId,
  user: initialUser,
  className = '',
  size = 'md',
  showBadge = true
}) => {
  const [resolvedUser, setResolvedUser] = useState<any>(initialUser || null);

  useEffect(() => {
    if (initialUser) {
      setResolvedUser(initialUser);
      return;
    }
    if (!userId) return;

    const cacheKey = `voxa_identity_user_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setResolvedUser(JSON.parse(cached));
      } catch (e) {}
    }

    const fetchUser = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setResolvedUser(userData);
          localStorage.setItem(cacheKey, JSON.stringify(userData));
        }
      } catch (err) {
        console.warn("Error fetching user identity:", err);
      }
    };

    fetchUser();
  }, [userId, initialUser]);

  const name = resolvedUser?.name || resolvedUser?.artisticName || 'Membro VOXA';
  const username = resolvedUser?.username || resolvedUser?.slug || '';
  const isVerified = Boolean(
    resolvedUser?.isVerified || 
    resolvedUser?.verified || 
    resolvedUser?.verificationStatus === 'verified'
  );
  const isPremium = resolvedUser?.isPremium || resolvedUser?.role === 'ADMINISTRADOR';

  const avatarSizes = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const
  };

  return (
    <div className={`flex items-center space-x-3 text-left ${className}`}>
      <UserAvatar user={resolvedUser} size={avatarSizes[size]} />
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex items-center space-x-1.5 min-w-0">
          <span className={`font-orbitron font-extrabold truncate text-white uppercase tracking-wide leading-tight ${
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm'
          }`}>
            {name}
          </span>
          {showBadge && isVerified && (
            <VerifiedBadge size="xs" accountType={resolvedUser?.accountType} />
          )}
          {showBadge && isPremium && (
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 shrink-0 animate-pulse" title="Premium Assinante" />
          )}
        </div>
        {username && (
          <span className={`font-mono text-gray-500 truncate ${
            size === 'sm' ? 'text-[9px]' : 'text-[10px]'
          }`}>
            @{username}
          </span>
        )}
      </div>
    </div>
  );
};
