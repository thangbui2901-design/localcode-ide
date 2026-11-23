import type React from 'react';

export type AccentColorId = 'auto' | 'blue' | 'emerald' | 'violet' | 'pink' | 'amber' | 'cyan';

export type WallpaperPresetId =
  | 'none'
  | 'aurora-navy'
  | 'deep-ocean'
  | 'nebula-violet'
  | 'emerald-mist'
  | 'sunset-dusk'
  | 'custom';

export interface VisualPreferences {
  accentColor: AccentColorId;
  wallpaperPreset: WallpaperPresetId;
  customWallpaper: string | null;
  glassBlur: number; // 0..28 px
  glassOpacity: number; // 55..96 (%)
  glowCaret: boolean;
}

export interface AccentPreset {
  id: AccentColorId;
  label: string;
  primary: string;
  secondary: string;
  glow: string;
  activeBg: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'auto',
    label: 'Theo Theme',
    primary: '#3B82F6',
    secondary: '#38BDF8',
    glow: 'rgba(59, 130, 246, 0.36)',
    activeBg: 'rgba(59, 130, 246, 0.18)'
  },
  {
    id: 'blue',
    label: 'Xanh Dương',
    primary: '#3B82F6',
    secondary: '#60A5FA',
    glow: 'rgba(59, 130, 246, 0.42)',
    activeBg: 'rgba(59, 130, 246, 0.2)'
  },
  {
    id: 'cyan',
    label: 'Ngọc Lam',
    primary: '#06B6D4',
    secondary: '#38BDF8',
    glow: 'rgba(6, 182, 212, 0.42)',
    activeBg: 'rgba(6, 182, 212, 0.2)'
  },
  {
    id: 'emerald',
    label: 'Lục Bảo',
    primary: '#10B981',
    secondary: '#34D399',
    glow: 'rgba(16, 185, 129, 0.42)',
    activeBg: 'rgba(16, 185, 129, 0.2)'
  },
  {
    id: 'violet',
    label: 'Tím Neon',
    primary: '#8B5CF6',
    secondary: '#C084FC',
    glow: 'rgba(139, 92, 246, 0.42)',
    activeBg: 'rgba(139, 92, 246, 0.2)'
  },
  {
    id: 'pink',
    label: 'Hồng Sakura',
    primary: '#EC4899',
    secondary: '#F472B6',
    glow: 'rgba(236, 72, 153, 0.42)',
    activeBg: 'rgba(236, 72, 153, 0.2)'
  },
  {
    id: 'amber',
    label: 'Hoàng Hôn',
    primary: '#F59E0B',
    secondary: '#FB923C',
    glow: 'rgba(245, 158, 11, 0.42)',
    activeBg: 'rgba(245, 158, 11, 0.2)'
  }
];

export interface WallpaperPresetItem {
  id: Exclude<WallpaperPresetId, 'custom'>;
  label: string;
  background: string;
}

export const WALLPAPER_PRESETS: WallpaperPresetItem[] = [
  {
    id: 'none',
    label: 'Mặc định',
    background: 'none'
  },
  {
    id: 'aurora-navy',
    label: 'Aurora Đêm',
    background:
      'radial-gradient(ellipse at 18% 18%, rgba(56, 189, 248, 0.42) 0%, transparent 52%), radial-gradient(ellipse at 82% 24%, rgba(99, 102, 241, 0.4) 0%, transparent 50%), radial-gradient(ellipse at 55% 88%, rgba(16, 185, 129, 0.34) 0%, transparent 54%), linear-gradient(145deg, #060916 0%, #0d1632 55%, #071221 100%)'
  },
  {
    id: 'deep-ocean',
    label: 'Biển Sâu',
    background:
      'radial-gradient(circle at 20% 80%, rgba(14, 165, 233, 0.42) 0%, transparent 55%), radial-gradient(circle at 80% 15%, rgba(45, 212, 191, 0.34) 0%, transparent 48%), linear-gradient(160deg, #040d1a 0%, #0a2240 52%, #051326 100%)'
  },
  {
    id: 'nebula-violet',
    label: 'Tinh Vân Tím',
    background:
      'radial-gradient(circle at 22% 25%, rgba(168, 85, 247, 0.44) 0%, transparent 52%), radial-gradient(circle at 78% 76%, rgba(236, 72, 153, 0.36) 0%, transparent 52%), linear-gradient(135deg, #0c071b 0%, #1d103a 52%, #110924 100%)'
  },
  {
    id: 'emerald-mist',
    label: 'Rừng Sương',
    background:
      'radial-gradient(circle at 75% 20%, rgba(52, 211, 153, 0.38) 0%, transparent 52%), radial-gradient(circle at 20% 85%, rgba(14, 165, 233, 0.32) 0%, transparent 50%), linear-gradient(150deg, #04100d 0%, #0a251f 55%, #061412 100%)'
  },
  {
    id: 'sunset-dusk',
    label: 'Hoàng Hôn',
    background:
      'radial-gradient(circle at 25% 20%, rgba(251, 146, 60, 0.4) 0%, transparent 52%), radial-gradient(circle at 78% 78%, rgba(236, 72, 153, 0.38) 0%, transparent 55%), linear-gradient(145deg, #170a18 0%, #2b132a 50%, #110b1f 100%)'
  }
];

const STORAGE_KEY = 'codeide_visual_prefs_v1';

export const DEFAULT_VISUAL_PREFS: VisualPreferences = {
  accentColor: 'auto',
  wallpaperPreset: 'none',
  customWallpaper: null,
  glassBlur: 18,
  glassOpacity: 78,
  glowCaret: true
};

export function loadVisualPreferences(): VisualPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISUAL_PREFS;
    const parsed = JSON.parse(raw) as Partial<VisualPreferences>;
    return {
      accentColor: parsed.accentColor || 'auto',
      wallpaperPreset: parsed.wallpaperPreset || 'none',
      customWallpaper: typeof parsed.customWallpaper === 'string' ? parsed.customWallpaper : null,
      glassBlur:
        typeof parsed.glassBlur === 'number'
          ? Math.min(28, Math.max(0, parsed.glassBlur))
          : DEFAULT_VISUAL_PREFS.glassBlur,
      glassOpacity:
        typeof parsed.glassOpacity === 'number'
          ? Math.min(96, Math.max(52, parsed.glassOpacity))
          : DEFAULT_VISUAL_PREFS.glassOpacity,
      glowCaret: typeof parsed.glowCaret === 'boolean' ? parsed.glowCaret : true
    };
  } catch {
    return DEFAULT_VISUAL_PREFS;
  }
}

export function saveVisualPreferences(prefs: VisualPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Nếu ảnh quá lớn vượt localStorage, lưu cấu hình không kèm customWallpaper
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...prefs, customWallpaper: null, wallpaperPreset: 'aurora-navy' })
      );
    } catch {
      // Bỏ qua
    }
  }
}

/**
 * Nén ảnh người dùng chọn từ Album iPhone/iPad về tối đa 1400px JPEG để lưu mượt & không tốn RAM.
 */
export function compressWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không đọc được ảnh nền'));
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function resolveWallpaperStyle(prefs: VisualPreferences): React.CSSProperties | null {
  if (prefs.wallpaperPreset === 'none') return null;
  if (prefs.wallpaperPreset === 'custom' && prefs.customWallpaper) {
    return {
      backgroundImage: `url("${prefs.customWallpaper}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }
  const found = WALLPAPER_PRESETS.find((w) => w.id === prefs.wallpaperPreset);
  if (!found || found.background === 'none') return null;
  return { background: found.background };
}
