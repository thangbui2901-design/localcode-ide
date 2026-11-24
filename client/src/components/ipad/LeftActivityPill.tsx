import React from 'react';
import {
  Folder,
  Search,
  GitCompare,
  Box,
  PenTool,
  FileText,
  PanelRight,
  PanelBottom,
  Move,
  Keyboard,
  KeyboardOff,
  Command
} from 'lucide-react';
import { IpadRightTool } from './IpadFloatingDock';

interface LeftActivityPillProps {
  sidebarView: 'explorer' | 'search' | 'outline' | null;
  diffOpen: boolean;
  consoleDock: 'bottom' | 'right';
  bottomOpen: boolean;
  rightTool: IpadRightTool;
  trackpadOpen: boolean;
  hardwareKeyboardMode: boolean;
  shortcutsHudOpen: boolean;
  onSelectSidebar: (view: 'explorer' | 'search' | 'outline') => void;
  onToggleDiff: () => void;
  onToggleRightTool: (tool: Exclude<IpadRightTool, null>) => void;
  onToggleConsoleDock: () => void;
  onToggleTrackpad: () => void;
  onToggleHardwareKeyboardMode: () => void;
  onOpenShortcutsHud: () => void;
}

/**
 * Unified Left Floating Pill Activity Rail (Workspace + iPad Pro Tools + Keyboard).
 * Frees 100% of the right edge for the Code Editor & Console.
 */
