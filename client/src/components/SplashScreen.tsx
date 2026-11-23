import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setExiting(true);
    }, 1350);

    const doneTimer = window.setTimeout(() => {
      onFinish();
    }, 1780);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onFinish]);

  const handleSkip = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onFinish, 260);
  };

  return (
    <div
      onClick={handleSkip}
      style={{
        backgroundColor: '#080C18',
        transition: 'opacity 0.42s cubic-bezier(0.32, 0.72, 0, 1), transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)'
      }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer ${
        exiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Ambient Radial Glow Behind Logo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-80 h-80 rounded-full blur-3xl splash-glow-pulse"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(52,211,153,0.22) 48%, transparent 74%)'
        }}
      />

      {/* Animated Cartoon Squircle Logo */}
      <div className="relative flex items-center justify-center">
        {/* Twinkling Cartoon Sparkles around Play button */}
        <span
          className="splash-spark pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#34D399]"
          style={{ right: -4, bottom: 20, ['--tx' as string]: '18px', ['--ty' as string]: '-12px' }}
        />
        <span
          className="splash-spark pointer-events-none absolute w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_#38BDF8]"
          style={{ right: 16, bottom: -4, ['--tx' as string]: '14px', ['--ty' as string]: '16px' }}
        />
        <span
          className="splash-spark pointer-events-none absolute w-1.5 h-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_#A78BFA]"
          style={{ right: -6, bottom: -2, ['--tx' as string]: '22px', ['--ty' as string]: '8px' }}
        />
        <span
          className="splash-spark pointer-events-none absolute w-2 h-2 rounded-full bg-amber-200 shadow-[0_0_8px_#FDE68A]"
          style={{ left: 10, top: 8, ['--tx' as string]: '-16px', ['--ty' as string]: '-14px' }}
        />

        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-[32px] sm:rounded-[36px] overflow-hidden shadow-[0_24px_60px_-14px_rgba(37,99,235,0.55)] splash-squircle-pop">
          <svg viewBox="0 0 128 128" className="w-full h-full block">
            <defs>
              <linearGradient id="spBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#141838" />
                <stop offset="100%" stopColor="#0A0E21" />
              </linearGradient>
              <linearGradient id="spLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="55%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
              <linearGradient id="spRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="48%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
              <linearGradient id="spSlashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#DBEAFE" />
              </linearGradient>
              <linearGradient id="spPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>

            {/* Base Deep Navy Squircle Background */}
            <rect width="128" height="128" fill="url(#spBgGrad)" />

            {/* Subtle Diagonal Waves Matching App Logo */}
            <path
              d="M0 0 L68 0 C54 22 36 32 18 36 C8 38 0 46 0 58 Z"
              fill="#1A2049"
              opacity="0.72"
            />
            <path
              d="M128 128 L52 128 C66 106 86 96 104 92 C116 90 124 80 128 66 Z"
              fill="#181E44"
              opacity="0.75"
            />

            {/* Left Bracket < */}
            <g className="splash-bracket-left">
              <path
                d="M44 43 L22 64 L44 85"
                fill="none"
                stroke="url(#spLeftGrad)"
                strokeWidth="12.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Right Bracket > */}
            <g className="splash-bracket-right">
              <path
                d="M84 43 L106 64 L84 85"
                fill="none"
                stroke="url(#spRightGrad)"
                strokeWidth="12.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Center Slash / */}
            <g className="splash-slash">
              <path
                d="M71 36 L57 92"
                fill="none"
                stroke="url(#spSlashGrad)"
                strokeWidth="12"
                strokeLinecap="round"
              />
            </g>

            {/* Mint-Emerald Play Triangle with Dark Cutout Outline */}
            <g className="splash-play-bounce">
              <path
                d="M90 77.5 C90 74.5 93.3 72.7 95.8 74.2 L113.5 84.8 C116 86.3 116 89.9 113.5 91.4 L95.8 102 C93.3 103.5 90 101.7 90 98.7 Z"
                fill="#0D1126"
                stroke="#0D1126"
                strokeWidth="9"
                strokeLinejoin="round"
              />
              <path
                d="M90 77.5 C90 74.5 93.3 72.7 95.8 74.2 L113.5 84.8 C116 86.3 116 89.9 113.5 91.4 L95.8 102 C93.3 103.5 90 101.7 90 98.7 Z"
                fill="url(#spPlayGrad)"
              />
            </g>
          </svg>

          {/* Glossy Shimmer Sweep */}
          <div
            aria-hidden="true"
            className="splash-shimmer pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        </div>
      </div>

      {/* App Title & Subtitle */}
      <div className="mt-6 text-center px-6">
        <h1 className="splash-text-rise text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Code With You
        </h1>
        <p className="splash-subtitle-rise text-xs sm:text-sm text-slate-400 mt-1.5 font-medium">
          Viết code mọi lúc, mọi nơi
        </p>
      </div>
    </div>
  );
};
