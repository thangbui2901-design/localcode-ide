/**
 * Cầu nối TypeScript tới Swift Native Motion Engine (`NativeMotionPlugin.swift`)
 * Chạy trên Apple UIKit + CoreAnimation (Metal Render Server) khi mở bản .ipa trên iPad/iPhone.
 * Trên trình duyệt Web (Chrome Windows / Safari web), các hàm tự động trả về `false`
 * để giao diện chuyển mượt sang fallback Pure GPU `transform + opacity`.
 */

interface NativeMotionCapPlugin {
  captureSnapshot: () => Promise<{ captured?: boolean }>;
  revealThemeRipple: (opts: {
    x: number;
    y: number;
    duration?: number;
    accentHex?: string;
  }) => Promise<{ animated?: boolean }>;
  playPageTransition: (opts: {
    direction: 'push' | 'pop';
    duration?: number;
  }) => Promise<{ animated?: boolean }>;
  playWelcomeMagicMove: (opts: {
    srcX: number;
    srcY: number;
    srcW: number;
    srcH: number;
    dstX: number;
    dstY: number;
    dstW: number;
    dstH: number;
    bgHex: string;
    accentHex: string;
    duration?: number;
  }) => Promise<{ animated?: boolean }>;
  playConfettiBurst: () => Promise<{ animated?: boolean }>;
  syncBackdropColor: (opts: { hex: string }) => Promise<void>;
  clearOverlay: () => Promise<void>;
}

function getNativeMotionPlugin(): NativeMotionCapPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: { NativeMotion?: NativeMotionCapPlugin };
    };
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const plugin = cap.Plugins?.NativeMotion;
  if (!plugin || typeof plugin.captureSnapshot !== 'function') return null;
  return plugin;
}

export function isNativeMotionAvailable(): boolean {
  return getNativeMotionPlugin() !== null;
}

function nextTwoAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Đổi Theme 120Hz bằng Swift CoreAnimation (Metal) `evenOdd` cutout trên ảnh tĩnh WKWebView.
 * Trả về `true` nếu đã chạy trên Native Swift, `false` nếu đang ở Web browser.
 */
export async function runNativeThemeRipple(
  applyVisualChange: () => void,
  options: { x: number; y: number; accentHex: string; durationSec?: number; onFinished?: () => void }
): Promise<boolean> {
  const plugin = getNativeMotionPlugin();
  if (!plugin) return false;

  try {
    const snap = await plugin.captureSnapshot();
    if (!snap?.captured) return false;

    applyVisualChange();
    // Chờ 2 rAF để WKWebView vẽ hoàn chỉnh màu mới phía dưới tấm ảnh tĩnh Metal
    await nextTwoAnimationFrames();

    await plugin.revealThemeRipple({
      x: options.x,
      y: options.y,
      accentHex: options.accentHex,
      duration: options.durationSec ?? 0.54
    });

    options.onFinished?.();
    return true;
  } catch {
    try {
      await plugin.clearOverlay();
    } catch {
      // Bỏ qua
    }
    return false;
  }
}

/**
 * Chuyển trang Home <-> Editor chuẩn UINavigationController Parallax Spring bằng Swift Native (120Hz).
 * Trả về `true` nếu đã chạy trên Native Swift, `false` nếu đang ở Web browser.
 */
export async function runNativePageTransition(
  direction: 'push' | 'pop',
  commitNavigation: () => void,
  durationSec = 0.42
): Promise<boolean> {
  const plugin = getNativeMotionPlugin();
  if (!plugin) return false;

  try {
    const snap = await plugin.captureSnapshot();
    if (!snap?.captured) {
      commitNavigation();
      return false;
    }

    commitNavigation();
    await nextTwoAnimationFrames();

    await plugin.playPageTransition({ direction, duration: durationSec });
    return true;
  } catch {
    commitNavigation();
    try {
      await plugin.clearOverlay();
    } catch {
      // Bỏ qua
    }
    return false;
  }
}

/**
 * Hiệu ứng Welcome Screen -> Home Magic Move bằng Swift Native CoreAnimation:
 * Chụp logo Retina trực tiếp từ Metal framebuffer và bay khớp 1:1 vào góc Header Home.
 */
export async function runNativeWelcomeMagicMove(options: {
  srcRect: DOMRect;
  dstRect: DOMRect;
  bgHex: string;
  accentHex: string;
  durationSec?: number;
  onRevealStart: () => void;
  onComplete: () => void;
}): Promise<boolean> {
  const plugin = getNativeMotionPlugin();
  if (!plugin) return false;

  try {
    const promise = plugin.playWelcomeMagicMove({
      srcX: options.srcRect.left,
      srcY: options.srcRect.top,
      srcW: options.srcRect.width,
      srcH: options.srcRect.height,
      dstX: options.dstRect.left,
      dstY: options.dstRect.top,
      dstW: options.dstRect.width,
      dstH: options.dstRect.height,
      bgHex: options.bgHex,
      accentHex: options.accentHex,
      duration: options.durationSec ?? 0.66
    });

    // Cho Swift 1 frame để đắp lớp Curtain + Retina Logo lên trên rồi gỡ Web Splash ngay phía dưới
    window.requestAnimationFrame(() => {
      options.onRevealStart();
    });

    await promise;
    options.onComplete();
    return true;
  } catch {
    try {
      await plugin.clearOverlay();
    } catch {
      // Bỏ qua
    }
    return false;
  }
}

/**
 * Pháo giấy chúc mừng bằng Apple Metal `CAEmitterLayer` (siêu mượt 120Hz, 0 DOM node).
 */
export function playNativeConfettiBurst(): boolean {
  const plugin = getNativeMotionPlugin();
  if (!plugin) return false;
  void plugin.playConfettiBurst().catch(() => {});
  return true;
}

/**
 * Đồng bộ màu nền cửa sổ native UIKit / WKWebView khi đổi Theme để không chớp cạnh lúc xoay ngang hay Split View.
 */
export function syncNativeBackdropColor(hex: string): void {
  const plugin = getNativeMotionPlugin();
  if (!plugin) return;
  void plugin.syncBackdropColor({ hex }).catch(() => {});
}
