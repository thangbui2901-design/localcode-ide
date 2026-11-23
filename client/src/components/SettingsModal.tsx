import React, { useRef, useState } from 'react';
import {
  X,
  Palette,
  Cpu,
  Code2,
  Sparkles,
  Download,
  Upload,
  Check,
  LayoutGrid,
  Columns2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { CompilerSettings, EditorSettings, ExecutionMode } from '../types/ide';
import {
  playSoftKeyClick,
  KeySoundProfile,
  getSavedSoundProfile,
  getSavedSoundVolume
} from '../services/typingSound';

export type UiThemeId =
  | 'midnight-indigo'
  | 'cyber-emerald'
  | 'dracula-neon'
  | 'vscode-dark'
  | 'lavender-light'
  | 'solarized-light';

export type UiDensity = 'bento' | 'compact';

interface ThemeItem {
  id: UiThemeId;
  name: string;
  mode: 'Dark' | 'Light';
  bgSwatch: string;
  accentSwatch: string;
}

const THEME_LIST: ThemeItem[] = [
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    mode: 'Dark',
    bgSwatch: '#111022',
    accentSwatch: '#7C5CFF'
  },
  {
    id: 'cyber-emerald',
    name: 'Cyber Emerald',
    mode: 'Dark',
    bgSwatch: '#0C1714',
    accentSwatch: '#10B981'
  },
  {
    id: 'dracula-neon',
    name: 'Dracula Neon',
    mode: 'Dark',
    bgSwatch: '#1B1C26',
    accentSwatch: '#BD93F9'
  },
  {
    id: 'vscode-dark',
    name: 'VS Code Dark+',
    mode: 'Dark',
    bgSwatch: '#1E1E1E',
    accentSwatch: '#0EA5E9'
  },
  {
    id: 'lavender-light',
    name: 'Lavender Daylight',
    mode: 'Light',
    bgSwatch: '#FFFFFF',
    accentSwatch: '#6D4AFF'
  },
  {
    id: 'solarized-light',
    name: 'Solarized Paper',
    mode: 'Light',
    bgSwatch: '#FDF6E3',
    accentSwatch: '#D97706'
  }
];

