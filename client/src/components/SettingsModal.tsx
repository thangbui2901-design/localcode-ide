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
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  GraduationCap,
  Zap,
  Brain
} from 'lucide-react';
import { CompilerSettings, CppCompilerEngine, EditorSettings, ExecutionMode } from '../types/ide';
import { AiSettings, AiThinkingLevel, GEMINI_MODELS } from '../services/geminiAi';
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
import { CustomSelect } from './CustomSelect';

export type { UiThemeId };
export type UiDensity = 'bento' | 'compact';

type SettingsTab = 'appearance' | 'editor' | 'compiler' | 'ai' | 'data';

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
  aiSettings?: AiSettings;
  onUpdateAiSettings?: (patch: Partial<AiSettings>) => void;
}

const HAIRLINE_COLOR = 'color-mix(in srgb, var(--text-primary) 6%, transparent)';

/** Nhóm thẻ cài đặt tinh gọn theo phong cách macOS Sequoia / Apple Settings (0% viền cứng) */
const SettingsGroup: React.FC<{
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <section className="space-y-2">
    {(title || action) && (
      <div className="px-1 flex items-center justify-between gap-2 flex-wrap">
        {title && (
          <h4
            className="text-[11.5px] font-semibold tracking-tight"
            style={{ color: 'var(--text-secondary)' }}
          >
            {title}
          </h4>
        )}
        {action}
      </div>
    )}
    <div
      style={{ backgroundColor: 'var(--bg-panel)' }}
      className="rounded-2xl overflow-hidden"
    >
      {children}
    </div>
  </section>
);

