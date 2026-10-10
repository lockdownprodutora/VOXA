import React from 'react';

export const isVerifiedUser = (user?: any): boolean => {
  if (!user) return false;
  if (user.isVerified === false && user.verified === false) return false;
  return Boolean(
    user.isVerified ||
    user.verified ||
    user.is_verified ||
    user.verificationStatus === 'verified' ||
    user.official ||
    user.role === 'ADMINISTRATOR' ||
    user.role === 'admin' ||
    user.adminRole === 'ADMINISTRATOR' ||
    user.isAdmin === true
  );
};

interface VerifiedBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  accountType?: string;
  title?: string;
  user?: any;
  isVerified?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  className = '',
  size = 'sm',
  accountType,
  title,
  user,
  isVerified
}) => {
  if (isVerified !== undefined && !isVerified) return null;
  if (user !== undefined && isVerified === undefined && !isVerifiedUser(user)) return null;

  const sizeMap = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const defaultTitle = title || (
    accountType === 'Empresa' ? 'Empresa verificada pela VOXA' :
    accountType === 'Artista' ? 'Artista verificado pela VOXA' :
    'Perfil verificado oficial da VOXA'
  );

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none text-[#1D9BF0] ${className}`}
      title={defaultTitle}
      style={{ color: '#1D9BF0' }}
    >
      <svg
        className={`${sizeMap[size]} fill-[#1D9BF0] text-[#1D9BF0] drop-shadow-sm`}
        viewBox="0 0 24 24"
        aria-label="Verificado"
      >
        <path
          fill="#1D9BF0"
          d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.575 9.55.7 10.92.7 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238.65 1.273 2.02 2.148 3.6 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z"
        />
        <path
          fill="#FFFFFF"
          d="M10.22 16.72l-4.24-4.24 1.41-1.41 2.83 2.83 6.36-6.36 1.41 1.41-7.77 7.77z"
        />
      </svg>
    </span>
  );
};
