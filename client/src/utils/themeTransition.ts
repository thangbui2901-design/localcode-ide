/**
 * Hiệu ứng đổi Theme lan tỏa hình tròn từ đúng vị trí ngón tay / con trỏ bấm (kiểu Telegram iOS)
 * sử dụng View Transitions API gốc trên Chrome / Safari iOS 18+ / iPadOS 18+.
 */

let lastPointerPoint: { x: number; y: number } | null = null;
let pointerTrackerAttached = false;

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
}

export function runThemeRippleTransition(
  applyChange: () => void,
  origin?: { x: number; y: number }
): void {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (!doc.startViewTransition || prefersReduced) {
    applyChange();
    return;
  }

  const x = origin?.x ?? lastPointerPoint?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? lastPointerPoint?.y ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  try {
    const transition = doc.startViewTransition(() => {
      applyChange();
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${Math.ceil(endRadius)}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 520,
            easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      })
      .catch(() => {
        // Bỏ qua nếu trình duyệt hủy transition
      });
  } catch {
    applyChange();
  }
}