export const LeftActivityPill: React.FC<LeftActivityPillProps> = React.memo(({
  sidebarView,
  diffOpen,
  consoleDock,
  bottomOpen,
  rightTool,
  trackpadOpen,
  hardwareKeyboardMode,
  shortcutsHudOpen,
  onSelectSidebar,
  onToggleDiff,
  onToggleRightTool,
  onToggleConsoleDock,
  onToggleTrackpad,
  onToggleHardwareKeyboardMode,
  onOpenShortcutsHud
}) => {
  const pillContainerStyle: React.CSSProperties = {
    backgroundColor: 'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-card), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
  };

  const topActiveIndex = diffOpen
    ? 2
    : sidebarView === 'explorer'
      ? 0
      : sidebarView === 'search'
        ? 1
        : sidebarView === 'outline'
          ? 3
          : -1;

  const rightConsoleActive = bottomOpen && consoleDock === 'right' && rightTool === null;
  const middleActiveIndex =
    rightTool === 'scratchpad'
      ? 0
      : rightTool === 'notes'
        ? 1
        : rightConsoleActive
          ? 2
          : trackpadOpen
            ? 3
            : -1;

  const bottomActiveIndex = shortcutsHudOpen ? 1 : hardwareKeyboardMode ? 0 : -1;

  return (
    <nav
      aria-label="Thanh công cụ bên trái"
      className="shrink-0 flex flex-col items-center justify-between gap-2 pt-0.5 pb-0.5 overflow-y-auto no-scrollbar select-none z-20"
    >
      <div className="flex flex-col items-center gap-2">
        {/* Top Pill: Workspace & Navigation (vòng kính nổi trượt lò xo dọc mượt) */}
        <div
          style={pillContainerStyle}
          className="rounded-full p-1 sm:p-1.5 backdrop-blur-lg"
        >
          <div className="relative flex flex-col items-center gap-1">
            <div
              aria-hidden="true"
              style={{
                opacity: topActiveIndex >= 0 ? 1 : 0,
                transform:
                  topActiveIndex >= 0
                    ? `translate3d(0, calc(${topActiveIndex} * (100% + 4px)), 0) scale(1)`
                    : 'translate3d(0, 0, 0) scale(0.72)',
                transition:
                  'transform 0.42s cubic-bezier(0.34, 1.38, 0.64, 1), opacity 0.22s ease',
                backgroundColor: 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--text-primary) 17%, transparent)',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.38)'
              }}
              className="pointer-events-none absolute top-0 left-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full"
            />

            <button
              type="button"
              onClick={() => onSelectSidebar('explorer')}
              title="Explorer — Quản lý tệp (⌘B)"
              style={{
                color: sidebarView === 'explorer' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <Folder size={16} strokeWidth={sidebarView === 'explorer' ? 2 : 1.75} />
            </button>

            <button
              type="button"
              onClick={() => onSelectSidebar('search')}
              title="Tìm kiếm trong Workspace (⌘⇧F)"
              style={{
                color: sidebarView === 'search' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <Search size={16} strokeWidth={sidebarView === 'search' ? 2 : 1.75} />
            </button>

            <button
              type="button"
              onClick={onToggleDiff}
              title="So sánh 2 phiên bản code / Diff View (⌘⇧D)"
              style={{
                color: diffOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <GitCompare size={16} strokeWidth={diffOpen ? 2 : 1.75} />
            </button>

            <button
              type="button"
              onClick={() => onSelectSidebar('outline')}
              title="Outline — Cấu trúc hàm & lớp (⌘⇧O)"
              style={{
                color: sidebarView === 'outline' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <Box size={16} strokeWidth={sidebarView === 'outline' ? 2 : 1.75} />
            </button>
          </div>
        </div>

        {/* Middle Pill: iPad Pro Workspace Tools (vòng kính nổi trượt lò xo dọc mượt) */}
        <div
          style={pillContainerStyle}
          className="rounded-full p-1 sm:p-1.5 backdrop-blur-lg"
        >
          <div className="relative flex flex-col items-center gap-1">
            <div
              aria-hidden="true"
              style={{
                opacity: middleActiveIndex >= 0 ? 1 : 0,
                transform:
                  middleActiveIndex >= 0
                    ? `translate3d(0, calc(${middleActiveIndex} * (100% + 4px)), 0) scale(1)`
                    : 'translate3d(0, 0, 0) scale(0.72)',
                transition:
                  'transform 0.42s cubic-bezier(0.34, 1.38, 0.64, 1), opacity 0.22s ease',
                backgroundColor: 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--text-primary) 17%, transparent)',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.38)'
              }}
              className="pointer-events-none absolute top-0 left-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full"
            />

            <button
              type="button"
              onClick={() => onToggleRightTool('scratchpad')}
              title="Bảng nháp Apple Pencil (⌘⇧A)"
              style={{
                color: rightTool === 'scratchpad' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <PenTool size={15} strokeWidth={rightTool === 'scratchpad' ? 2 : 1.75} />
            </button>

            <button
              type="button"
              onClick={() => onToggleRightTool('notes')}
              title="Đề bài & Ghi chú song song (⌘⇧N)"
              style={{
                color: rightTool === 'notes' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <FileText size={15} strokeWidth={rightTool === 'notes' ? 2 : 1.75} />
            </button>

            <button
              type="button"
              onClick={onToggleConsoleDock}
              title={
                consoleDock === 'right'
                  ? 'Chuyển Console xuống Dưới đáy (⌘⌥J)'
                  : 'Gắn Console sang Bên phải (⌘⌥J)'
              }
              style={{
                color: rightConsoleActive ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              {consoleDock === 'right' ? <PanelBottom size={15} /> : <PanelRight size={15} />}
            </button>

            <button
              type="button"
              onClick={onToggleTrackpad}
              title="Bàn rê con trỏ ảo (Virtual Trackpad)"
              style={{
                color: trackpadOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor:
                  trackpadOpen && middleActiveIndex !== 3
                    ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)'
                    : undefined
              }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
            >
              <Move size={15} strokeWidth={trackpadOpen ? 2 : 1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Pill: Hardware Keyboard Mode & Magic Keyboard HUD (vòng kính trượt lò xo mượt) */}
      <div
        style={pillContainerStyle}
        className="rounded-full p-1 sm:p-1.5 backdrop-blur-lg shrink-0"
      >
        <div className="relative flex flex-col items-center gap-1">
          <div
            aria-hidden="true"
            style={{
              opacity: bottomActiveIndex >= 0 ? 1 : 0,
              transform:
                bottomActiveIndex >= 0
                  ? `translate3d(0, calc(${bottomActiveIndex} * (100% + 4px)), 0) scale(1)`
                  : 'translate3d(0, 0, 0) scale(0.72)',
              transition:
                'transform 0.42s cubic-bezier(0.34, 1.38, 0.64, 1), opacity 0.22s ease',
              backgroundColor: 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--text-primary) 17%, transparent)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.38)'
            }}
            className="pointer-events-none absolute top-0 left-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full"
          />

          <button
            type="button"
            onClick={onToggleHardwareKeyboardMode}
            title={
              hardwareKeyboardMode
                ? 'Chế độ Bàn phím rời: ĐANG BẬT (Ẩn bàn phím ảo iPad)'
                : 'Chế độ Bàn phím rời: Tắt (Bấm để ẩn phím ảo khi chạm code)'
            }
            style={{
              color: hardwareKeyboardMode ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor:
                hardwareKeyboardMode && bottomActiveIndex !== 0
                  ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)'
                  : undefined
            }}
            className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
          >
            <span
              key={hardwareKeyboardMode ? 'off' : 'on'}
              className="inline-flex ios-nav-icon-active"
            >
              {hardwareKeyboardMode ? <KeyboardOff size={15} /> : <Keyboard size={15} />}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenShortcutsHud}
            title="Phím tắt Magic Keyboard (Giữ ⌘)"
            style={{
              color: shortcutsHudOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] active:scale-90 transition-all duration-200 shrink-0"
          >
            <Command size={14} strokeWidth={shortcutsHudOpen ? 2.1 : 1.75} />
          </button>
        </div>
      </div>
    </nav>
  );
});