const SOUND_PROFILES: Array<{ id: KeySoundProfile; label: string }> = [
  { id: 'waterdrop', label: 'Giọt nước êm' },
  { id: 'creamy', label: 'Creamy trầm' },
  { id: 'typewriter', label: 'Marimba gỗ' }
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
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitchRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    style={{ backgroundColor: 'var(--bg-elevated)' }}
    className="w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all btn-lift"
  >
    <div className="min-w-0">
      <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
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
        backgroundColor: checked ? 'var(--accent-primary)' : 'var(--bg-panel)'
      }}
      className="w-10 h-6 rounded-full p-1 flex items-center transition-colors shrink-0"
    >
      <span
        className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
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
  onChangeTypingSound
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [soundProfile, setSoundProfile] = useState<KeySoundProfile>(() => getSavedSoundProfile());
  const [soundVolume, setSoundVolume] = useState<number>(() => getSavedSoundVolume());

  if (!open) return null;

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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-card)'
        }}
        className="w-full max-w-2xl max-h-[88vh] rounded-3xl flex flex-col overflow-hidden tab-content-enter"
      >
        {/* HEADER */}
        <div
          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
          className="px-5 py-4 flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl accent-btn flex items-center justify-center shrink-0">
              <Sparkles size={17} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Cài đặt Code IDE
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Tùy chỉnh giao diện, trình biên dịch và trải nghiệm gõ code
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:text-[var(--text-primary)] btn-lift"
            title="Đóng cài đặt"
          >
            <X size={17} />
          </button>
        </div>

        {/* BODY - CÁC KHỐI BENTO BO TRÒN TÁCH BIỆT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* KHỐI 1: GIAO DIỆN & CHỦ ĐỀ (THEME) */}
          <section
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="p-4 rounded-2xl space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
                className="w-7 h-7 rounded-xl flex items-center justify-center"
              >
                <Palette size={15} />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Giao diện &amp; Chủ đề (Theme)
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Đồng bộ bảng màu cho toàn bộ khung soạn thảo và bảng điều khiển
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {THEME_LIST.map((item) => {
                const isSelected = uiTheme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeUiTheme?.(item.id)}
                    style={{
                      backgroundColor: isSelected ? 'var(--bg-active)' : 'var(--bg-elevated)'
                    }}
                    className="p-2.5 rounded-2xl flex items-center justify-between gap-2 text-left btn-lift"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: item.bgSwatch }}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: item.accentSwatch }}
                        />
                      </span>
                      <div className="min-w-0">
                        <div
                          className="text-xs font-semibold truncate"
                          style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                        >
                          {item.name}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                          {item.mode} Theme
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span
                        style={{ backgroundColor: item.accentSwatch }}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {onChangeUiDensity && (
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Kiểu bo góc &amp; mật độ hiển thị
                </span>
                <div
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                  className="p-1 rounded-xl flex items-center gap-1"
                >
                  <button
                    type="button"
                    onClick={() => onChangeUiDensity('bento')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      uiDensity === 'bento'
                        ? 'accent-pill-active'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span>Bento Bo Tròn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeUiDensity('compact')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                      uiDensity === 'compact'
                        ? 'accent-pill-active'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Columns2 size={13} />
                    <span>Compact Gọn</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* KHỐI 2: LƯU TRỮ & TRÌNH BIÊN DỊCH */}
          <section
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="p-4 rounded-2xl space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
                className="w-7 h-7 rounded-xl flex items-center justify-center"
              >
                <Cpu size={15} />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Lưu trữ &amp; Trình biên dịch
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Chọn môi trường thực thi Cloud / Local PC và chuẩn C/C++
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Chế độ thực thi
                </label>
                <select
                  value={mode}
                  onChange={(e) => onChangeMode(e.target.value as ExecutionMode)}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="standalone">Cloud + WASM (IndexedDB + Piston)</option>
                  <option value="local">Local PC Server (Node + GCC Local)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Piston Compiler Endpoint
                </label>
                <input
                  type="text"
                  value={compilerSettings.pistonUrl}
                  onChange={(e) => onUpdateCompiler({ ...compilerSettings, pistonUrl: e.target.value })}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-mono outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  C++ Compiler Standard
                </label>
                <select
                  value={compilerSettings.cppStandard}
                  onChange={(e) => onUpdateCompiler({ ...compilerSettings, cppStandard: e.target.value })}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="gnu++17">GNU++17 (Default)</option>
                  <option value="gnu++20">GNU++20 (Modern C++)</option>
                  <option value="gnu++14">GNU++14</option>
                  <option value="c++17">ISO C++17</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  C Compiler Standard
                </label>
                <select
                  value={compilerSettings.cStandard}
                  onChange={(e) => onUpdateCompiler({ ...compilerSettings, cStandard: e.target.value })}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="c11">GCC C11 (Default)</option>
                  <option value="c17">GCC C17</option>
                  <option value="c99">GCC C99</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onExportBackup}
                className="h-10 px-3.5 rounded-xl accent-btn text-xs font-semibold flex items-center justify-center gap-2 btn-lift"
              >
                <Download size={14} />
                <span>Sao lưu Workspace (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 btn-lift"
              >
                <Upload size={14} style={{ color: 'var(--accent-primary)' }} />
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
          </section>

          {/* KHỐI 3: TRÌNH SOẠN THẢO (EDITOR) */}
          <section
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="p-4 rounded-2xl space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
                className="w-7 h-7 rounded-xl flex items-center justify-center"
              >
                <Code2 size={15} />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Trình soạn thảo (Editor)
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Cỡ chữ, font lập trình, thụt lề và hiển thị dòng
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Font Size (px)
                </label>
                <input
                  type="number"
                  min={11}
                  max={28}
                  value={editorSettings.fontSize}
                  onChange={(e) =>
                    onUpdateEditor((prev) => ({
                      ...prev,
                      fontSize: Math.min(28, Math.max(11, Number(e.target.value) || 14))
                    }))
                  }
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Tab Size
                </label>
                <select
                  value={editorSettings.tabSize}
                  onChange={(e) =>
                    onUpdateEditor((prev) => ({ ...prev, tabSize: Number(e.target.value) || 4 }))
                  }
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
                >
                  <option value={2}>2 Spaces</option>
                  <option value={4}>4 Spaces</option>
                  <option value={8}>8 Spaces</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Font Family
                </label>
                <select
                  value={editorSettings.fontFamily}
                  onChange={(e) => onUpdateEditor((prev) => ({ ...prev, fontFamily: e.target.value }))}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="JetBrains Mono">JetBrains Mono (Ligatures)</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Cascadia Code">Cascadia Code</option>
                  <option value="Consolas, monospace">Consolas / Monospace</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Word Wrap
                </label>
                <select
                  value={editorSettings.wordWrap}
                  onChange={(e) =>
                    onUpdateEditor((prev) => ({
                      ...prev,
                      wordWrap: e.target.value as 'off' | 'on'
                    }))
                  }
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="w-full h-10 px-3 rounded-xl text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="off">Off (Cuộn ngang)</option>
                  <option value="on">On (Tự xuống dòng)</option>
                </select>
              </div>
            </div>
          </section>

          {/* KHỐI 4: TỰ ĐỘNG HÓA & GỢI Ý CÚ PHÁP */}
          <section
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="p-4 rounded-2xl space-y-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
                className="w-7 h-7 rounded-xl flex items-center justify-center"
              >
                <Sparkles size={15} />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Tự động hóa &amp; IntelliSense
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Bật/tắt lưu tự động, định dạng, gợi ý cú pháp và âm thanh gõ phím
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleSwitchRow
                label="Minimap (Desktop)"
                description="Bản đồ thu nhỏ mã nguồn bên phải"
                checked={editorSettings.minimap}
                onChange={(v) => onUpdateEditor((prev) => ({ ...prev, minimap: v }))}
              />

              <ToggleSwitchRow
                label="Auto Save"
                description="Tự lưu thay đổi sau 450ms"
                checked={editorSettings.autoSave}
                onChange={(v) => onUpdateEditor((prev) => ({ ...prev, autoSave: v }))}
              />

              <ToggleSwitchRow
                label="Format On Save"
                description="Tự căn chỉnh code khi nhấn Ctrl+S"
                checked={editorSettings.formatOnSave}
                onChange={(v) => onUpdateEditor((prev) => ({ ...prev, formatOnSave: v }))}
              />

              <ToggleSwitchRow
                label="Quick Suggestions (IntelliSense)"
                description="Hiện gợi ý lệnh C/C++/Python khi gõ"
                checked={editorSettings.quickSuggestions}
                onChange={(v) => onUpdateEditor((prev) => ({ ...prev, quickSuggestions: v }))}
              />

              <ToggleSwitchRow
                label="Suggest On Trigger Characters (. : > < #)"
                description="Tự bật danh sách thư viện & thành phần khi gõ ký tự"
                checked={editorSettings.suggestOnTriggerCharacters}
                onChange={(v) => onUpdateEditor((prev) => ({ ...prev, suggestOnTriggerCharacters: v }))}
              />

              <ToggleSwitchRow
                label="Âm thanh gõ phím nhẹ"
                description="Phản hồi âm thanh êm tai khi gõ code"
                checked={typingSound}
                onChange={(v) => {
                  onChangeTypingSound?.(v);
                  if (v) playSoftKeyClick('normal', soundProfile, soundVolume);
                }}
              />

              {typingSound && (
                <div
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                  className="sm:col-span-2 p-3.5 rounded-2xl space-y-3"
                >
                  {/* Chọn chất âm */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-2 text-xs font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Volume2 size={14} style={{ color: 'var(--accent-primary)' }} />
                      <span>Chất âm gõ phím (bấm để nghe thử):</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SOUND_PROFILES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectProfile(item.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all btn-lift ${
                            soundProfile === item.id
                              ? 'accent-pill-active'
                              : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Thanh điều chỉnh âm lượng (Volume) */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleChangeVolume(soundVolume > 0 ? 0 : 0.5, true)}
                      style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--accent-primary)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 btn-lift"
                      title={soundVolume > 0 ? 'Tắt tiếng nhanh' : 'Bật lại 50%'}
                    >
                      {soundVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>

                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span style={{ color: 'var(--text-secondary)' }}>Âm lượng phím gõ</span>
                        <span className="font-bold tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                          {volumePercent}%
                        </span>
                      </div>
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
                        className="w-full h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div
          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
          className="px-5 py-3 flex items-center justify-between gap-3 shrink-0"
        >
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Mọi thay đổi được áp dụng và lưu tự động
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-xl accent-btn text-xs font-semibold btn-lift"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};