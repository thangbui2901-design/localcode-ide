import React from 'react';
import {
  PanelRight,
  PanelBottom,
  PenTool,
  FileText,
  GitCompare,
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
  diffOpen: boolean;
  trackpadOpen: boolean;
  hardwareKeyboardMode: boolean;
  compact?: boolean;
  onToggleConsoleDock: () => void;
  onToggleRightTool: (tool: Exclude<IpadRightTool, null>) => void;
  onToggleDiff: () => void;
  onToggleTrackpad: () => void;
  onToggleHardwareKeyboardMode: () => void;
  onOpenShortcutsHud: () => void;
}

/**
 * Sleek 40px Xcode / JetBrains / Cursor Right Inspector Rail.
 * Zero code overlap, zero duplicate buttons with the Top Header.
 */
export const IpadFloatingDock: React.FC<IpadFloatingDockProps> = ({
  consoleDock,
  bottomOpen,
  rightTool,
  diffOpen,
  trackpadOpen,
  hardwareKeyboardMode,
  compact = false,
  onToggleConsoleDock,
  onToggleRightTool,
  onToggleDiff,
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
      style={{
        backgroundColor: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)'
      }}
      className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
    >
      {active && (
        <span
          aria-hidden="true"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          className="absolute -right-1 top-1.5 bottom-1.5 w-[2.5px] rounded-l-full"
        />
      )}
      {children}
    </button>
  );

  return (
    <aside
      aria-label="Thanh công cụ iPad"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderLeft: compact ? '1px solid var(--border-subtle)' : undefined
      }}
      className={`${
        compact ? 'glass-surface' : 'ide-card'
      } w-10 shrink-0 py-2 flex flex-col items-center justify-between select-none z-20`}
    >
      <div className="flex flex-col items-center gap-1">
        <RailBtn
          active={rightTool === 'scratchpad'}
          title="Bảng nháp Apple Pencil (⌘⇧A)"
          onClick={() => onToggleRightTool('scratchpad')}
        >
          <PenTool size={15} />
        </RailBtn>

        <RailBtn
          active={rightTool === 'notes'}
          title="Đề bài & Ghi chú song song (⌘⇧N)"
          onClick={() => onToggleRightTool('notes')}
        >
          <FileText size={15} />
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
          {consoleDock === 'right' ? <PanelBottom size={15} /> : <PanelRight size={15} />}
        </RailBtn>

        <span className="w-5 h-px my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />

        <RailBtn active={diffOpen} title="So sánh 2 tệp Diff View (⌘⇧D)" onClick={onToggleDiff}>
          <GitCompare size={15} />
        </RailBtn>

        <RailBtn
          active={trackpadOpen}
          title="Bàn rê con trỏ ảo (Virtual Trackpad)"
          onClick={onToggleTrackpad}
        >
          <Move size={15} />
        </RailBtn>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="w-5 h-px my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
        <RailBtn
          active={hardwareKeyboardMode}
          title={
            hardwareKeyboardMode
              ? 'Chế độ Bàn phím rời: ĐANG BẬT (Ẩn bàn phím ảo iPad khi chạm code)'
              : 'Chế độ Bàn phím rời: Tắt (Bấm để không tự bật phím ảo iPad)'
          }
          onClick={onToggleHardwareKeyboardMode}
        >
          {hardwareKeyboardMode ? <KeyboardOff size={15} /> : <Keyboard size={15} />}
        </RailBtn>
        <RailBtn title="Phím tắt Magic Keyboard (Giữ ⌘)" onClick={onOpenShortcutsHud}>
          <Command size={14} />
        </RailBtn>
      </div>
    </aside>
  );
};
