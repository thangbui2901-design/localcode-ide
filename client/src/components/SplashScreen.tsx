import React, { useEffect, useRef, useState } from 'react';
import { isNativeMotionAvailable, runNativeWelcomeMagicMove } from '../utils/nativeMotion';

interface SplashScreenProps {
  themeMode: 'dark' | 'light';
  bgHex?: string;
  accentColor?: string;
  onExitStart?: () => void;
  onFinish: () => void;
}

interface FlightTarget {
  dx: number;
  dy: number;
  scale: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  themeMode,
  bgHex,
  accentColor = '#3B82F6',
  onExitStart,
  onFinish
}) => {
  const [exiting, setExiting] = useState(false);
  const [nativeHandoff, setNativeHandoff] = useState(false);
  const [flight, setFlight] = useState<FlightTarget | null>(null);
  const logoWrapRef = useRef<HTMLDivElement | null>(null);
  const exitStartedRef = useRef(false);
  const doneTimerRef = useRef<number | null>(null);
  const onExitStartRef = useRef(onExitStart);
  const onFinishRef = useRef(onFinish);
  onExitStartRef.current = onExitStart;
  onFinishRef.current = onFinish;

  const isLight = themeMode === 'light';
  const resolvedBgHex = bgHex || (isLight ? '#EEF1F8' : '#080C18');

  const triggerExit = (exitDurationMs: number) => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;

    // Đo chính xác từng pixel vị trí Logo trên thanh Header của HomeScreen để tạo Magic Move đáp khớp 1:1
    let srcRect: DOMRect | null = null;
    let dstRect: DOMRect | null = null;
    let computedFlight: FlightTarget | null = null;
    try {
      const srcEl = logoWrapRef.current;
      const dstEl = document.querySelector('[data-home-logo="true"]') as HTMLElement | null;
      if (srcEl && dstEl) {
        srcRect = srcEl.getBoundingClientRect();
        dstRect = dstEl.getBoundingClientRect();
        if (srcRect.width > 0 && dstRect.width > 0) {
          const dx = dstRect.left + dstRect.width / 2 - (srcRect.left + srcRect.width / 2);
          const dy = dstRect.top + dstRect.height / 2 - (srcRect.top + srcRect.height / 2);
          const scale = Math.max(0.18, Math.min(0.45, dstRect.width / srcRect.width));
          computedFlight = { dx, dy, scale };
        }
      }
    } catch {
      // Fallback mượt nếu không đo được rect
    }

    // Ưu tiên 1: Trên iPad / iPhone (.ipa) -> Chạy 100% Swift Native CoreAnimation Magic Move (Metal 120Hz)
    if (isNativeMotionAvailable() && srcRect && dstRect && srcRect.width > 0 && dstRect.width > 0) {
      void runNativeWelcomeMagicMove({
        srcRect,
        dstRect,
        bgHex: resolvedBgHex,
        accentHex: accentColor,
        durationSec: Math.max(0.54, exitDurationMs / 1000),
        onRevealStart: () => {
          setNativeHandoff(true);
          onExitStartRef.current?.();
        },
        onComplete: () => {
          onFinishRef.current();
        }
      }).then((usedNative) => {
        if (!usedNative) {
          window.requestAnimationFrame(() => {
            if (computedFlight) setFlight(computedFlight);
            setExiting(true);
            onExitStartRef.current?.();
            if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
            doneTimerRef.current = window.setTimeout(() => {
              onFinishRef.current();
            }, exitDurationMs);
          });
        }
      });
      return;
    }

    // Ưu tiên 2: Trên trình duyệt Web -> Pure GPU transform + opacity Magic Move (0 giật)
    window.requestAnimationFrame(() => {
      if (computedFlight) setFlight(computedFlight);
      setExiting(true);
      onExitStartRef.current?.();
      if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
      doneTimerRef.current = window.setTimeout(() => {
        onFinishRef.current();
      }, exitDurationMs);
    });
  };

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      triggerExit(760);
    }, 1250);

    return () => {
      window.clearTimeout(exitTimer);
      if (doneTimerRef.current) {
        window.clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
    };
  }, []);

  const handleSkip = () => {
    triggerExit(720);
  };

  const logoTransform = exiting
    ? flight
      ? `translate3d(${flight.dx.toFixed(1)}px, ${flight.dy.toFixed(1)}px, 0) scale(${flight.scale.toFixed(3)})`
      : 'translate3d(0, -48px, 0) scale(0.72)'
    : 'translate3d(0, 0, 0) scale(1)';

  if (nativeHandoff) {
    return null;
  }

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer ${
        exiting ? 'pointer-events-none' : ''
      }`}
    >
      {/* Tấm nền Welcome Screen — mở rèm êm dịu để lộ Home đang lướt lên mượt phía sau */}
      <div
        aria-hidden="true"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.56s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'opacity'
        }}
        className="absolute inset-0"
      />

      {/* Ambient Radial Glow Behind Logo — tự thích ứng theo màu nhấn & Sáng/Tối */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full blur-3xl splash-glow-pulse"
        style={{
          background: isLight
            ? `radial-gradient(circle, color-mix(in srgb, ${accentColor} 32%, transparent) 0%, rgba(45, 212, 191, 0.16) 48%, transparent 74%)`
            : `radial-gradient(circle, color-mix(in srgb, ${accentColor} 48%, transparent) 0%, rgba(52, 211, 153, 0.24) 48%, transparent 74%)`,
          transform: exiting ? 'translate3d(0, 0, 0) scale(2.4)' : 'translate3d(0, 0, 0) scale(1)',
          opacity: exiting ? 0 : 1,
          transition: 'transform 0.68s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.48s ease',
          willChange: 'transform, opacity'
        }}
      />

      {/* Hai vòng sóng ánh sáng đồng tâm lan tỏa khi mở cửa vào HomeScreen */}
      {exiting && (
        <>
          <div
            aria-hidden="true"
            style={{
              border: `2px solid ${accentColor}`,
              boxShadow: `0 0 38px 3px color-mix(in srgb, ${accentColor} 58%, transparent), inset 0 0 24px color-mix(in srgb, ${accentColor} 30%, transparent)`
            }}
            className="splash-portal-ring pointer-events-none absolute w-36 h-36 rounded-full"
          />
          <div
            aria-hidden="true"
            style={{
              border: `1.5px solid color-mix(in srgb, ${accentColor} 55%, white 20%)`
            }}
            className="splash-portal-ring-soft pointer-events-none absolute w-36 h-36 rounded-full"
          />
        </>
      )}

      {/* Animated Squircle Logo — Magic Move bay khớp 1:1 vào Logo góc trên trái của HomeScreen */}
      <div
        ref={logoWrapRef}
        style={{
          transform: logoTransform,
          opacity: exiting ? 0 : 1,
          transition: exiting
            ? 'transform 0.66s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease 0.42s'
            : 'none',
          willChange: 'transform, opacity'
        }}
        className="relative z-10 flex items-center justify-center"
      >
        {/* Twinkling Sparkles around Play button */}
        <span
          className={`splash-spark pointer-events-none absolute w-2.5 h-2.5 rounded-full ${
            isLight
              ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]'
              : 'bg-emerald-300 shadow-[0_0_10px_#34D399]'
          }`}
          style={{ right: -4, bottom: 20, ['--tx' as string]: '18px', ['--ty' as string]: '-12px' }}
        />
        <span
          className={`splash-spark pointer-events-none absolute w-2 h-2 rounded-full ${
            isLight
              ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.55)]'
              : 'bg-sky-300 shadow-[0_0_10px_#38BDF8]'
          }`}
          style={{ right: 16, bottom: -4, ['--tx' as string]: '14px', ['--ty' as string]: '16px' }}
        />
        <span
          className={`splash-spark pointer-events-none absolute w-1.5 h-1.5 rounded-full ${
            isLight
              ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]'
              : 'bg-violet-300 shadow-[0_0_8px_#A78BFA]'
          }`}
          style={{ right: -6, bottom: -2, ['--tx' as string]: '22px', ['--ty' as string]: '8px' }}
        />
        <span
          className={`splash-spark pointer-events-none absolute w-2 h-2 rounded-full ${
            isLight
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              : 'bg-amber-200 shadow-[0_0_8px_#FDE68A]'
          }`}
          style={{ left: 10, top: 8, ['--tx' as string]: '-16px', ['--ty' as string]: '-14px' }}
        />

        <div
          style={{
            boxShadow: isLight
              ? `0 24px 54px -14px color-mix(in srgb, ${accentColor} 32%, rgba(15, 23, 42, 0.18)), 0 2px 10px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.95)`
              : `0 24px 60px -14px color-mix(in srgb, ${accentColor} 52%, rgba(0, 0, 0, 0.65)), inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
            border: isLight
              ? '1px solid rgba(15, 23, 42, 0.08)'
              : '1px solid rgba(255, 255, 255, 0.09)'
          }}
          className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-[32px] sm:rounded-[36px] overflow-hidden splash-squircle-pop"
        >
          <svg viewBox="0 0 128 128" className="w-full h-full block">
            <defs>
              {isLight ? (
                <>
                  <linearGradient id="spBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#EEF3FC" />
                  </linearGradient>
                  <linearGradient id="spLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="55%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                  <linearGradient id="spRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="52%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                  <linearGradient id="spSlashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0F172A" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                  <linearGradient id="spPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#14B8A6" />
                  </linearGradient>
                </>
              ) : (
                <>
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
                </>
              )}
            </defs>

            <rect width="128" height="128" fill="url(#spBgGrad)" />

            <path
              d="M0 0 L68 0 C54 22 36 32 18 36 C8 38 0 46 0 58 Z"
              fill={isLight ? '#E0E9FA' : '#1A2049'}
              opacity={isLight ? '0.62' : '0.72'}
            />
            <path
              d="M128 128 L52 128 C66 106 86 96 104 92 C116 90 124 80 128 66 Z"
              fill={isLight ? '#DBE6FA' : '#181E44'}
              opacity={isLight ? '0.66' : '0.75'}
            />

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

            <g className="splash-slash">
              <path
                d="M71 36 L57 92"
                fill="none"
                stroke="url(#spSlashGrad)"
                strokeWidth="12"
                strokeLinecap="round"
              />
            </g>

            <g className="splash-play-bounce">
              <path
                d="M90 77.5 C90 74.5 93.3 72.7 95.8 74.2 L113.5 84.8 C116 86.3 116 89.9 113.5 91.4 L95.8 102 C93.3 103.5 90 101.7 90 98.7 Z"
                fill={isLight ? '#F4F7FD' : '#0D1126'}
                stroke={isLight ? '#F4F7FD' : '#0D1126'}
                strokeWidth="9"
                strokeLinejoin="round"
              />
              <path
                d="M90 77.5 C90 74.5 93.3 72.7 95.8 74.2 L113.5 84.8 C116 86.3 116 89.9 113.5 91.4 L95.8 102 C93.3 103.5 90 101.7 90 98.7 Z"
                fill="url(#spPlayGrad)"
              />
            </g>
          </svg>

          <div
            aria-hidden="true"
            className={`splash-shimmer pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent ${
              isLight ? 'via-white/80' : 'via-white/25'
            } to-transparent`}
          />
        </div>
      </div>

      {/* App Title & Subtitle — tan nhẹ lên trên ngay trước khi Logo đáp xuống Header */}
      <div
        style={{
          transform: exiting ? 'translate3d(0, 14px, 0) scale(0.95)' : 'translate3d(0, 0, 0) scale(1)',
          opacity: exiting ? 0 : 1,
          transition: 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.26s ease'
        }}
        className="relative z-10 mt-6 text-center px-6"
      >
        <h1
          style={{ color: 'var(--text-primary)' }}
          className="splash-text-rise text-2xl sm:text-3xl font-extrabold tracking-tight"
        >
          Code With You
        </h1>
        <p
          style={{ color: 'var(--text-secondary)' }}
          className="splash-subtitle-rise text-xs sm:text-sm mt-1.5 font-medium"
        >
          Viết code mọi lúc, mọi nơi
        </p>
      </div>
    </div>
  );
};
