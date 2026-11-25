import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { playNativeConfettiBurst } from '../utils/nativeMotion';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface FloatingToastProps {
  toast: ToastItem | null;
  isMobile?: boolean;
  isRunning?: boolean;
  runningLabel?: string;
  celebrateKey?: number;
}

const CONFETTI_PARTICLES = [
  { cx: -92, cy: 18, cr: -140, color: '#34D399', w: 6, h: 6, round: true },
  { cx: -68, cy: 36, cr: 120, color: '#38BDF8', w: 7, h: 4, round: false },
  { cx: -46, cy: 14, cr: -95, color: '#A78BFA', w: 5, h: 5, round: true },
  { cx: -26, cy: 42, cr: 160, color: '#FBBF24', w: 6, h: 3.5, round: false },
  { cx: -8, cy: 26, cr: -110, color: '#34D399', w: 5, h: 5, round: true },
  { cx: 12, cy: 38, cr: 135, color: '#60A5FA', w: 7, h: 4, round: false },
  { cx: 34, cy: 18, cr: -150, color: '#F472B6', w: 5, h: 5, round: true },
  { cx: 58, cy: 34, cr: 145, color: '#34D399', w: 6, h: 3.5, round: false },
  { cx: 82, cy: 20, cr: -125, color: '#38BDF8', w: 6, h: 6, round: true },
  { cx: 102, cy: 32, cr: 170, color: '#FDE047', w: 5, h: 3.5, round: false },
  { cx: -78, cy: -6, cr: -180, color: '#F472B6', w: 4.5, h: 4.5, round: true },
  { cx: 74, cy: -8, cr: 165, color: '#A78BFA', w: 4.5, h: 4.5, round: true }
];

export const FloatingToast: React.FC<FloatingToastProps> = ({
  toast,
  isRunning = false,
  runningLabel = 'Đang chạy mã nguồn...',
  celebrateKey = 0
}) => {
  const [activeBurstId, setActiveBurstId] = useState(0);
  const [useDomConfetti, setUseDomConfetti] = useState(true);

  useEffect(() => {
    if (!celebrateKey) return;
    // Trên iPad/iPhone (.ipa), dùng Apple Metal CAEmitterLayer Confetti 120Hz (0 DOM node)
    const firedNative = playNativeConfettiBurst();
    setUseDomConfetti(!firedNative);
    setActiveBurstId(celebrateKey);
    const timer = window.setTimeout(() => {
      setActiveBurstId(0);
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [celebrateKey]);

  const visible = Boolean(toast) || isRunning || activeBurstId > 0;
  if (!visible) return null;

  const isLiveRunning = !toast && isRunning;

  const Icon =
    toast?.tone === 'error'
      ? AlertCircle
      : toast?.tone === 'info'
        ? Info
        : CheckCircle2;

  const iconColor =
    toast?.tone === 'error'
      ? '#FB7185'
      : toast?.tone === 'info'
        ? '#38BDF8'
        : '#34D399';

  return (
    <div
      style={{
        top: 'max(10px, env(safe-area-inset-top))'
      }}
      className="fixed left-1/2 -translate-x-1/2 z-[90] pointer-events-none flex justify-center px-3 max-w-[92vw]"
    >
      {/* Subtle Micro-Confetti Burst khi đạt 100% AC (chỉ dùng DOM trên Web; trên iPad dùng Metal CAEmitterLayer) */}
      {activeBurstId > 0 && useDomConfetti && (
        <div key={`burst-${activeBurstId}`} className="absolute top-3 left-1/2 pointer-events-none">
          {CONFETTI_PARTICLES.map((p, idx) => (
            <span
              key={idx}
              className="island-confetti-dot absolute block"
              style={{
                width: `${p.w}px`,
                height: `${p.h}px`,
                borderRadius: p.round ? '9999px' : '2px',
                backgroundColor: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                ['--cx' as string]: `${p.cx}px`,
                ['--cy' as string]: `${p.cy}px`,
                ['--cr' as string]: `${p.cr}deg`
              }}
            />
          ))}
        </div>
      )}

      {(toast || isLiveRunning) && (
        <div
          key={toast ? `toast-${toast.id}` : 'live-running'}
          style={{
            background: 'rgba(8, 12, 24, 0.92)',
            border:
              activeBurstId > 0
                ? '1px solid rgba(52, 211, 153, 0.45)'
                : '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow:
              activeBurstId > 0
                ? '0 14px 36px -6px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                : '0 14px 36px -8px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
          }}
          className="ios-island-enter relative px-4 py-2 rounded-full backdrop-blur-xl flex items-center gap-2.5 text-xs font-semibold text-white max-w-full"
        >
          {isLiveRunning ? (
            <>
              <span className="flex items-end gap-[2.5px] h-3.5 shrink-0" aria-hidden="true">
                <span
                  className="w-[2.5px] h-full rounded-full bg-sky-400 island-wave-bar"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-[2.5px] h-full rounded-full bg-emerald-400 island-wave-bar"
                  style={{ animationDelay: '180ms' }}
                />
                <span
                  className="w-[2.5px] h-full rounded-full bg-violet-400 island-wave-bar"
                  style={{ animationDelay: '340ms' }}
                />
              </span>
              <span className="truncate tracking-tight text-slate-100">{runningLabel}</span>
            </>
          ) : (
            toast && (
              <>
                <span
                  style={{
                    backgroundColor: `${iconColor}22`,
                    color: iconColor
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                >
                  <Icon size={13} strokeWidth={2.5} />
                </span>
                <span className="truncate tracking-tight text-slate-100">{toast.message}</span>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
};
