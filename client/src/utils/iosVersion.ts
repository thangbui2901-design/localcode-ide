export type LiquidGlassPreference = 'auto' | 'always' | 'off';

const STORAGE_KEY = 'codeide_liquid_glass_mode';

/**
 * Phát hiện phiên bản chính (major version) của iOS / iPadOS từ User-Agent.
 * Trả về null nếu không phải thiết bị iOS/iPadOS.
 */
export function getIOSMajorVersion(): number | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';

  const isIPhoneOrIPod = /iPhone|iPod/i.test(ua);
  const isIPad =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);

  if (!isIPhoneOrIPod && !isIPad) return null;

  // Ví dụ: "CPU iPhone OS 26_0 like Mac OS X" hoặc "CPU OS 26_1 like Mac OS X"
  const osMatch = ua.match(/OS (\d+)[_.](\d+)/i);
  if (osMatch) {
    return parseInt(osMatch[1], 10);
  }

  // iPadOS ở chế độ Desktop Safari có dạng "Version/26.0 Safari/..."
  const versionMatch = ua.match(/Version\/(\d+)(?:\.\d+)?/i);
  if (versionMatch) {
    return parseInt(versionMatch[1], 10);
  }

  return null;
}

export function isIOS26OrLater(): boolean {
  const major = getIOSMajorVersion();
  return major !== null && major >= 26;
}

export function isRealIOSDevice(): boolean {
  return getIOSMajorVersion() !== null;
}

export function getSavedLiquidGlassPreference(): LiquidGlassPreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || saved === 'always' || saved === 'off') {
      return saved;
    }
  } catch {
    // Bỏ qua lỗi storage
  }
  return 'auto';
}

export function saveLiquidGlassPreference(pref: LiquidGlassPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Bỏ qua lỗi storage
  }
}

/**
 * Xác định có bật hiệu ứng Liquid Glass hay không:
 * - 'always': luôn bật trên mọi thiết bị
 * - 'off': luôn dùng thanh điều hướng cổ điển
 * - 'auto': tự động bật cho iOS/iPadOS 26+ và bản xem trước trên trình duyệt Desktop/Web;
 *           trên iOS cũ hơn (< 26) tự chuyển sang kiểu cổ điển nhẹ mượt.
 */
export function shouldEnableLiquidGlass(pref: LiquidGlassPreference): boolean {
  if (pref === 'always') return true;
  if (pref === 'off') return false;
  if (isIOS26OrLater()) return true;
  // Trên Desktop Web preview bật sẵn để người dùng xem trước hiệu ứng Liquid Glass
  return !isRealIOSDevice();
}
