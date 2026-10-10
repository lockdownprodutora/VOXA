import React from 'react';
import { ArrowRight, Award, User } from 'lucide-react';

interface UserCardProps {
  user: {
    id?: string;
    uid?: string;
    name?: string;
    artisticName?: string;
    slug?: string;
    photoURL?: string;
    role?: string;
    lifetimePoints?: number;
  };
  rankingPosition?: number;
  size?: 'compact' | 'default' | 'large';
  onClick?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  rankingPosition,
  size = 'default',
  onClick
}) => {
  // Use central user name with priority: name -> artisticName -> slug -> Membro
  const name = user.name || user.artisticName || user.slug || 'Membro VOXA';
  const username = user.slug || 'membro';
  const photo = user.photoURL;

  // Default click handler always opens/goes to public profile
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    } else if (user.slug) {
      window.open(`/u/${user.slug}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Dimensions based on size variation
  const imageSizeClasses = {
    compact: 'w-20 h-20 rounded-xl',
    default: 'w-full aspect-square',
    large: 'w-full aspect-square'
  };

  if (size === 'compact') {
    return (
      <div 
        onClick={handleClick}
        className="bg-[#121212] rounded-2xl border border-white/10 overflow-hidden hover:border-white/30 transition-all duration-300 group cursor-pointer flex items-center p-3 space-x-3 w-full text-left"
      >
        <div className={`${imageSizeClasses.compact} overflow-hidden bg-black flex items-center justify-center shrink-0 border border-white/5`}>
          {photo ? (
            <img 
              src={photo} 
              alt={name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-6 h-6 text-zinc-700" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-orbitron font-black text-sm text-white truncate group-hover:text-neutral-300 transition-colors">
            {name}
          </h3>
          <p className="text-[10px] font-mono text-gray-400 truncate">
            @{username}
          </p>
          {rankingPosition && (
            <span className="inline-flex items-center gap-1 font-orbitron text-[9px] text-white font-bold mt-1">
              <Award className="w-2.5 h-2.5 text-neutral-400" />
              #{rankingPosition} Ranking VOXA
            </span>
          )}
        </div>
      </div>
    );
  }

  const containerPadding = size === 'large' ? 'p-6' : 'p-5';
  const titleSize = size === 'large' ? 'text-2xl' : 'text-lg';

  return (
    <div 
      onClick={handleClick}
      className="bg-[#121212] rounded-3xl border border-white/10 overflow-hidden hover:border-white/30 transition-all duration-300 group cursor-pointer flex flex-col justify-between h-full text-left"
    >
      <div className="relative aspect-square overflow-hidden bg-black flex items-center justify-center border-b border-white/5">
        {photo ? (
          <img 
            src={photo} 
            alt={name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            referrerPolicy="no-referrer"
          />
        ) : (
          <User className="w-16 h-16 text-zinc-800" />
        )}
        {rankingPosition && (
          <span className="absolute top-3 left-3 bg-white text-black font-orbitron text-[8px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
            <Award className="w-2.5 h-2.5 text-black" />
            #{rankingPosition}º Ranking
          </span>
        )}
      </div>
      
      <div className={`${containerPadding} flex-1 flex flex-col justify-between`}>
        <div>
          <h3 className={`font-orbitron font-black ${titleSize} text-white group-hover:text-neutral-300 transition-colors truncate`}>
            {name}
          </h3>
          <p className="text-xs font-mono text-gray-400 mt-1">
            @{username}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-orbitron text-gray-500">
            RANKING GERAL: <strong className="text-white">#{rankingPosition || '--'}</strong>
          </span>
          <span className="text-xs font-orbitron text-white group-hover:translate-x-1 transition-transform flex items-center space-x-1 font-bold">
            <span>VER PERFIL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
