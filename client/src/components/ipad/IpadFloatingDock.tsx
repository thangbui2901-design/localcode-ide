import React from 'react';
import {
  PanelRight,
  PanelBottom,
  PenTool,
  FileText,
  Move,
  Command,
  Keyboard,
  KeyboardOff
} from 'lucide-react';

export type IpadRightTool = 'scratchpad' | 'notes' | null;

interface IpadFloatingDockProps {
  consoleDock: 'bottom' | 'right';
  bottomOpen: boolean;
  rightTool: IpadRightTool;
  trackpadOpen: boolean;
  hardwareKeyboardMode: boolean;
  onToggleConsoleDock: () => void;
  onToggleRightTool: (tool: Exclude<IpadRightTool, null>) => void;
  onToggleTrackpad: () => void;
  onToggleHardwareKeyboardMode: () => void;
  onOpenShortcutsHud: () => void;
}

/**
 * Matching floating vertical pill rail on the right edge for iPad Pro tools.
 */
export const IpadFloatingDock: React.FC<IpadFloatingDockProps> = ({
  consoleDock,
  bottomOpen,
  rightTool,
  trackpadOpen,
  hardwareKeyboardMode,
  onToggleConsoleDock,
  onToggleRightTool,
  onToggleTrackpad,
  onToggleHardwareKeyboardMode,
  onOpenShortcutsHud
}) => {
  const RailBtn: React.FC<{
    active?: boolean;
    title: string;
    onClick: () => void;
    children: React.ReactNode;
  }> = ({ active, title, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={
        active
          ? {
              backgroundColor: 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
              color: 'var(--text-primary)',
              border: '1px solid color-mix(in srgb, var(--text-primary) 16%, transparent)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.38)'
            }
          : {
              color: 'var(--text-secondary)',
              border: '1px solid transparent'
            }
      }
      className="w-9 h-9 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 active:scale-92 transition-all duration-200"
    >
      {children}
    </button>
  );

  return (
    <aside
      aria-label="Thanh công cụ iPad bên phải"
      className="shrink-0 flex flex-col items-center justify-between pt-0.5 pb-1 select-none z-20"
    >
      {/* Top Floating Pill: Workspace Panels */}
      <div
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
        }}
        className="rounded-full p-1.5 flex flex-col items-center gap-1.5 backdrop-blur-2xl"
      >
        <RailBtn
          active={rightTool === 'scratchpad'}
          title="Bảng nháp Apple Pencil (⌘⇧A)"
          onClick={() => onToggleRightTool('scratchpad')}
        >
          <PenTool size={16} strokeWidth={rightTool === 'scratchpad' ? 2 : 1.75} />
        </RailBtn>

        <RailBtn
          active={rightTool === 'notes'}
          title="Đề bài & Ghi chú song song (⌘⇧N)"
          onClick={() => onToggleRightTool('notes')}
        >
          <FileText size={16} strokeWidth={rightTool === 'notes' ? 2 : 1.75} />
        </RailBtn>

        <RailBtn
          active={bottomOpen && consoleDock === 'right' && rightTool === null}
          title={
            consoleDock === 'right'
              ? 'Chuyển Console xuống Dưới đáy (⌘⌥J)'
              : 'Gắn Console sang Bên phải (⌘⌥J)'
          }
          onClick={onToggleConsoleDock}
        >
          {consoleDock === 'right' ? <PanelBottom size={16} /> : <PanelRight size={16} />}
        </RailBtn>

        <RailBtn
          active={trackpadOpen}
          title="Bàn rê con trỏ ảo (Virtual Trackpad)"
          onClick={onToggleTrackpad}
        >
          <Move size={16} strokeWidth={trackpadOpen ? 2 : 1.75} />
        </RailBtn>
      </div>

      {/* Bottom Compact Floating Pill: Hardware Keyboard + Magic Keyboard Shortcuts */}
      <div
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
        }}
        className="rounded-full p-1.5 flex flex-col items-center gap-1.5 backdrop-blur-2xl"
      >
        <RailBtn
          active={hardwareKeyboardMode}
          title={
            hardwareKeyboardMode
              ? 'Chế độ Bàn phím rời: ĐANG BẬT (Ẩn bàn phím ảo iPad)'
              : 'Chế độ Bàn phím rời: Tắt (Bấm để ẩn phím ảo khi chạm code)'
          }
          onClick={onToggleHardwareKeyboardMode}
        >
          {hardwareKeyboardMode ? <KeyboardOff size={15} /> : <Keyboard size={15} />}
        </RailBtn>

        <RailBtn title="Phím tắt Magic Keyboard (Giữ ⌘)" onClick={onOpenShortcutsHud}>
          <Command size={15} />
        </RailBtn>
      </div>
    </aside>
  );
};
