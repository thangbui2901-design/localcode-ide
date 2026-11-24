import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Palette,
  Cpu,
  Code2,
  Database,
  Download,
  Upload,
  Check,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  ImagePlus,
  FolderSync,
  RefreshCw,
  WifiOff,
  Sparkles
} from 'lucide-react';
import { CompilerSettings, CppCompilerEngine, EditorSettings, ExecutionMode } from '../types/ide';
import {
  playSoftKeyClick,
  KeySoundProfile,
  getSavedSoundProfile,
  getSavedSoundVolume
} from '../services/typingSound';
import {
  ACCENT_PRESETS,
  WALLPAPER_PRESETS,
  VisualPreferences,
  compressWallpaperFile
} from '../utils/visualPrefs';
import {
  hapticLight,
  isIosFilesAutoMirrorEnabled,
  isNativeIosFilesSyncAvailable,
  setIosFilesAutoMirrorEnabled
} from '../utils/iosNative';
import { UI_THEMES, UiThemeId } from '../utils/themes';

export type { UiThemeId };
export type UiDensity = 'bento' | 'compact';

type SettingsTab = 'appearance' | 'editor' | 'compiler' | 'data';

const SOUND_PROFILES: Array<{ id: KeySoundProfile; label: string }> = [
  { id: 'waterdrop', label: 'Giọt nước' },
  { id: 'creamy', label: 'Creamy' },
  { id: 'typewriter', label: 'Marimba' }
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  mode: ExecutionMode;
  onChangeMode: (mode: ExecutionMode) => void;
  editorSettings: EditorSettings;
  onUpdateEditor: React.Dispatch<React.SetStateAction<EditorSettings>>;
  compilerSettings: CompilerSettings;
  onUpdateCompiler: (next: CompilerSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  uiTheme?: UiThemeId;
  onChangeUiTheme?: (theme: UiThemeId) => void;
  uiDensity?: UiDensity;
  onChangeUiDensity?: (density: UiDensity) => void;
  typingSound?: boolean;
  onChangeTypingSound?: (enabled: boolean) => void;
  hapticsEnabled?: boolean;
  onChangeHapticsEnabled?: (enabled: boolean) => void;
  onSyncDeviceFiles?: () => void;
  isSyncingFiles?: boolean;
  onPreloadOfflineCpp?: () => void;
  offlineCppState?: 'idle' | 'loading' | 'ready';
  offlineCppPercent?: number;
  visualPrefs?: VisualPreferences;
  onUpdateVisualPrefs?: (patch: Partial<VisualPreferences>) => void;
}

interface IOSSwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const IOSSwitchRow: React.FC<IOSSwitchRowProps> = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors"
  >
    <div className="min-w-0">
      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {label}
      </div>
      {description && (
        <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </div>
      )}
    </div>

    <span
      style={{
        backgroundColor: checked ? '#10B981' : 'var(--bg-hover)'
      }}
      className="w-11 h-6 rounded-full p-0.5 flex items-center transition-colors duration-200 shrink-0"
    >
      <span
        style={{ transition: 'transform 0.3s var(--ease-ios-bounce)' }}
        className={`w-5 h-5 rounded-full bg-white shadow-sm ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  mode,
  onChangeMode,
  editorSettings,
  onUpdateEditor,
  compilerSettings,
  onUpdateCompiler,
  onExportBackup,
  onImportBackup,
  uiTheme = 'midnight-indigo',
  onChangeUiTheme,
  uiDensity = 'bento',
  onChangeUiDensity,
  typingSound = true,
  onChangeTypingSound,
  hapticsEnabled = true,
  onChangeHapticsEnabled,
  onSyncDeviceFiles,
  isSyncingFiles = false,
  onPreloadOfflineCpp,
  offlineCppState = 'idle',
  offlineCppPercent = 0,
  visualPrefs,
  onUpdateVisualPrefs
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [soundProfile, setSoundProfile] = useState<KeySoundProfile>(() => getSavedSoundProfile());
  const [soundVolume, setSoundVolume] = useState<number>(() => getSavedSoundVolume());
  const [iosAutoMirror, setIosAutoMirror] = useState<boolean>(() => isIosFilesAutoMirrorEnabled());
  const [themeFilter, setThemeFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const dragStartRef = useRef<{ y: number; time: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setClosing(false);
      setDragY(0);
      setIsDragging(false);
      return;
    }
    setClosing(false);
    setDragY(0);
    setIsDragging(false);
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const requestAnimatedClose = () => {
    if (closing) return;
    setClosing(true);
    setIsDragging(false);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 260);
  };

  const handleSheetPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStartRef.current = { y: e.clientY, time: performance.now() };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const rawDelta = e.clientY - dragStartRef.current.y;
    // Mượt 1:1 khi kéo xuống, đàn hồi nhẹ kiểu iOS khi kéo ngược lên
    const nextY = rawDelta < 0 ? Math.round(rawDelta * 0.16) : rawDelta;
    setDragY(nextY);
  };

  const handleSheetPointerUp = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const rawDelta = e.clientY - start.y;
    const elapsed = Math.max(16, performance.now() - start.time);
    const velocity = rawDelta / elapsed; // px / ms
    dragStartRef.current = null;
    setIsDragging(false);

    if (rawDelta > 95 || (rawDelta > 35 && velocity > 0.55)) {
      requestAnimatedClose();
    } else {
      setDragY(0);
    }
  };

  const handleUploadWallpaper = async (file: File) => {
    if (!onUpdateVisualPrefs) return;
    try {
      const dataUrl = await compressWallpaperFile(file);
      onUpdateVisualPrefs({
        wallpaperPreset: 'custom',
        customWallpaper: dataUrl
      });
    } catch {
      // Bỏ qua nếu không đọc được ảnh
    }
  };

  const handleSelectProfile = (p: KeySoundProfile) => {
    setSoundProfile(p);
    localStorage.setItem('codeide_sound_profile', p);
    playSoftKeyClick('normal', p, soundVolume);
  };

  const handleChangeVolume = (nextVol: number, preview = false) => {
    const clamped = Math.min(1, Math.max(0, nextVol));
    setSoundVolume(clamped);
    localStorage.setItem('codeide_sound_volume', String(clamped));
    if (preview && clamped > 0) {
      playSoftKeyClick('normal', soundProfile, clamped);
    }
  };

  const volumePercent = Math.round(soundVolume * 100);

  const navItems: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; color: string }> = [
    { id: 'appearance', label: 'Giao diện', icon: <Palette size={15} />, color: '#3B82F6' },
    { id: 'editor', label: 'Soạn thảo', icon: <Code2 size={15} />, color: '#10B981' },
    { id: 'compiler', label: 'Biên dịch', icon: <Cpu size={15} />, color: '#8B5CF6' },
    { id: 'data', label: 'Dữ liệu', icon: <Database size={15} />, color: '#F59E0B' }
  ];

  const backdropOpacity = closing
    ? 0
    : !entered
      ? 0
      : Math.max(0.18, 1 - Math.max(0, dragY) / 420);

  const sheetTransform = closing
    ? 'translate3d(0, 100%, 0)'
    : !entered
      ? 'translate3d(0, 48px, 0) scale(0.97)'
      : `translate3d(0, ${dragY}px, 0)`;

  return (
    <div
      onClick={requestAnimatedClose}
      style={{
        opacity: backdropOpacity,
        transition: isDragging ? 'none' : 'opacity 0.28s var(--ease-ios-out)'
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border-subtle)',
          transform: sheetTransform,
          opacity: !entered && !closing ? 0 : 1,
          transition: isDragging
            ? 'none'
            : closing
              ? 'transform 0.26s var(--ease-ios-spring), opacity 0.22s ease'
              : 'transform 0.36s var(--ease-ios-spring), opacity 0.24s var(--ease-ios-out)',
          willChange: 'transform, opacity'
        }}
        className="w-full sm:max-w-2xl h-[86vh] sm:h-[600px] max-h-[88vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
      >
        {/* MOBILE HEADER (< md): TOÀN BỘ VÙNG ĐẦU KÉO XUỐNG MƯỢT NHƯ iOS SHEET */}
        <div
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-subtle)'
          }}
          className="md:hidden shrink-0"
        >
          <div
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
            className="touch-none cursor-grab active:cursor-grabbing"
            title="Vuốt xuống để đóng"
          >
            <div className="pt-2.5 pb-1 flex justify-center">
              <span
                className="w-10 h-1 rounded-full opacity-45"
                style={{ backgroundColor: 'var(--text-secondary)' }}
              />
            </div>

            <div className="h-12 px-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/app-logo.png"
                  alt="Code With You"
                  className="w-6 h-6 rounded-lg object-contain shrink-0 pointer-events-none"
                />
                <h2 className="text-base font-bold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                  Cài đặt
                </h2>
              </div>

              <button
                type="button"
                onClick={requestAnimatedClose}
                style={{ color: 'var(--accent-primary)' }}
                className="px-2 py-1 text-sm font-semibold active:opacity-60 transition-opacity shrink-0"
              >
                Xong
              </button>
            </div>
          </div>

          <div className="px-3.5 pb-3">
            <div
              style={{ backgroundColor: 'var(--bg-panel-alt)' }}
              className="p-1 rounded-2xl grid grid-cols-4 gap-1"
            >
              {navItems.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                    className="py-1.5 px-1 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all"
                  >
                    <span style={{ color: active ? tab.color : undefined }}>{tab.icon}</span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BODY: iPadOS / macOS 2-COLUMN SPLIT ON md+, SINGLE CLEAN SCROLL ON MOBILE */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT SIDEBAR RAIL (iPad & Desktop) — CHẠY SUỐT TỪ ĐỈNH XUỐNG ĐÁY CHUẨN iPadOS */}
          <aside
            style={{
              backgroundColor: 'var(--bg-panel)',
              borderRight: '1px solid var(--border-subtle)'
            }}
            className="hidden md:flex w-52 shrink-0 flex-col p-3.5 gap-1"
          >
            <div className="px-2 pt-1 pb-3.5 flex items-center gap-2.5">
              <img
                src="/app-logo.png"
                alt="Code With You"
                className="w-7 h-7 rounded-lg object-contain shrink-0"
              />
              <h2 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Cài đặt
              </h2>
            </div>

            {navItems.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}
                  className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition-all text-left hover:bg-[var(--bg-elevated)]/60"
                >
                  <span
                    style={{
                      backgroundColor: active ? tab.color : 'var(--bg-elevated)',
                      color: active ? '#FFFFFF' : tab.color
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="mt-auto pt-3 px-2 text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Tự động lưu mọi thay đổi.
            </div>
          </aside>

          {/* RIGHT DETAIL COLUMN */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Desktop/iPad Clean Right Pane Header */}
            <div
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
              className="hidden md:flex h-14 px-6 items-center justify-between gap-3 shrink-0"
            >
              <h3 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {navItems.find((n) => n.id === activeTab)?.label}
              </h3>

              <button
                type="button"
                onClick={requestAnimatedClose}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)'
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] btn-lift"
                title="Đóng Cài đặt (Esc)"
              >
                <X size={15} strokeWidth={2.2} />
              </button>
            </div>

            <div
              key={activeTab}
              className="flex-1 min-w-0 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-5 tab-content-enter"
            >
            {/* ==================== TAB 1: GIAO DIỆN ==================== */}
            {activeTab === 'appearance' && (
              <>
                <div className="space-y-2.5">
                  <div className="px-1 flex items-center justify-between gap-2 flex-wrap">
                    <div
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Chủ đề màu sắc ({UI_THEMES.length} Theme)
                    </div>
                    <div
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      className="p-0.5 rounded-xl flex items-center gap-0.5"
                    >
                      {(
                        [
                          { id: 'all', label: `Tất cả (${UI_THEMES.length})` },
                          { id: 'dark', label: `Tối (${UI_THEMES.filter((t) => t.mode === 'dark').length})` },
                          { id: 'light', label: `Sáng (${UI_THEMES.filter((t) => t.mode === 'light').length})` }
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setThemeFilter(tab.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                            themeFilter === tab.id
                              ? 'accent-pill-active'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visual Mini-Preview Theme Grid with Authentic Syntax Swatches */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {UI_THEMES.filter(
                      (item) => themeFilter === 'all' || item.mode === themeFilter
                    ).map((item) => {
                      const isSelected = uiTheme === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onChangeUiTheme?.(item.id)}
                          style={{
                            backgroundColor: 'var(--bg-panel)',
                            border: isSelected
                              ? `2px solid ${item.accentSwatch}`
                              : '2px solid transparent'
                          }}
                          className="p-2.5 rounded-2xl text-left transition-all btn-lift space-y-2"
                        >
                          {/* Mini code preview card with real theme syntax palette */}
                          <div
                            style={{ backgroundColor: item.bgSwatch }}
                            className="h-12 rounded-xl p-2 flex flex-col justify-between relative overflow-hidden border border-black/10"
                          >
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400/80" />
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span
                                  className="block h-1.5 w-6 rounded-full"
                                  style={{ backgroundColor: `#${item.syntax.keyword}` }}
                                />
                                <span
                                  className="block h-1.5 w-8 rounded-full"
                                  style={{ backgroundColor: `#${item.syntax.type}` }}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span
                                  className="block h-1 w-9 rounded-full"
                                  style={{ backgroundColor: `#${item.syntax.string}` }}
                                />
                                <span
                                  className="block h-1 w-4 rounded-full"
                                  style={{ backgroundColor: `#${item.syntax.number}` }}
                                />
                              </div>
                            </div>
                            {isSelected && (
                              <span
                                style={{ backgroundColor: item.accentSwatch }}
                                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white"
                              >
                                <Check size={10} strokeWidth={3} />
                              </span>
                            )}
                          </div>

                          <div className="px-0.5 flex items-center justify-between gap-1">
                            <span
                              className="text-xs font-semibold truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {item.name}
                            </span>
                            <span
                              className="text-[10px] shrink-0"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {item.mode === 'dark' ? 'Dark' : 'Light'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Accent Color Picker */}
                {visualPrefs && onUpdateVisualPrefs && (
                  <div className="space-y-2">
                    <div
                      className="px-1 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Màu nhấn tự do (Accent Color)
                    </div>
                    <div
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      className="rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2 flex-wrap"
                    >
                      {ACCENT_PRESETS.map((ac) => {
                        const selected = visualPrefs.accentColor === ac.id;
                        return (
                          <button
                            key={ac.id}
                            type="button"
                            onClick={() => onUpdateVisualPrefs({ accentColor: ac.id })}
                            className="flex flex-col items-center gap-1 btn-lift"
                            title={ac.label}
                          >
                            <span
                              style={{
                                background:
                                  ac.id === 'auto'
                                    ? 'conic-gradient(#3B82F6, #10B981, #8B5CF6, #EC4899, #F59E0B, #3B82F6)'
                                    : ac.primary,
                                boxShadow: selected ? `0 0 0 2.5px var(--bg-panel), 0 0 0 4.5px ${ac.primary}` : undefined
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                            >
                              {selected && <Check size={13} strokeWidth={3} className="text-white drop-shadow-xs" />}
                            </span>
                            <span
                              className="text-[10px] font-medium"
                              style={{
                                color: selected ? 'var(--text-primary)' : 'var(--text-secondary)'
                              }}
                            >
                              {ac.id === 'auto' ? 'Auto' : ac.label.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Wallpaper & Frosted Glass */}
                {visualPrefs && onUpdateVisualPrefs && (
                  <div className="space-y-2">
                    <div className="px-1 flex items-center justify-between">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Hình nền &amp; Kính mờ (Frosted Glass)
                      </span>
                      <button
                        type="button"
                        onClick={() => wallpaperInputRef.current?.click()}
                        className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                      >
                        <ImagePlus size={12} />
                        <span>Chọn ảnh Album</span>
                      </button>
                      <input
                        ref={wallpaperInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadWallpaper(f);
                          e.target.value = '';
                        }}
                      />
                    </div>

                    <div
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      className="rounded-2xl p-3 space-y-3"
                    >
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {WALLPAPER_PRESETS.map((wp) => {
                          const active = visualPrefs.wallpaperPreset === wp.id;
                          return (
                            <button
                              key={wp.id}
                              type="button"
                              onClick={() => onUpdateVisualPrefs({ wallpaperPreset: wp.id })}
                              className="flex flex-col items-center gap-1 btn-lift"
                            >
                              <div
                                style={{
                                  background:
                                    wp.id === 'none' ? 'var(--bg-elevated)' : wp.background,
                                  border: active
                                    ? '2px solid var(--accent-primary)'
                                    : '2px solid transparent'
                                }}
                                className="w-full h-11 rounded-xl flex items-center justify-center relative overflow-hidden"
                              >
                                {wp.id === 'none' && (
                                  <span
                                    className="text-[10px] font-semibold"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    Tắt
                                  </span>
                                )}
                                {active && (
                                  <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center">
                                    <Check size={10} strokeWidth={3} />
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[10px] truncate max-w-full"
                                style={{
                                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                              >
                                {wp.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {visualPrefs.wallpaperPreset === 'custom' && visualPrefs.customWallpaper && (
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[var(--bg-elevated)] text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={visualPrefs.customWallpaper}
                              alt="Custom wallpaper"
                              className="w-8 h-8 rounded-lg object-cover shrink-0"
                            />
                            <span className="truncate font-medium">Ảnh nền cá nhân đang bật</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateVisualPrefs({ wallpaperPreset: 'none' })}
                            className="text-[11px] font-semibold text-rose-400 shrink-0 px-2"
                          >
                            Gỡ
                          </button>
                        </div>
                      )}

                      {visualPrefs.wallpaperPreset !== 'none' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span style={{ color: 'var(--text-secondary)' }}>Độ mờ kính (Blur)</span>
                              <span className="font-mono font-bold">{visualPrefs.glassBlur}px</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={28}
                              step={2}
                              value={visualPrefs.glassBlur}
                              onChange={(e) =>
                                onUpdateVisualPrefs({ glassBlur: Number(e.target.value) })
                              }
                              style={{ accentColor: 'var(--accent-primary)' }}
                              className="w-full h-1.5 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span style={{ color: 'var(--text-secondary)' }}>Độ phủ nền</span>
                              <span className="font-mono font-bold">{visualPrefs.glassOpacity}%</span>
                            </div>
                            <input
                              type="range"
                              min={52}
                              max={96}
                              step={2}
                              value={visualPrefs.glassOpacity}
                              onChange={(e) =>
                                onUpdateVisualPrefs({ glassOpacity: Number(e.target.value) })
                              }
                              style={{ accentColor: 'var(--accent-primary)' }}
                              className="w-full h-1.5 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* iOS Grouped List: Layout & Sound */}
                <div className="space-y-2">
                  <div
                    className="px-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Bố cục &amp; Hiệu ứng gõ
                  </div>

                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]"
                  >
                    {visualPrefs && onUpdateVisualPrefs && (
                      <IOSSwitchRow
                        label="Con trỏ & dòng đang gõ phát sáng"
                        description="Vầng sáng dịu nổi bật vị trí đang viết code"
                        checked={visualPrefs.glowCaret}
                        onChange={(v) => onUpdateVisualPrefs({ glowCaret: v })}
                      />
                    )}
                    {onChangeUiDensity && (
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            Mật độ bố cục
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            Thẻ bo góc hoặc sát viền tối đa diện tích
                          </div>
                        </div>
                        <div
                          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                          className="p-0.5 rounded-xl flex items-center gap-0.5 shrink-0"
                        >
                          <button
                            type="button"
                            onClick={() => onChangeUiDensity('bento')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              uiDensity === 'bento'
                                ? 'accent-pill-active'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            Bento
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeUiDensity('compact')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              uiDensity === 'compact'
                                ? 'accent-pill-active'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            Compact
                          </button>
                        </div>
                      </div>
                    )}

                    <IOSSwitchRow
                      label="Âm thanh gõ phím"
                      description="Phản hồi tiếng gõ nhẹ khi lập trình"
                      checked={typingSound}
                      onChange={(v) => {
                        onChangeTypingSound?.(v);
                        if (v) playSoftKeyClick('normal', soundProfile, soundVolume);
                      }}
                    />

                    {onChangeHapticsEnabled && (
                      <IOSSwitchRow
                        label="Rung phản hồi Taptic Engine (iOS/iPadOS)"
                        description="Phản hồi xúc giác nhẹ khi chạy code, đạt AC 100%, chuyển tab & lưu tệp"
                        checked={hapticsEnabled}
                        onChange={(v) => {
                          onChangeHapticsEnabled(v);
                          if (v) hapticLight();
                        }}
                      />
                    )}

                    {typingSound && (
                      <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            Chất âm
                          </span>
                          <div className="flex items-center gap-1">
                            {SOUND_PROFILES.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectProfile(item.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                  soundProfile === item.id
                                    ? 'accent-pill-active'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleChangeVolume(soundVolume > 0 ? 0 : 0.5, true)}
                            style={{ color: 'var(--accent-primary)' }}
                            className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center shrink-0"
                          >
                            {soundVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={volumePercent}
                            onChange={(e) => handleChangeVolume(Number(e.target.value) / 100, false)}
                            onMouseUp={() => playSoftKeyClick('normal', soundProfile, soundVolume)}
                            onTouchEnd={() => playSoftKeyClick('normal', soundProfile, soundVolume)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                            className="flex-1 h-1.5 rounded-lg cursor-pointer"
                          />
                          <span
                            className="text-xs font-mono font-bold w-9 text-right tabular-nums"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {volumePercent}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ==================== TAB 2: SOẠN THẢO ==================== */}
            {activeTab === 'editor' && (
              <>
                <div className="space-y-2">
                  <div
                    className="px-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Hiển thị mã nguồn
                  </div>

                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]"
                  >
                    {/* Font Size Stepper */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Cỡ chữ (Font Size)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateEditor((prev) => ({
                              ...prev,
                              fontSize: Math.max(11, prev.fontSize - 1)
                            }))
                          }
                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center btn-lift"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center text-xs font-mono font-bold tabular-nums">
                          {editorSettings.fontSize}px
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateEditor((prev) => ({
                              ...prev,
                              fontSize: Math.min(28, prev.fontSize + 1)
                            }))
                          }
                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center btn-lift"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Tab Size Segmented */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Kích thước Tab
                      </span>
                      <div
                        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                        className="p-0.5 rounded-xl flex items-center gap-0.5"
                      >
                        {[2, 4, 8].map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => onUpdateEditor((prev) => ({ ...prev, tabSize: sz }))}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              editorSettings.tabSize === sz
                                ? 'accent-pill-active'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Family */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>
                        Font lập trình
                      </span>
                      <select
                        value={editorSettings.fontFamily}
                        onChange={(e) =>
                          onUpdateEditor((prev) => ({ ...prev, fontFamily: e.target.value }))
                        }
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                        className="h-8 px-2.5 rounded-xl text-xs font-medium outline-none cursor-pointer max-w-[180px]"
                      >
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="Cascadia Code">Cascadia Code</option>
                        <option value="Consolas, monospace">Consolas</option>
                      </select>
                    </div>

                    <IOSSwitchRow
                      label="Chế độ Bàn phím rời iPad (Ẩn phím ảo)"
                      description="Không tự bật bàn phím ảo khi chạm vào code — vẫn gõ phím Bluetooth/Magic Keyboard bình thường"
                      checked={Boolean(editorSettings.hardwareKeyboardMode)}
                      onChange={(v) =>
                        onUpdateEditor((prev) => ({ ...prev, hardwareKeyboardMode: v }))
                      }
                    />

                    <IOSSwitchRow
                      label="Tự xuống dòng (Word Wrap)"
                      description="Tránh phải cuộn ngang trên màn hình nhỏ"
                      checked={editorSettings.wordWrap === 'on'}
                      onChange={(v) =>
                        onUpdateEditor((prev) => ({ ...prev, wordWrap: v ? 'on' : 'off' }))
                      }
                    />

                    <IOSSwitchRow
                      label="Bản đồ thu nhỏ (Minimap)"
                      description="Hiển thị ở chế độ iPad ngang / Desktop"
                      checked={editorSettings.minimap}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, minimap: v }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div
                    className="px-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Tự động hóa &amp; IntelliSense
                  </div>

                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]"
                  >
                    <IOSSwitchRow
                      label="Tự động lưu (Auto Save)"
                      description="Lưu liên tục vào bộ nhớ cục bộ"
                      checked={editorSettings.autoSave}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, autoSave: v }))}
                    />
                    <IOSSwitchRow
                      label="Tự định dạng khi lưu"
                      description="Format mã nguồn khi nhấn ⌘S"
                      checked={editorSettings.formatOnSave}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, formatOnSave: v }))}
                    />
                    <IOSSwitchRow
                      label="Gợi ý cú pháp (IntelliSense)"
                      description="Gợi ý lệnh C/C++, Python, HTML/JS"
                      checked={editorSettings.quickSuggestions}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, quickSuggestions: v }))}
                    />
                    <IOSSwitchRow
                      label="Gợi ý khi gõ ký tự (. : > < #)"
                      description="Tự mở danh sách thư viện & thuộc tính"
                      checked={editorSettings.suggestOnTriggerCharacters}
                      onChange={(v) =>
                        onUpdateEditor((prev) => ({ ...prev, suggestOnTriggerCharacters: v }))
                      }
                    />
                  </div>
                </div>
              </>
            )}

            {/* ==================== TAB 3: BIÊN DỊCH ==================== */}
            {activeTab === 'compiler' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div
                    className="px-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Trình biên dịch &amp; Thực thi
                  </div>

                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]"
                  >
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          Chế độ chạy
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          iPad/iPhone dùng Cloud + WASM Offline
                        </div>
                      </div>
                      <select
                        value={mode}
                        onChange={(e) => onChangeMode(e.target.value as ExecutionMode)}
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                        className="h-8 px-2.5 rounded-xl text-xs font-medium outline-none cursor-pointer"
                      >
                        <option value="standalone">Cloud + WASM</option>
                        <option value="local">Local PC Server</option>
                      </select>
                    </div>

                    {/* Engine biên dịch C/C++ (Auto / Offline Clang WASM / Cloud GCC) */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            Engine biên dịch C/C++
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            Tự động chạy Offline LLVM Clang WASM ngay cả khi mất Wi-Fi
                          </div>
                        </div>
                        <div
                          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                          className="p-0.5 rounded-xl flex items-center gap-0.5 shrink-0"
                        >
                          {(
                            [
                              { id: 'auto', label: 'Tự động' },
                              { id: 'offline-wasm', label: 'Offline WASM' },
                              { id: 'cloud', label: 'Cloud GCC' }
                            ] as Array<{ id: CppCompilerEngine; label: string }>
                          ).map((eng) => {
                            const selected = (compilerSettings.cppEngine || 'auto') === eng.id;
                            return (
                              <button
                                key={eng.id}
                                type="button"
                                onClick={() =>
                                  onUpdateCompiler({ ...compilerSettings, cppEngine: eng.id })
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                  selected
                                    ? 'accent-pill-active'
                                    : 'text-[var(--text-secondary)]'
                                }`}
                              >
                                {eng.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Chuẩn C++
                      </span>
                      <div
                        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                        className="p-0.5 rounded-xl flex items-center gap-0.5"
                      >
                        {(['gnu++14', 'gnu++17', 'gnu++20'] as const).map((std) => (
                          <button
                            key={std}
                            type="button"
                            onClick={() => onUpdateCompiler({ ...compilerSettings, cppStandard: std })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase transition-all ${
                              compilerSettings.cppStandard === std
                                ? 'accent-pill-active'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {std.replace('gnu++', 'C++')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Chuẩn C
                      </span>
                      <div
                        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                        className="p-0.5 rounded-xl flex items-center gap-0.5"
                      >
                        {(['c99', 'c11', 'c17'] as const).map((std) => (
                          <button
                            key={std}
                            type="button"
                            onClick={() => onUpdateCompiler({ ...compilerSettings, cStandard: std })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase transition-all ${
                              compilerSettings.cStandard === std
                                ? 'accent-pill-active'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {std}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-1.5">
                      <label
                        className="block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Compiler API Endpoint
                      </label>
                      <input
                        type="text"
                        value={compilerSettings.pistonUrl || ''}
                        onChange={(e) =>
                          onUpdateCompiler({ ...compilerSettings, pistonUrl: e.target.value })
                        }
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                        className="w-full h-9 px-3 rounded-xl text-xs font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Offline Clang/LLVM WASM Preload Card */}
                {onPreloadOfflineCpp && (
                  <div className="space-y-2">
                    <div
                      className="px-1 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Biên dịch C/C++ Ngoại tuyến (100% Offline)
                    </div>
                    <div
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      className="rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            <WifiOff size={14} className="text-emerald-400 shrink-0" />
                            <span>LLVM Clang + WASI Runtime</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Hỗ trợ <code className="font-mono">#include &lt;bits/stdc++.h&gt;</code>, nhập <code className="font-mono">cin/scanf</code> từng dòng và đọc/ghi tệp <code className="font-mono">.txt</code> trực tiếp trên chip iPad/iPhone mà không cần mạng.
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            offlineCppState === 'ready'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : offlineCppState === 'loading'
                                ? 'bg-sky-500/15 text-sky-400'
                                : 'bg-white/10 text-[var(--text-secondary)]'
                          }`}
                        >
                          {offlineCppState === 'ready'
                            ? 'Sẵn sàng Offline'
                            : offlineCppState === 'loading'
                              ? `Đang tải ${offlineCppPercent}%`
                              : 'Chưa nạp cache'}
                        </span>
                      </div>

                      {offlineCppState === 'loading' && (
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/10">
                          <div
                            style={{
                              width: `${Math.max(8, offlineCppPercent)}%`,
                              backgroundColor: 'var(--accent-primary)'
                            }}
                            className="h-full rounded-full transition-all duration-300"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={offlineCppState === 'loading'}
                        onClick={onPreloadOfflineCpp}
                        className="w-full h-10 px-4 rounded-xl accent-btn text-xs font-semibold flex items-center justify-center gap-2 btn-lift disabled:opacity-60"
                      >
                        {offlineCppState === 'loading' ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Đang tải &amp; lưu bộ nhớ đệm ({offlineCppPercent}%)...</span>
                          </>
                        ) : offlineCppState === 'ready' ? (
                          <>
                            <Sparkles size={14} />
                            <span>Kiểm tra / Nạp lại Clang WASM Offline</span>
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            <span>Tải sẵn trình biên dịch C/C++ Offline</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 4: DỮ LIỆU & THÔNG TIN ==================== */}
            {activeTab === 'data' && (
              <>
                {onSyncDeviceFiles && (
                  <div className="space-y-2">
                    <div
                      className="px-1 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Ứng dụng Tệp (iOS / iPadOS Files App)
                    </div>

                    <div
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]"
                    >
                      <IOSSwitchRow
                        label="Tự động phản chiếu tệp ra app Tệp (Files)"
                        description="Mỗi lần lưu, tệp tự hiện tại Tệp → Trên iPad/iPhone của tôi → Code With You"
                        checked={iosAutoMirror}
                        onChange={(v) => {
                          setIosAutoMirror(v);
                          setIosFilesAutoMirrorEnabled(v);
                          hapticLight();
                        }}
                      />

                      <div className="p-4 space-y-3">
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {isNativeIosFilesSyncAvailable()
                            ? 'Bấm Đồng bộ 2 chiều để kéo các tệp bạn mới chép vào thư mục "Code With You" trong app Tệp (Files / iCloud / AirDrop) và đẩy toàn bộ dự án hiện tại ra app Tệp.'
                            : 'Trên app iPad/iPhone (IPA), tính năng này đồng bộ 2 chiều trực tiếp với app Tệp (Files). Trên trình duyệt máy tính (Chrome/Edge), bạn có thể chọn một thư mục cục bộ để đồng bộ.'}
                        </p>
                        <button
                          type="button"
                          disabled={isSyncingFiles}
                          onClick={onSyncDeviceFiles}
                          className="w-full h-11 px-4 rounded-xl accent-btn text-xs font-semibold flex items-center justify-center gap-2 btn-lift disabled:opacity-60"
                        >
                          {isSyncingFiles ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" />
                              <span>Đang đồng bộ 2 chiều...</span>
                            </>
                          ) : (
                            <>
                              <FolderSync size={15} />
                              <span>
                                {isNativeIosFilesSyncAvailable()
                                  ? 'Đồng bộ 2 chiều với app Tệp (Files)'
                                  : 'Đồng bộ với thư mục trên thiết bị'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div
                    className="px-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Sao lưu &amp; Khôi phục Workspace
                  </div>

                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="rounded-2xl p-4 space-y-3"
                  >
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Toàn bộ dự án và tệp code được lưu trực tiếp trên máy của bạn (IndexedDB). Hãy sao lưu định kỳ ra tệp <code className="font-mono">.json</code> khi cần chuyển sang iPad mới.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={onExportBackup}
                        className="h-11 px-4 rounded-xl accent-btn text-xs font-semibold flex items-center justify-center gap-2 btn-lift"
                      >
                        <Download size={15} />
                        <span>Sao lưu (.json)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                        className="h-11 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 btn-lift"
                      >
                        <Upload size={15} className="text-emerald-400" />
                        <span>Khôi phục (.json)</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onImportBackup(f);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* App Identity Card */}
                <div
                  style={{ backgroundColor: 'var(--bg-panel)' }}
                  className="rounded-2xl p-4 flex items-center gap-3.5"
                >
                  <img
                    src="/app-logo.png"
                    alt="Code With You"
                    className="w-12 h-12 rounded-2xl object-contain shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      Code With You
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Phiên bản 2.5 • iPadOS &amp; iOS Standalone IDE
                    </div>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
