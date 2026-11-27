import React, { useEffect, useRef, useState } from 'react';
import { isNativeMotionAvailable, runNativeWelcomeMagicMove } from '../utils/nativeMotion';

interface SplashScreenProps {
  themeMode: 'dark' | 'light';
  bgHex?: string;
  accentColor?: string;
  onExitStart?: () => void;
  onFinish: () => void;
}

type CartoonStage = 'play' | 'windup' | 'warping';

/* Ngôi sao 4 cánh hoạt hình lấp lánh bật tung quanh logo */
const SparkStar: React.FC<{
  color: string;
  size: number;
  style: React.CSSProperties;
}> = ({ color, size, style }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
    className="cartoon-star-burst pointer-events-none absolute"
  >
    <path
      d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z"
      fill={color}
    />
  </svg>
);

const SPEED_RAYS = [
  { deg: 0, delay: 0, color: '#38BDF8', h: 52 },
  { deg: 30, delay: 30, color: '#A855F7', h: 42 },
  { deg: 60, delay: 15, color: '#34D399', h: 56 },
  { deg: 90, delay: 45, color: '#F59E0B', h: 46 },
  { deg: 120, delay: 10, color: '#38BDF8', h: 54 },
  { deg: 150, delay: 35, color: '#F472B6', h: 44 },
  { deg: 180, delay: 20, color: '#34D399', h: 52 },
  { deg: 210, delay: 40, color: '#6366F1', h: 46 },
  { deg: 240, delay: 5, color: '#38BDF8', h: 58 },
  { deg: 270, delay: 30, color: '#F59E0B', h: 44 },
  { deg: 300, delay: 18, color: '#C084FC', h: 52 },
  { deg: 330, delay: 42, color: '#2DD4BF', h: 46 }
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  themeMode,
  bgHex,
  accentColor = '#3B82F6',
  onExitStart,
  onFinish
}) => {
  const [stage, setStage] = useState<CartoonStage>('play');
  const [nativeHandoff, setNativeHandoff] = useState(false);

  const logoWrapRef = useRef<HTMLDivElement | null>(null);
  const exitStartedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const onExitStartRef = useRef(onExitStart);
  const onFinishRef = useRef(onFinish);
  onExitStartRef.current = onExitStart;
  onFinishRef.current = onFinish;

  const isLight = themeMode === 'light';
  const resolvedBgHex = bgHex || (isLight ? '#EEF1F8' : '#080C18');

  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const triggerWarpZoom = (exitDurationMs: number, withWindup: boolean) => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;

    // Ưu tiên Native Swift CoreAnimation trên bản app .ipa iPadOS/iOS
    if (isNativeMotionAvailable()) {
      try {
        const srcRect = logoWrapRef.current?.getBoundingClientRect();
        const dstEl = document.querySelector('[data-home-logo="true"]') as HTMLElement | null;
        const dstRect = dstEl?.getBoundingClientRect();
        if (srcRect && dstRect && srcRect.width > 0 && dstRect.width > 0) {
          void runNativeWelcomeMagicMove({
            srcRect,
            dstRect,
            bgHex: resolvedBgHex,
            accentHex: accentColor,
            durationSec: Math.max(0.6, exitDurationMs / 1000),
            onRevealStart: () => {
              setNativeHandoff(true);
              onExitStartRef.current?.();
            },
            onComplete: () => {
              onFinishRef.current();
            }
          }).then((usedNative) => {
            if (!usedNative) {
              setStage('warping');
              onExitStartRef.current?.();
              schedule(() => onFinishRef.current(), exitDurationMs);
            }
          });
          return;
        }
      } catch {
        // Fallback sang Web Warp Zoom
      }
    }

    const launchWarp = () => {
      window.requestAnimationFrame(() => {
        setStage('warping');
        onExitStartRef.current?.();
        schedule(() => onFinishRef.current(), exitDurationMs);
      });
    };

    if (withWindup) {
      // Lấy đà kiểu hoạt hình Pixar/Nintendo (thu gọn nén lực 150ms rồi PHÓNG Warp Zoom!)
      setStage('windup');
      schedule(launchWarp, 155);
    } else {
      launchWarp();
    }
  };

  useEffect(() => {
    const timer = schedule(() => {
      triggerWarpZoom(760, true);
    }, 1260);

    return () => {
      window.clearTimeout(timer);
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const handleSkip = () => {
    triggerWarpZoom(680, false);
  };

  if (nativeHandoff) {
    return null;
  }

  const isWindup = stage === 'windup';
  const isWarping = stage === 'warping';

  const dotColor = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.13)';

  // Lấy đà nén nhẹ -> phóng lao xuyên ống kính!
  const logoStageTransform = isWarping
    ? 'translate3d(0, 0, 0) scale(3.15) rotate(8deg)'
    : isWindup
      ? 'translate3d(0, 6px, 0) scale(0.84, 0.8) rotate(-6deg)'
      : 'translate3d(0, 0, 0) scale(1, 1) rotate(0deg)';

  const logoStageTransition = isWarping
    ? 'transform 0.62s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.36s ease 0.14s, filter 0.42s ease'
    : isWindup
      ? 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer ${
        isWarping ? 'pointer-events-none' : ''
      }`}
    >
      {/* TẦNG 1: NỀN CANVAS TAN RỘNG KHI LAO XUYÊN WARP ZOOM */}
      <div
        aria-hidden="true"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          opacity: isWarping ? 0 : 1,
          transition: 'opacity 0.56s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'opacity'
        }}
        className="absolute inset-0"
      />

      {/* TẦNG 2: LƯỚI SAO CHẤM KHÔNG GIAN — PHÓNG VỌT QUA CAMERA LÚC WARP ZOOM */}
      <div
        aria-hidden="true"
        style={{
          backgroundImage: `radial-gradient(${dotColor} 1.5px, transparent 1.5px)`,
          backgroundSize: '32px 32px',
          backgroundPosition: 'center center',
          maskImage:
            'radial-gradient(ellipse 68% 60% at 50% 50%, rgba(0,0,0,0.95) 20%, transparent 82%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 68% 60% at 50% 50%, rgba(0,0,0,0.95) 20%, transparent 82%)',
          transform: isWarping
            ? 'translate3d(0, 0, 0) scale(3.4)'
            : isWindup
              ? 'translate3d(0, 0, 0) scale(0.92)'
              : 'translate3d(0, 0, 0) scale(1)',
          opacity: isWarping ? 0 : 0.9,
          transition: isWarping
            ? 'transform 0.72s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.48s ease'
            : 'transform 0.15s ease',
          willChange: 'transform, opacity'
        }}
        className="pointer-events-none absolute inset-0"
      />

      {/* QUẦNG SÁNG HOẠT HÌNH DỊU PHÍA SAU LOGO */}
      <div
        aria-hidden="true"
        style={{
          background: isLight
            ? `radial-gradient(circle, color-mix(in srgb, ${accentColor} 30%, transparent) 0%, rgba(52, 211, 153, 0.16) 46%, transparent 72%)`
            : `radial-gradient(circle, color-mix(in srgb, ${accentColor} 44%, transparent) 0%, rgba(52, 211, 153, 0.22) 45%, transparent 74%)`,
          transform: isWarping
            ? 'scale(3.6)'
            : isWindup
              ? 'scale(0.76)'
              : 'scale(1)',
          opacity: isWarping ? 0 : 0.85,
          transition: isWarping
            ? 'transform 0.72s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.46s ease'
            : 'transform 0.15s ease',
          willChange: 'transform, opacity'
        }}
        className="pointer-events-none absolute w-80 h-80 sm:w-[420px] sm:h-[420px] rounded-full blur-3xl"
      />

      {/* TIA TỐC ĐỘ HOẠT HÌNH + ĐƯỜNG HẦM ÁNH SÁNG LÚC PHÓNG WARP ZOOM! */}
      {isWarping && (
        <>
          <div
            aria-hidden="true"
            style={{
              background: `radial-gradient(circle, transparent 32%, color-mix(in srgb, ${accentColor} 45%, rgba(255,255,255,0.22)) 58%, transparent 74%)`
            }}
            className="warp-ring-rush pointer-events-none absolute w-44 h-44 rounded-full blur-xl"
          />
          <div
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(circle, transparent 36%, rgba(52, 211, 153, 0.34) 60%, transparent 76%)'
            }}
            className="warp-ring-rush-delay pointer-events-none absolute w-40 h-40 rounded-full blur-2xl"
          />
          {SPEED_RAYS.map((ray, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                width: '3px',
                height: `${ray.h}px`,
                background: `linear-gradient(180deg, ${ray.color}, transparent)`,
                ['--ray-deg' as string]: `${ray.deg}deg`,
                ['--ray-delay' as string]: `${ray.delay}ms`
              }}
              className="warp-speed-ray pointer-events-none absolute rounded-full"
            />
          ))}
        </>
      )}

      {/* TẦNG 3: NHÂN VẬT LOGO SQUIRCLE HOẠT HÌNH — NHẢY BẬT, NÉN LỰC & PHÓNG XUYÊN ỐNG KÍNH! */}
      <div
        ref={logoWrapRef}
        style={{
          transform: logoStageTransform,
          opacity: isWarping ? 0 : 1,
          filter: isWarping ? 'blur(12px)' : 'blur(0px)',
          transition: logoStageTransition,
          willChange: 'transform, opacity, filter'
        }}
        className="relative z-10 flex items-center justify-center"
      >
        {/* Sóng dội mặt đất khi logo nhảy đáp xuống tâm */}
        <div
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${accentColor} 36%, transparent) 0%, transparent 68%)`
          }}
          className="cartoon-floor-ripple pointer-events-none absolute w-40 h-40 rounded-full blur-md"
        />

        {/* Ngôi sao 4 cánh & hạt sắc màu hoạt hình bật tung quanh biểu tượng */}
        <SparkStar
          color={isLight ? '#10B981' : '#34D399'}
          size={18}
          style={{
            right: -6,
            bottom: 18,
            ['--tx' as string]: '28px',
            ['--ty' as string]: '-18px',
            ['--st-delay' as string]: '0.58s'
          }}
        />
        <SparkStar
          color={isLight ? '#0EA5E9' : '#38BDF8'}
          size={15}
          style={{
            left: -4,
            top: 8,
            ['--tx' as string]: '-26px',
            ['--ty' as string]: '-22px',
            ['--st-delay' as string]: '0.62s'
          }}
        />
        <SparkStar
          color={isLight ? '#F59E0B' : '#FDE047'}
          size={14}
          style={{
            right: 12,
            top: -6,
            ['--tx' as string]: '22px',
            ['--ty' as string]: '-26px',
            ['--st-delay' as string]: '0.66s'
          }}
        />
        <SparkStar
          color={isLight ? '#8B5CF6' : '#C084FC'}
          size={13}
          style={{
            left: 10,
            bottom: -4,
            ['--tx' as string]: '-22px',
            ['--ty' as string]: '20px',
            ['--st-delay' as string]: '0.68s'
          }}
        />
        <span
          className="cartoon-star-burst pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-pink-400"
          style={{
            right: 16,
            bottom: -6,
            ['--tx' as string]: '18px',
            ['--ty' as string]: '24px',
            ['--st-delay' as string]: '0.64s'
          }}
        />
        <span
          className="cartoon-star-burst pointer-events-none absolute w-2 h-2 rounded-full bg-cyan-300"
          style={{
            left: -8,
            bottom: 24,
            ['--tx' as string]: '-28px',
            ['--ty' as string]: '8px',
            ['--st-delay' as string]: '0.7s'
          }}
        />

        {/* Thân Squircle nhảy đáp đàn hồi */}
        <div
          style={{
            boxShadow: isLight
              ? `0 26px 58px -14px color-mix(in srgb, ${accentColor} 34%, rgba(15, 23, 42, 0.2)), 0 4px 14px -4px rgba(15, 23, 42, 0.08), inset 0 1.5px 0.5px rgba(255, 255, 255, 0.92)`
              : `0 28px 66px -14px color-mix(in srgb, ${accentColor} 52%, rgba(0, 0, 0, 0.72)), 0 8px 24px -6px rgba(0, 0, 0, 0.5), inset 0 1.5px 0.5px rgba(255, 255, 255, 0.16)`
          }}
          className="cartoon-squircle-drop relative w-32 h-32 sm:w-36 sm:h-36 rounded-[32px] sm:rounded-[36px] overflow-hidden"
        >
          <svg viewBox="0 0 128 128" className="w-full h-full block">
            <defs>
              <linearGradient id="ctBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#161C3D" />
                <stop offset="100%" stopColor="#090D1F" />
              </linearGradient>
              <linearGradient id="ctLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="55%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
              <linearGradient id="ctRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="48%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
              <linearGradient id="ctSlashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#DBEAFE" />
              </linearGradient>
              <linearGradient id="ctPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>

            <rect width="128" height="128" fill="url(#ctBgGrad)" />
            <path
              d="M0 0 L72 0 C56 22 38 33 18 37 C8 39 0 47 0 60 Z"
              fill="#232B5E"
              opacity="0.58"
            />
            <path
              d="M128 128 L52 128 C66 106 86 96 104 92 C116 90 124 80 128 66 Z"
              fill="#19204A"
              opacity="0.68"
            />

            {/* < > / ▶ từng bộ phận bung nhảy đàn hồi sống động kiểu hoạt hình */}
            <g className="cartoon-bracket-left">
              <path
                d="M44 43 L22 64 L44 85"
                fill="none"
                stroke="url(#ctLeftGrad)"
                strokeWidth="12.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            <g className="cartoon-bracket-right">
              <path
                d="M84 43 L106 64 L84 85"
                fill="none"
                stroke="url(#ctRightGrad)"
                strokeWidth="12.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            <g className="cartoon-slash-whip">
              <path
                d="M71 36 L57 92"
                fill="none"
                stroke="url(#ctSlashGrad)"
                strokeWidth="12"
                strokeLinecap="round"
              />
            </g>

            <g className="cartoon-play-pop">
              <path
                d="M90 77.5 C90 74.5 93.3 72.7 95.8 74.2 L113.5 84.8 C116 86.3 116 89.9 113.5 91.4 L95.8 102 C93.3 103.5 90 101.7 90 98.7 Z"
                fill="#0D1126"
                stroke="#0D1126"
                strokeWidth="9"
                strokeLinejoin="round"
              />
              <path
                d="M90 77.5 C90 74.5 93.3 72.7 95.8 74.2 L113.5 84.8 C116 86.3 116 89.9 113.5 91.4 L95.8 102 C93.3 103.5 90 101.7 90 98.7 Z"
                fill="url(#ctPlayGrad)"
              />
            </g>
          </svg>

          {/* Vệt bóng kính lướt chéo */}
          <div
            aria-hidden="true"
            className="cartoon-gloss-sweep pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          />
        </div>
      </div>

      {/* TẦNG 4: TIÊU ĐỀ NẢY MỀM — PHÓNG VƯỢT QUA CAMERA KHI WARP ZOOM! */}
      <div
        style={{
          transform: isWarping
            ? 'translate3d(0, 32px, 0) scale(1.65)'
            : isWindup
              ? 'translate3d(0, -4px, 0) scale(0.94)'
              : 'translate3d(0, 0, 0) scale(1)',
          opacity: isWarping ? 0 : 1,
          filter: isWarping ? 'blur(10px)' : 'blur(0px)',
          transition: isWarping
            ? 'transform 0.52s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, filter 0.34s ease'
            : isWindup
              ? 'transform 0.15s ease'
              : 'none',
          willChange: 'transform, opacity, filter'
        }}
        className="relative z-10 mt-6 text-center px-6"
      >
        <h1
          style={{ color: 'var(--text-primary)' }}
          className="cartoon-title-bounce text-[28px] sm:text-[32px] font-extrabold tracking-tight leading-tight"
        >
          Code With You
        </h1>
        <p
          style={{ color: 'var(--text-secondary)' }}
          className="cartoon-sub-bounce text-[12.5px] sm:text-[13.5px] mt-1.5 font-medium"
        >
          Viết code mọi lúc, mọi nơi
        </p>
      </div>
    </div>
  );
};
