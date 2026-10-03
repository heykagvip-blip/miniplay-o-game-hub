import React from 'react';

export interface MiniPlayLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showBadge?: boolean;
  isLight?: boolean;
  className?: string;
  onClick?: () => void;
}

export const MiniPlayLogoIcon: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLight?: boolean;
  className?: string;
}> = ({ size = 'md', isLight = false, className = '' }) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const id = React.useId().replace(/:/g, '');

  return (
    <div
      className={`relative flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${sizeMap[size]} ${className}`}
    >
      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md select-none"
        aria-hidden="true"
      >
        <defs>
          {/* Background Gradient for Squircle */}
          <linearGradient id={`${id}-bg-dark`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>

          <linearGradient id={`${id}-bg-light`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="48%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          {/* Glass Gloss Reflection */}
          <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Radiant Sunset Play Button */}
          <linearGradient id={`${id}-play`} x1="26" y1="16" x2="33" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>

          {/* Gamepad Body Gradient */}
          <linearGradient id={`${id}-ctrl`} x1="10" y1="12" x2="34" y2="33" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          {/* Soft Drop Shadow for Controller */}
          <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.32" />
          </filter>
        </defs>

        {/* Squircle App Icon Base */}
        <rect
          width="44"
          height="44"
          rx="12"
          fill={`url(#${id}-bg-${isLight ? 'light' : 'dark'})`}
        />

        {/* Top 3D Gloss Highlight */}
        <path
          d="M 1 13 C 1 6.37 6.37 1 13 1 H 31 C 37.63 1 43 6.37 43 13 V 18 C 31 23 13 23 1 18 Z"
          fill={`url(#${id}-gloss)`}
        />

        {/* Subtle Glass Rim Border */}
        <rect
          x="0.75"
          y="0.75"
          width="42.5"
          height="42.5"
          rx="11.25"
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="1.5"
        />

        {/* Gamepad Silhouette forming "M" */}
        <g filter={`url(#${id}-shadow)`}>
          <path
            d="M 14 12.5 C 16.8 12.5 19 14.8 22 14.8 C 25 14.8 27.2 12.5 30 12.5 C 34.2 12.5 36.8 15.6 36.8 19.5 C 36.8 24 35 28.5 32.8 31.5 C 31 33.8 28 33.2 26.2 30.5 C 24.6 28 23.5 24.5 22 24.5 C 20.5 24.5 19.4 28 17.8 30.5 C 16 33.2 13 33.8 11.2 31.5 C 9 28.5 7.2 24 7.2 19.5 C 7.2 15.6 9.8 12.5 14 12.5 Z"
            fill={`url(#${id}-ctrl)`}
          />

          {/* D-Pad on Left Wing (+) */}
          <rect x="11.5" y="19.5" width="7" height="3" rx="1" fill="#4338ca" />
          <rect x="13.5" y="17.5" width="3" height="7" rx="1" fill="#4338ca" />
          <circle cx="15" cy="21" r="0.8" fill="#e0e7ff" />

          {/* Play Button Triangle on Right Wing (▶) */}
          <path
            d="M 26.5 17.2 C 26.5 16.5 27.3 16 27.9 16.4 L 32.8 19.8 C 33.4 20.2 33.4 21.2 32.8 21.6 L 27.9 25 C 27.3 25.4 26.5 24.9 26.5 24.2 Z"
            fill={`url(#${id}-play)`}
          />

          {/* Center LED Status Jewels */}
          <circle cx="20.5" cy="18.5" r="1.1" fill="#6366f1" opacity="0.85" />
          <circle cx="23.5" cy="18.5" r="1.1" fill="#ec4899" opacity="0.85" />
          <circle cx="22" cy="21.5" r="1.3" fill="#06b6d4" />
        </g>
      </svg>
    </div>
  );
};

export const MiniPlayLogo: React.FC<MiniPlayLogoProps> = ({
  size = 'md',
  showText = true,
  showBadge = true,
  isLight = false,
  className = '',
  onClick,
}) => {
  const titleSizeMap = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
  };

  const subSizeMap = {
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 group select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <MiniPlayLogoIcon size={size} isLight={isLight} />

      {showText && (
        <div className="text-left">
          <div className={`flex items-center gap-1.5 font-black tracking-tight leading-tight ${titleSizeMap[size]}`}>
            <span style={{ color: isLight ? '#0f2942' : '#f8fafc' }}>Mini</span>
            <span
              className={
                isLight
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'
                  : 'bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent'
              }
            >
              Play
            </span>

            {showBadge && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border transition-colors ml-0.5"
                style={{
                  background: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)',
                  color: isLight ? '#065f46' : '#6ee7b7',
                  borderColor: isLight ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.35)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                OFFLINE
              </span>
            )}
          </div>

          <p
            className={`${subSizeMap[size]} font-medium hidden sm:block`}
            style={{ color: isLight ? '#4e7597' : 'rgba(231, 217, 255, 0.8)' }}
          >
            Offline Game Hub
          </p>
        </div>
      )}
    </div>
  );
};

export default MiniPlayLogo;
