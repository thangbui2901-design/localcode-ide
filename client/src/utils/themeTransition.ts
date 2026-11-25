import { isNativeMotionAvailable, runNativeThemeRipple } from './nativeMotion';

/**
 * Hiệu ứng đổi Theme lan tỏa hình tròn lộ trực tiếp giao diện thật (không bao giờ che trắng màn hình):
 * 1. Trên iPad / iPhone (.ipa Capacitor): Chạy 100% bằng **Swift Native CoreAnimation (Metal 120Hz)**
 *    dùng `webView.snapshotView` + `CAShapeLayer` (`evenOdd` cutout + vòng sáng phát quang) tách biệt hoàn toàn khỏi WebKit.
 * 2. Trên trình duyệt Web (Chrome Windows / Safari 18+): Dùng **View Transitions API siêu nhẹ**
 *    (chỉ đổi 1 thuộc tính CSS `data-ui-theme` < 0.5ms, KHÔNG flushSync, KHÔNG backdrop-blur full-screen,
 *    KHÔNG selector `*`, trì hoãn `color-scheme` & Monaco tới sau khi kết thúc) -> lộ trực tiếp UI mới trong vòng tròn.
 */

let lastPointerPoint: { x: number; y: number } | null = null;
let pointerTrackerAttached = false;
let activeTransitionToken = 0;

export function ensurePointerOriginTracker(): void {
  if (pointerTrackerAttached || typeof window === 'undefined') return;
  pointerTrackerAttached = true;
  window.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      lastPointerPoint = { x: e.clientX, y: e.clientY };
    },
    { passive: true, capture: true }
  );
}

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
}

export interface ThemeRippleOptions {
  x?: number;
  y?: number;
  targetBg?: string;
  accentColor?: string;
  onFinished?: () => void;
}

/**
 * Fallback rỗng (chỉ viền sáng mỏng trong suốt ở giữa, KHÔNG che trắng màn hình)
 * dành riêng cho trình duyệt cũ không hỗ trợ View Transitions API.
 */
function spawnHollowAccentHalo(x: number, y: number, endRadius: number, accentColor: string): void {
  if (typeof document === 'undefined') return;
  const baseSize = 160;
  const endScale = Math.max(1, (endRadius * 2) / baseSize);
  const ring = document.createElement('div');
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = [
    'position:fixed',
    `left:${x - baseSize / 2}px`,
    `top:${y - baseSize / 2}px`,
    `width:${baseSize}px`,
    `height:${baseSize}px`,
    'border-radius:9999px',
    'pointer-events:none',
    'z-index:2147483646',
    `background:radial-gradient(circle closest-side, transparent 84%, color-mix(in srgb, ${accentColor} 55%, transparent) 95%, transparent 100%)`,
    'transform:translate3d(0,0,0) scale(0.05)',
    'opacity:0.85',
    'will-change:transform,opacity'
  ].join(';');
  document.body.appendChild(ring);

  const anim = ring.animate(
    [
      { transform: 'translate3d(0,0,0) scale(0.05)', opacity: 0.85 },
      { transform: `translate3d(0,0,0) scale(${endScale.toFixed(3)})`, opacity: 0 }
    ],
    { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
  );
  const cleanup = () => {
    if (ring.parentNode) ring.parentNode.removeChild(ring);
  };
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
}

/**
 * View Transition siêu nhẹ trên Web: lộ trực tiếp UI mới trong vòng tròn (KHÔNG màn trắng)
 * vì mọi nút thắt (`flushSync`, `backdrop-blur-sm`, `will-change` x50, selector `*`, `color-scheme`) đã được gỡ sạch.
 */
function runWebViewTransitionRipple(
  applyVisualChange: () => void,
  x: number,
  y: number,
  accentColor: string,
  onFinished?: () => void
): void {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const endRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));

  if (!doc.startViewTransition) {
    applyVisualChange();
    spawnHollowAccentHalo(x, y, endRadius, accentColor);
    onFinished?.();
    return;
  }

  const rootEl = document.documentElement;
  const myToken = ++activeTransitionToken;
  const DURATION = 500;
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    if (myToken !== activeTransitionToken) return;
    rootEl.classList.remove('theme-rippling');
    onFinished?.();
  };

  try {
    rootEl.classList.add('theme-rippling');

    const transition = doc.startViewTransition(() => {
      applyVisualChange();
    });

    transition.ready
      .then(() => {
        if (myToken !== activeTransitionToken) return;
        rootEl.classList.remove('theme-rippling');
        rootEl.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${Math.ceil(endRadius)}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: DURATION,
            easing: EASING,
            fill: 'both',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      })
      .catch(() => {
        finalize();
      });

    transition.finished.finally(() => {
      finalize();
    });
  } catch {
    applyVisualChange();
    finalize();
  }
}

export function runThemeRippleTransition(
  applyVisualChange: () => void,
  options?: ThemeRippleOptions
): void {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) {
    applyVisualChange();
    options?.onFinished?.();
    return;
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = options?.x ?? lastPointerPoint?.x ?? vw / 2;
  const y = options?.y ?? lastPointerPoint?.y ?? vh / 2;
  const accentColor = options?.accentColor || '#38BDF8';

  // Ưu tiên 1: Trên iPad / iPhone (.ipa) -> chạy 100% bằng Swift Native CoreAnimation (Metal 120Hz)
  if (isNativeMotionAvailable()) {
    void runNativeThemeRipple(applyVisualChange, {
      x,
      y,
      accentHex: accentColor,
      durationSec: 0.54,
      onFinished: options?.onFinished
    }).then((usedNative) => {
      if (!usedNative) {
        runWebViewTransitionRipple(applyVisualChange, x, y, accentColor, options?.onFinished);
      }
    });
    return;
  }

  // Ưu tiên 2: Trên trình duyệt Web -> View Transition siêu nhẹ lộ trực tiếp UI mới trong vòng tròn
  runWebViewTransitionRipple(applyVisualChange, x, y, accentColor, options?.onFinished);
}