const RowDivider: React.FC = () => (
  <div className="mx-4 h-px" style={{ backgroundColor: HAIRLINE_COLOR }} />
);

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
    className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between gap-4 text-left hover:bg-[var(--bg-panel-alt)]/65 transition-colors"
  >
    <div className="min-w-0 flex items-baseline gap-2">
      <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      {description && (
        <span
          className="text-[11px] truncate opacity-75"
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </span>
      )}
    </div>

    <span
      style={{
        backgroundColor: checked ? 'var(--accent-primary)' : 'var(--bg-elevated)'
      }}
      className="w-[42px] h-[24px] rounded-full p-[3px] flex items-center transition-colors duration-200 shrink-0"
    >
      <span
        style={{ transition: 'transform 0.28s var(--ease-ios-bounce)' }}
        className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange
}: {
  options: Array<{ id: T; label: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="ios-segment-track p-[3px] rounded-[11px] inline-flex items-center gap-0.5 shrink-0">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={String(opt.id)}
            type="button"
            onClick={() => onChange(opt.id)}
            style={active ? undefined : { color: 'var(--text-secondary)' }}
            className={`h-[26px] px-2.5 rounded-[8px] text-[11px] flex items-center gap-1 transition-all ${
              active
                ? 'ios-segment-active font-semibold'
                : 'font-medium hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const AppleSlider: React.FC<{
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  onCommit?: () => void;
}> = ({ min, max, step = 1, value, onChange, onCommit }) => {
  const pct = Math.min(100, Math.max(0, ((value - min) / Math.max(1, max - min)) * 100));
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={onCommit}
      onTouchEnd={onCommit}
      style={{
        background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${pct}%, var(--bg-elevated) ${pct}%, var(--bg-elevated) 100%)`
      }}
      className="ios-slider flex-1 w-full"
    />
  );
};

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
  onUpdateVisualPrefs,
  aiSettings,
  onUpdateAiSettings
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [showAiApiKey, setShowAiApiKey] = useState(false);
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

  const requestAnimatedClose = () => {
    if (closing) return;
    setClosing(true);
    setIsDragging(false);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 240);
  };

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestAnimatedClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const handleSheetPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStartRef.current = { y: e.clientY, time: performance.now() };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const rawDelta = e.clientY - dragStartRef.current.y;
    const nextY = rawDelta < 0 ? Math.round(rawDelta * 0.16) : rawDelta;
    setDragY(nextY);
  };

  const handleSheetPointerUp = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const rawDelta = e.clientY - start.y;
    const elapsed = Math.max(16, performance.now() - start.time);
    const velocity = rawDelta / elapsed;
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
  const isApplePlatform =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

  const navItems: Array<{
    id: SettingsTab;
    label: string;
    subtitle: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'appearance',
      label: 'Giao diện',
      subtitle: 'Chủ đề màu sắc, kính mờ và cảm giác gõ phím',
      mobileLabel: 'Giao diện',
      icon: <Palette size={15} />
    },
    {
      id: 'editor',
      label: 'Soạn thảo',
      subtitle: 'Phông chữ, bố cục editor và gợi ý mã nguồn',
      mobileLabel: 'Soạn thảo',
      icon: <Code2 size={15} />
    },
    {
      id: 'compiler',
      label: 'Biên dịch',
      subtitle: 'Trình biên dịch C/C++, chuẩn ngôn ngữ & Offline WASM',
      mobileLabel: 'Biên dịch',
      icon: <Cpu size={15} />
    },
    {
      id: 'ai',
      label: 'Trợ lý AI',
      subtitle: 'Kết nối Gemini API, chọn model & mức suy luận',
      mobileLabel: 'AI',
      icon: <Sparkles size={15} />
    },
    {
      id: 'data',
      label: 'Dữ liệu',
      subtitle: 'Đồng bộ tệp iPadOS, sao lưu & thông tin ứng dụng',
      mobileLabel: 'Dữ liệu',
      icon: <Database size={15} />
    }
  ];

  const activeNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  const backdropOpacity = closing
    ? 0
    : !entered
      ? 0
      : Math.max(0.18, 1 - Math.max(0, dragY) / 420);

  const sheetTransform = closing
    ? 'translate3d(0, 100%, 0)'
    : !entered
      ? 'translate3d(0, 32px, 0) scale(0.975)'
      : `translate3d(0, ${dragY}px, 0)`;

  return (
    <div
      onClick={requestAnimatedClose}
      style={{
        opacity: backdropOpacity,
        transition: isDragging ? 'none' : 'opacity 0.24s var(--ease-ios-out)'
      }}
      className="fixed inset-0 z-50 bg-black/52 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          color: 'var(--text-primary)',
          boxShadow:
            '0 28px 80px -20px rgba(0, 0, 0, 0.52), 0 0 0 1px color-mix(in srgb, var(--text-primary) 7%, transparent)',
          transform: sheetTransform,
          opacity: !entered && !closing ? 0 : 1,
          transition: isDragging
            ? 'none'
            : closing
              ? 'transform 0.24s var(--ease-ios-spring), opacity 0.2s ease'
              : 'transform 0.34s var(--ease-ios-spring), opacity 0.22s var(--ease-ios-out)',
          willChange: isDragging || !entered || closing ? 'transform, opacity' : undefined
        }}
        className="w-full sm:max-w-[780px] h-[88vh] sm:h-[620px] max-h-[88vh] rounded-t-3xl sm:rounded-[24px] flex flex-col overflow-hidden"
      >
        {/* ==================== MOBILE HEADER (< md) ==================== */}
        <div style={{ backgroundColor: 'var(--bg-panel)' }} className="md:hidden shrink-0">
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
                className="w-9 h-1 rounded-full opacity-35"
                style={{ backgroundColor: 'var(--text-secondary)' }}
              />
            </div>

            <div className="h-11 px-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/app-logo.png"
                  alt="Code With You"
                  className="w-6 h-6 rounded-lg object-contain shrink-0 pointer-events-none"
                />
                <h2 className="text-[15px] font-bold tracking-tight truncate">Cài đặt</h2>
              </div>

              <button
                type="button"
                onClick={requestAnimatedClose}
                style={{ color: 'var(--accent-primary)' }}
                className="px-2 py-1 text-[13px] font-semibold active:opacity-60 transition-opacity shrink-0"
              >
                Xong
              </button>
            </div>
          </div>

          <div className="px-3.5 pb-3">
            <div
              style={{ backgroundColor: 'var(--bg-panel-alt)' }}
              className="p-1 rounded-2xl grid grid-cols-5 gap-1"
            >
              {navItems.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      backgroundColor: active ? 'var(--bg-panel)' : 'transparent',
                      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      boxShadow: active ? '0 2px 6px -2px rgba(0, 0, 0, 0.16)' : undefined
                    }}
                    className="py-1.5 px-1 rounded-xl text-[10px] font-semibold flex flex-col items-center justify-center gap-1 transition-all"
                  >
                    <span>{tab.icon}</span>
                    <span className="truncate">{tab.mobileLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== BODY: BORDERLESS MACOS 2-COLUMN SPLIT ==================== */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT SIDEBAR RAIL (iPad & Desktop) — 100% KHÔNG VIỀN, TÔNG DỊU */}
          <aside
            style={{ backgroundColor: 'var(--bg-panel)' }}
            className="hidden md:flex w-[196px] shrink-0 flex-col p-3 gap-1"
          >
            <div className="px-2.5 pt-2 pb-4 flex items-center gap-2.5">
              <img
                src="/app-logo.png"
                alt="Code With You"
                className="w-6 h-6 rounded-lg object-contain shrink-0"
              />
              <h2 className="text-[14.5px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Cài đặt
              </h2>
            </div>

            <nav className="space-y-0.5">
              {navItems.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      backgroundColor: active ? 'var(--bg-panel-alt)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                    className={`w-full h-9 px-2.5 rounded-[11px] flex items-center gap-2.5 text-[12.5px] transition-colors text-left ${
                      active
                        ? 'font-semibold'
                        : 'font-medium hover:bg-[var(--bg-panel-alt)]/55 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span
                      style={{
                        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}
                      className="shrink-0 flex items-center justify-center transition-colors"
                    >
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 px-2.5 flex items-center justify-between text-[10.5px] opacity-65">
              <span style={{ color: 'var(--text-secondary)' }}>v2.7</span>
              <span style={{ color: 'var(--text-secondary)' }}>Tự động lưu</span>
            </div>
          </aside>

          {/* RIGHT DETAIL CONTENT COLUMN */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Clean Borderless Right Header */}
            <div className="hidden md:flex h-13 px-6 pt-4 pb-2 items-center justify-between gap-4 shrink-0">
              <h3
                className="text-[16px] font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {activeNav.label}
              </h3>

              <button
                type="button"
                onClick={requestAnimatedClose}
                style={{ color: 'var(--text-secondary)' }}
                className="w-8 h-8 rounded-full hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shrink-0"
                title="Đóng Cài đặt (Esc)"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div
              key={activeTab}
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
              className="flex-1 min-w-0 overflow-y-auto no-scrollbar px-4 sm:px-6 pt-2 sm:pt-1 space-y-5 tab-content-enter"
            >
              {/* ==================== TAB 1: GIAO DIỆN ==================== */}
              {activeTab === 'appearance' && (
                <>
                  {/* Visual Studio Theme Gallery */}
                  <section className="space-y-2.5">
                    <div className="px-1 flex items-center justify-between gap-2 flex-wrap">
                      <h4
                        className="text-[11.5px] font-semibold tracking-tight"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Chủ đề màu sắc
                      </h4>
                      <SegmentedControl
                        value={themeFilter}
                        onChange={setThemeFilter}
                        options={[
                          { id: 'all', label: `Tất cả (${UI_THEMES.length})` },
                          {
                            id: 'dark',
                            label: `Tối (${UI_THEMES.filter((t) => t.mode === 'dark').length})`
                          },
                          {
                            id: 'light',
                            label: `Sáng (${UI_THEMES.filter((t) => t.mode === 'light').length})`
                          }
                        ]}
                      />
                    </div>

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
                              boxShadow: isSelected
                                ? `0 0 0 2px ${item.accentSwatch}`
                                : 'var(--shadow-card)'
                            }}
                            className="group p-2 rounded-2xl text-left hover:bg-[var(--bg-panel-alt)] active:scale-[0.98] transition-all space-y-2"
                          >
                            {/* Authentic Mini IDE Bento Preview */}
                            <div
                              style={{ backgroundColor: item.canvasBg }}
                              className="h-[62px] rounded-xl p-1.5 flex gap-1.5 relative overflow-hidden"
                            >
                              {/* Mini Sidebar */}
                              <div
                                style={{ backgroundColor: item.bgSwatch }}
                                className="w-7 rounded-md p-1 flex flex-col gap-1 shrink-0"
                              >
                                <span
                                  className="block h-1 w-full rounded-full opacity-60"
                                  style={{ backgroundColor: item.accentSwatch }}
                                />
                                <span
                                  className="block h-1 w-3/4 rounded-full opacity-25"
                                  style={{ backgroundColor: item.syntax.foreground }}
                                />
                                <span
                                  className="block h-1 w-4/5 rounded-full opacity-25"
                                  style={{ backgroundColor: item.syntax.foreground }}
                                />
                              </div>

                              {/* Mini Code Canvas */}
                              <div
                                style={{ backgroundColor: item.bgSwatch }}
                                className="flex-1 rounded-md p-1.5 flex flex-col justify-center gap-1.5"
                              >
                                <div className="flex items-center gap-1">
                                  <span
                                    className="block h-1.5 w-5 rounded-full"
                                    style={{ backgroundColor: `#${item.syntax.keyword}` }}
                                  />
                                  <span
                                    className="block h-1.5 w-8 rounded-full"
                                    style={{ backgroundColor: `#${item.syntax.type}` }}
                                  />
                                </div>
                                <div className="flex items-center gap-1 pl-2">
                                  <span
                                    className="block h-1 w-9 rounded-full"
                                    style={{ backgroundColor: `#${item.syntax.string}` }}
                                  />
                                  <span
                                    className="block h-1 w-4 rounded-full"
                                    style={{ backgroundColor: `#${item.syntax.number}` }}
                                  />
                                </div>
                                <div className="flex items-center gap-1 pl-2">
                                  <span
                                    className="block h-1 w-6 rounded-full opacity-45"
                                    style={{ backgroundColor: `#${item.syntax.comment}` }}
                                  />
                                  <span
                                    className="block h-1 w-5 rounded-full"
                                    style={{ backgroundColor: `#${item.syntax.keyword}` }}
                                  />
                                </div>
                              </div>

                              {isSelected && (
                                <span
                                  style={{ backgroundColor: item.accentSwatch }}
                                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white shadow-sm"
                                >
                                  <Check size={9.5} strokeWidth={3} />
                                </span>
                              )}
                            </div>

                            <div className="px-1 flex items-center justify-between gap-1.5">
                              <span
                                className="text-[12px] font-semibold truncate"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {item.name}
                              </span>
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.accentSwatch }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Accent Color Picker */}
                  {visualPrefs && onUpdateVisualPrefs && (
                    <SettingsGroup title="Màu nhấn (Accent Color)">
                      <div className="px-4 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                        {ACCENT_PRESETS.map((ac) => {
                          const selected = visualPrefs.accentColor === ac.id;
                          return (
                            <button
                              key={ac.id}
                              type="button"
                              onClick={() => onUpdateVisualPrefs({ accentColor: ac.id })}
                              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                              title={ac.label}
                            >
                              <span
                                style={{
                                  background:
                                    ac.id === 'auto'
                                      ? 'conic-gradient(#3B82F6, #10B981, #8B5CF6, #EC4899, #F59E0B, #3B82F6)'
                                      : ac.primary,
                                  boxShadow: selected
                                    ? `0 0 0 2.5px var(--bg-panel), 0 0 0 4.5px ${ac.primary}`
                                    : undefined
                                }}
                                className="w-6 h-6 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                              >
                                {selected && (
                                  <Check size={12} strokeWidth={3} className="text-white drop-shadow-xs" />
                                )}
                              </span>
                              <span
                                className="text-[10px] font-medium"
                                style={{
                                  color: selected ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                              >
                                {ac.id === 'auto' ? 'Tự động' : ac.label.split(' ')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </SettingsGroup>
                  )}

                  {/* Custom Wallpaper & Frosted Glass */}
                  {visualPrefs && onUpdateVisualPrefs && (
                    <SettingsGroup
                      title="Hình nền & Kính mờ"
                      action={
                        <>
                          <button
                            type="button"
                            onClick={() => wallpaperInputRef.current?.click()}
                            style={{ color: 'var(--accent-primary)' }}
                            className="text-[11.5px] font-semibold hover:opacity-80 flex items-center gap-1 transition-opacity"
                          >
                            <ImagePlus size={12.5} />
                            <span>Chọn ảnh từ máy</span>
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
                        </>
                      }
                    >
                      <div className="p-3.5 space-y-3">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {WALLPAPER_PRESETS.map((wp) => {
                            const active = visualPrefs.wallpaperPreset === wp.id;
                            return (
                              <button
                                key={wp.id}
                                type="button"
                                onClick={() => onUpdateVisualPrefs({ wallpaperPreset: wp.id })}
                                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                              >
                                <div
                                  style={{
                                    background:
                                      wp.id === 'none' ? 'var(--bg-panel-alt)' : wp.background,
                                    boxShadow: active
                                      ? '0 0 0 2px var(--accent-primary)'
                                      : undefined
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
                                    <span
                                      style={{ backgroundColor: 'var(--accent-primary)' }}
                                      className="w-4 h-4 rounded-full text-white flex items-center justify-center shadow-sm"
                                    >
                                      <Check size={10} strokeWidth={3} />
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="text-[10px] truncate max-w-full font-medium"
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
                          <div
                            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
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
                              className="text-[11px] font-semibold text-rose-400 shrink-0 px-2 hover:text-rose-300"
                            >
                              Gỡ
                            </button>
                          </div>
                        )}

                        {visualPrefs.wallpaperPreset !== 'none' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1.5">
                            <div className="space-y-2">
                              <div className="flex justify-between text-[11px]">
                                <span style={{ color: 'var(--text-secondary)' }}>Độ mờ kính</span>
                                <span className="font-mono font-semibold">{visualPrefs.glassBlur}px</span>
                              </div>
                              <AppleSlider
                                min={0}
                                max={28}
                                step={2}
                                value={visualPrefs.glassBlur}
                                onChange={(val) => onUpdateVisualPrefs({ glassBlur: val })}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[11px]">
                                <span style={{ color: 'var(--text-secondary)' }}>Độ phủ nền</span>
                                <span className="font-mono font-semibold">{visualPrefs.glassOpacity}%</span>
                              </div>
                              <AppleSlider
                                min={52}
                                max={96}
                                step={2}
                                value={visualPrefs.glassOpacity}
                                onChange={(val) => onUpdateVisualPrefs({ glassOpacity: val })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </SettingsGroup>
                  )}

                  {/* Layout & Sensory Feedback */}
                  <SettingsGroup title="Bố cục & Cảm giác gõ">
                    {visualPrefs && onUpdateVisualPrefs && (
                      <>
                        <IOSSwitchRow
                          label="Phát sáng dòng đang gõ"
                          checked={visualPrefs.glowCaret}
                          onChange={(v) => onUpdateVisualPrefs({ glowCaret: v })}
                        />
                        <RowDivider />
                      </>
                    )}

                    {onChangeUiDensity && (
                      <>
                        <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                          <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            Bố cục
                          </span>
                          <SegmentedControl
                            value={uiDensity}
                            onChange={onChangeUiDensity}
                            options={[
                              { id: 'bento', label: 'Bento' },
                              { id: 'compact', label: 'Compact' }
                            ]}
                          />
                        </div>
                        <RowDivider />
                      </>
                    )}

                    <IOSSwitchRow
                      label="Âm thanh gõ phím"
                      checked={typingSound}
                      onChange={(v) => {
                        onChangeTypingSound?.(v);
                        if (v) playSoftKeyClick('normal', soundProfile, soundVolume);
                      }}
                    />

                    {typingSound && (
                      <div className="px-3.5 pb-3 pt-0.5">
                        <div
                          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                          className="rounded-xl px-3.5 py-3 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                              Chất âm
                            </span>
                            <SegmentedControl
                              value={soundProfile}
                              onChange={handleSelectProfile}
                              options={SOUND_PROFILES}
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleChangeVolume(soundVolume > 0 ? 0 : 0.5, true)}
                              style={{ color: soundVolume === 0 ? 'var(--text-secondary)' : 'var(--accent-primary)' }}
                              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 hover:bg-[var(--bg-elevated)] transition-colors"
                              title={soundVolume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}
                            >
                              {soundVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                            <AppleSlider
                              min={0}
                              max={100}
                              step={5}
                              value={volumePercent}
                              onChange={(val) => handleChangeVolume(val / 100, false)}
                              onCommit={() => playSoftKeyClick('normal', soundProfile, soundVolume)}
                            />
                            <span
                              className="text-[11px] font-mono font-semibold w-8 text-right tabular-nums"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {volumePercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {onChangeHapticsEnabled && (
                      <>
                        <RowDivider />
                        <IOSSwitchRow
                          label="Rung phản hồi Taptic"
                          description="iOS / iPadOS"
                          checked={hapticsEnabled}
                          onChange={(v) => {
                            onChangeHapticsEnabled(v);
                            if (v) hapticLight();
                          }}
                        />
                      </>
                    )}
                  </SettingsGroup>
                </>
              )}

              {/* ==================== TAB 2: SOẠN THẢO ==================== */}
              {activeTab === 'editor' && (
                <>
                  <SettingsGroup title="Hiển thị">
                    {/* Font Size Stepper */}
                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Cỡ chữ
                      </span>
                      <div
                        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                        className="p-0.5 rounded-[10px] inline-flex items-center gap-1 shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateEditor((prev) => ({
                              ...prev,
                              fontSize: Math.max(11, prev.fontSize - 1)
                            }))
                          }
                          style={{ color: 'var(--text-primary)' }}
                          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-panel)] flex items-center justify-center transition-colors"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-10 text-center text-xs font-mono font-semibold tabular-nums">
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
                          style={{ color: 'var(--text-primary)' }}
                          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-panel)] flex items-center justify-center transition-colors"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    <RowDivider />

                    {/* Tab Size */}
                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Cỡ Tab
                      </span>
                      <SegmentedControl
                        value={editorSettings.tabSize}
                        onChange={(sz) => onUpdateEditor((prev) => ({ ...prev, tabSize: sz }))}
                        options={[
                          { id: 2, label: '2' },
                          { id: 4, label: '4' },
                          { id: 8, label: '8' }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    {/* Font Family */}
                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>
                        Font chữ
                      </span>
                      <CustomSelect
                        value={editorSettings.fontFamily}
                        onChange={(val) =>
                          onUpdateEditor((prev) => ({ ...prev, fontFamily: val }))
                        }
                        minMenuWidth={172}
                        className="min-w-[152px]"
                        options={[
                          { value: 'JetBrains Mono', label: 'JetBrains Mono', fontFamily: "'JetBrains Mono', monospace" },
                          { value: 'Fira Code', label: 'Fira Code', fontFamily: "'Fira Code', monospace" },
                          { value: 'Cascadia Code', label: 'Cascadia Code', fontFamily: "'Cascadia Code', monospace" },
                          { value: 'Consolas, monospace', label: 'Consolas', fontFamily: 'Consolas, monospace' }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    <IOSSwitchRow
                      label="Bàn phím rời"
                      description="Ẩn phím ảo iPad"
                      checked={Boolean(editorSettings.hardwareKeyboardMode)}
                      onChange={(v) =>
                        onUpdateEditor((prev) => ({ ...prev, hardwareKeyboardMode: v }))
                      }
                    />
                    <RowDivider />
                    <IOSSwitchRow
                      label="Tự xuống dòng"
                      checked={editorSettings.wordWrap === 'on'}
                      onChange={(v) =>
                        onUpdateEditor((prev) => ({ ...prev, wordWrap: v ? 'on' : 'off' }))
                      }
                    />
                    <RowDivider />
                    <IOSSwitchRow
                      label="Minimap"
                      checked={editorSettings.minimap}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, minimap: v }))}
                    />
                  </SettingsGroup>

                  <SettingsGroup title="Thông minh">
                    <IOSSwitchRow
                      label="Tự động lưu"
                      checked={editorSettings.autoSave}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, autoSave: v }))}
                    />
                    <RowDivider />
                    <IOSSwitchRow
                      label="Format khi lưu"
                      description={isApplePlatform ? '⌘S' : 'Ctrl+S'}
                      checked={editorSettings.formatOnSave}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, formatOnSave: v }))}
                    />
                    <RowDivider />
                    <IOSSwitchRow
                      label="Gợi ý cú pháp"
                      description="IntelliSense"
                      checked={editorSettings.quickSuggestions}
                      onChange={(v) => onUpdateEditor((prev) => ({ ...prev, quickSuggestions: v }))}
                    />
                    <RowDivider />
                    <IOSSwitchRow
                      label="Gợi ý theo ký tự"
                      description=". : > < #"
                      checked={editorSettings.suggestOnTriggerCharacters}
                      onChange={(v) =>
                        onUpdateEditor((prev) => ({ ...prev, suggestOnTriggerCharacters: v }))
                      }
                    />
                  </SettingsGroup>
                </>
              )}

              {/* ==================== TAB 3: BIÊN DỊCH ==================== */}
              {activeTab === 'compiler' && (
                <>
                  <SettingsGroup title="Cấu hình chung">
                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Chế độ chạy
                      </span>
                      <CustomSelect<ExecutionMode>
                        value={mode}
                        onChange={(val) => onChangeMode(val)}
                        minMenuWidth={164}
                        className="min-w-[150px]"
                        options={[
                          { value: 'standalone', label: 'Cloud + WASM' },
                          { value: 'local', label: 'Local PC Server' }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Engine C/C++
                      </span>
                      <SegmentedControl
                        value={(compilerSettings.cppEngine || 'auto') as CppCompilerEngine}
                        onChange={(eng) => onUpdateCompiler({ ...compilerSettings, cppEngine: eng })}
                        options={[
                          { id: 'auto', label: 'Tự động' },
                          { id: 'offline-wasm', label: 'Offline' },
                          { id: 'cloud', label: 'Cloud' }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Chuẩn C++
                      </span>
                      <SegmentedControl
                        value={compilerSettings.cppStandard}
                        onChange={(std) => onUpdateCompiler({ ...compilerSettings, cppStandard: std })}
                        options={[
                          { id: 'gnu++14', label: 'C++14' },
                          { id: 'gnu++17', label: 'C++17' },
                          { id: 'gnu++20', label: 'C++20' }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        Chuẩn C
                      </span>
                      <SegmentedControl
                        value={compilerSettings.cStandard}
                        onChange={(std) => onUpdateCompiler({ ...compilerSettings, cStandard: std })}
                        options={[
                          { id: 'c99', label: 'C99' },
                          { id: 'c11', label: 'C11' },
                          { id: 'c17', label: 'C17' }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>
                        API Endpoint
                      </span>
                      <input
                        type="text"
                        value={compilerSettings.pistonUrl || ''}
                        onChange={(e) =>
                          onUpdateCompiler({ ...compilerSettings, pistonUrl: e.target.value })
                        }
                        style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-primary)' }}
                        className="w-56 sm:w-64 h-8 px-3 rounded-[10px] text-xs font-mono outline-none select-text"
                      />
                    </div>
                  </SettingsGroup>

                  {onPreloadOfflineCpp && (
                    <SettingsGroup title="Ngoại tuyến">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            <WifiOff size={14} className="text-emerald-500 shrink-0" />
                            <span>LLVM Clang WASM</span>
                          </div>
                          <span
                            style={{
                              backgroundColor:
                                offlineCppState === 'ready'
                                  ? 'rgba(16, 185, 129, 0.14)'
                                  : offlineCppState === 'loading'
                                    ? 'var(--bg-active)'
                                    : 'var(--bg-panel-alt)',
                              color:
                                offlineCppState === 'ready'
                                  ? '#10B981'
                                  : offlineCppState === 'loading'
                                    ? 'var(--accent-primary)'
                                    : 'var(--text-secondary)'
                            }}
                            className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0"
                          >
                            {offlineCppState === 'ready'
                              ? 'Sẵn sàng'
                              : offlineCppState === 'loading'
                                ? `${offlineCppPercent}%`
                                : 'Chưa tải'}
                          </span>
                        </div>

                        {offlineCppState === 'loading' && (
                          <div
                            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                            className="w-full h-1.5 rounded-full overflow-hidden"
                          >
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
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: '#FFFFFF'
                          }}
                          className="w-full h-9 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60"
                        >
                          {offlineCppState === 'loading' ? (
                            <>
                              <RefreshCw size={13.5} className="animate-spin" />
                              <span>Đang tải ({offlineCppPercent}%)...</span>
                            </>
                          ) : offlineCppState === 'ready' ? (
                            <>
                              <Sparkles size={13.5} />
                              <span>Kiểm tra lại bộ nhớ đệm</span>
                            </>
                          ) : (
                            <>
                              <Download size={13.5} />
                              <span>Tải trình biên dịch Offline</span>
                            </>
                          )}
                        </button>
                      </div>
                    </SettingsGroup>
                  )}
                </>
              )}

              {/* ==================== TAB 4: TRỢ LÝ AI (GEMINI 4) ==================== */}
              {activeTab === 'ai' && aiSettings && onUpdateAiSettings && (
                <>
                  <SettingsGroup
                    title="Gemini API Key"
                    action={
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent-primary)' }}
                        className="text-[11px] font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>Lấy miễn phí</span>
                        <ExternalLink size={10.5} />
                      </a>
                    }
                  >
                    <div className="p-3.5 space-y-2">
                      <div
                        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                        className="h-9 px-3 rounded-xl flex items-center gap-2"
                      >
                        <KeyRound size={13.5} style={{ color: 'var(--accent-primary)' }} className="shrink-0" />
                        <input
                          type={showAiApiKey ? 'text' : 'password'}
                          value={aiSettings.apiKey}
                          onChange={(e) => onUpdateAiSettings({ apiKey: e.target.value })}
                          placeholder="Dán khóa AIzaSy..."
                          style={{ color: 'var(--text-primary)' }}
                          className="flex-1 min-w-0 bg-transparent font-mono text-xs outline-none select-text"
                        />
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            aiSettings.apiKey.trim() ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAiApiKey((v) => !v)}
                          style={{ color: 'var(--text-secondary)' }}
                          className="p-1 hover:text-[var(--text-primary)]"
                        >
                          {showAiApiKey ? <EyeOff size={13.5} /> : <Eye size={13.5} />}
                        </button>
                      </div>
                    </div>
                  </SettingsGroup>

                  <section className="space-y-2">
                    <h4
                      className="px-1 text-[11.5px] font-semibold tracking-tight"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Mô hình
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {GEMINI_MODELS.map((m) => {
                        const selected = aiSettings.modelId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onUpdateAiSettings({ modelId: m.id })}
                            style={{
                              backgroundColor: selected ? 'var(--bg-active)' : 'var(--bg-panel)',
                              boxShadow: selected ? `0 0 0 1.5px ${m.accent}` : undefined
                            }}
                            className="px-3.5 py-2.5 rounded-2xl text-left hover:bg-[var(--bg-panel-alt)] active:scale-[0.985] transition-all flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: m.accent }}
                              />
                              <span className="text-[12.5px] font-semibold truncate">{m.label}</span>
                            </div>
                            <span
                              style={{
                                backgroundColor:
                                  m.tier === 'free'
                                    ? 'rgba(16, 185, 129, 0.14)'
                                    : m.tier === 'fast'
                                      ? 'rgba(56, 189, 248, 0.14)'
                                      : 'rgba(168, 85, 247, 0.14)',
                                color:
                                  m.tier === 'free'
                                    ? '#10B981'
                                    : m.tier === 'fast'
                                      ? '#0EA5E9'
                                      : '#A855F7'
                              }}
                              className="px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold shrink-0"
                            >
                              {m.tierLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        boxShadow:
                          aiSettings.modelId === '__custom__'
                            ? '0 0 0 1.5px var(--accent-primary)'
                            : undefined
                      }}
                      className="rounded-2xl p-2.5 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={aiSettings.customModelId}
                        onChange={(e) =>
                          onUpdateAiSettings({
                            customModelId: e.target.value,
                            modelId: e.target.value.trim() ? '__custom__' : aiSettings.modelId
                          })
                        }
                        placeholder="Custom Model ID (vd: gemini-4-neon)..."
                        style={{
                          backgroundColor: 'var(--bg-panel-alt)',
                          color: 'var(--text-primary)'
                        }}
                        className="flex-1 min-w-0 h-8 px-3 rounded-[10px] font-mono text-xs outline-none select-text"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateAiSettings({ modelId: '__custom__' })}
                        style={{
                          backgroundColor:
                            aiSettings.modelId === '__custom__'
                              ? 'var(--accent-primary)'
                              : 'var(--bg-panel-alt)',
                          color:
                            aiSettings.modelId === '__custom__' ? '#FFFFFF' : 'var(--text-secondary)'
                        }}
                        className="h-8 px-3 rounded-[10px] text-[11px] font-semibold shrink-0 transition-colors"
                      >
                        {aiSettings.modelId === '__custom__' ? 'Đang dùng' : 'Dùng'}
                      </button>
                    </div>
                  </section>

                  <SettingsGroup title="Hành vi">
                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">Chế độ</span>
                      <SegmentedControl
                        value={aiSettings.assistantMode}
                        onChange={(m) => onUpdateAiSettings({ assistantMode: m })}
                        options={[
                          { id: 'tutor', label: 'Gia sư', icon: <GraduationCap size={12} /> },
                          { id: 'coder', label: 'Kỹ sư', icon: <Zap size={12} /> }
                        ]}
                      />
                    </div>

                    <RowDivider />

                    <div className="min-h-[44px] px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[13px] font-medium flex items-center gap-1.5">
                        <Brain size={13.5} style={{ color: 'var(--accent-primary)' }} />
                        <span>Suy luận</span>
                      </span>
                      <SegmentedControl
                        value={aiSettings.thinkingLevel}
                        onChange={(lv) => onUpdateAiSettings({ thinkingLevel: lv })}
                        options={
                          [
                            { id: 'minimal', label: 'Tức thì' },
                            { id: 'low', label: 'Nhanh' },
                            { id: 'medium', label: 'Vừa' },
                            { id: 'high', label: 'Sâu' }
                          ] as Array<{ id: AiThinkingLevel; label: string }>
                        }
                      />
                    </div>

                    <RowDivider />

                    <IOSSwitchRow
                      label="Hiện nút AI trên thanh công cụ"
                      checked={aiSettings.showDockButton}
                      onChange={(checked) => onUpdateAiSettings({ showDockButton: checked })}
                    />
                  </SettingsGroup>
                </>
              )}

              {/* ==================== TAB 5: DỮ LIỆU & THÔNG TIN ==================== */}
              {activeTab === 'data' && (
                <>
                  {onSyncDeviceFiles && (
                    <SettingsGroup title="Ứng dụng Tệp (Files)">
                      <IOSSwitchRow
                        label="Tự động lưu sang app Tệp"
                        description="iPadOS / iOS"
                        checked={iosAutoMirror}
                        onChange={(v) => {
                          setIosAutoMirror(v);
                          setIosFilesAutoMirrorEnabled(v);
                          hapticLight();
                        }}
                      />
                      <RowDivider />
                      <div className="p-3.5">
                        <button
                          type="button"
                          disabled={isSyncingFiles}
                          onClick={onSyncDeviceFiles}
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: '#FFFFFF'
                          }}
                          className="w-full h-9 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60"
                        >
                          {isSyncingFiles ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Đang đồng bộ...</span>
                            </>
                          ) : (
                            <>
                              <FolderSync size={14} />
                              <span>
                                {isNativeIosFilesSyncAvailable()
                                  ? 'Đồng bộ 2 chiều với app Tệp'
                                  : 'Đồng bộ với thư mục trên máy'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </SettingsGroup>
                  )}

                  <SettingsGroup title="Sao lưu Workspace">
                    <div className="p-3.5 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={onExportBackup}
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#FFFFFF'
                        }}
                        className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all"
                      >
                        <Download size={14} />
                        <span>Xuất (.json)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          backgroundColor: 'var(--bg-panel-alt)',
                          color: 'var(--text-primary)'
                        }}
                        className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--bg-elevated)] active:scale-[0.99] transition-all"
                      >
                        <Upload size={14} className="text-emerald-500" />
                        <span>Nhập (.json)</span>
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
                  </SettingsGroup>

                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src="/app-logo.png"
                        alt="Code With You"
                        className="w-8 h-8 rounded-xl object-contain shrink-0"
                      />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        Code With You
                      </span>
                    </div>
                    <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      v2.7
                    </span>
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
