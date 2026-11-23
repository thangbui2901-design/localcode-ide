import React from 'react';
import { Command, X } from 'lucide-react';

interface KeyboardShortcutsHudProps {
  open: boolean;
  isHoldMode: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  items: Array<{ keys: string[]; label: string }>;
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Điều hướng & Tệp',
    items: [
      { keys: ['⌘', 'P'], label: 'Tìm nhanh & Command Palette' },
      { keys: ['⌘', 'B'], label: 'Ẩn / Hiện thanh thư mục' },
      { keys: ['⌘', '⇧', 'F'], label: 'Tìm kiếm toàn Workspace' },
      { keys: ['⌘', '⇧', 'O'], label: 'Mục lục cấu trúc (Outline)' },
      { keys: ['⌘', 'S'], label: 'Lưu tệp hiện tại' }
    ]
  },
  {
    title: 'Soạn thảo & Thực thi',
    items: [
      { keys: ['⌘', 'Enter'], label: 'Chạy mã nguồn / Go Live' },
      { keys: ['⌘', 'J'], label: 'Ẩn / Hiện Console & Tests' },
      { keys: ['⌘', 'K'], label: 'Xóa sạch nhật ký Console' },
      { keys: ['⌘', '+ / -'], label: 'Phóng to / Thu nhỏ cỡ chữ' },
      { keys: ['⌘', '0'], label: 'Đặt lại cỡ chữ mặc định' }
    ]
  },
  {
    title: 'Không gian iPad Pro',
    items: [
      { keys: ['⌘', '\\'], label: 'Chia đôi Editor (Split View)' },
      { keys: ['⌘', '⌥', 'J'], label: 'Gắn Console Phải / Dưới đáy' },
      { keys: ['⌘', '⇧', 'D'], label: 'So sánh mã nguồn (Diff View)' },
      { keys: ['⌘', '⇧', 'A'], label: 'Bảng nháp Apple Pencil' },
      { keys: ['⌘', '⇧', 'N'], label: 'Đề bài & Ghi chú song song' },
      { keys: ['Esc'], label: 'Thoát chế độ Tập trung (Zen)' }
    ]
  }
];

export const KeyboardShortcutsHud: React.FC<KeyboardShortcutsHudProps> = ({
  open,
  isHoldMode,
  onClose
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4 ios-backdrop-enter"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)'
        }}
        className="w-full max-w-4xl rounded-3xl p-5 sm:p-6 shadow-2xl ios-modal-enter"
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
            >
              <Command size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Phím tắt Magic Keyboard (iPadOS)</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {isHoldMode
                  ? 'Thả phím ⌘ để đóng nhanh'
                  : 'Nhấn giữ phím ⌘ (hoặc Alt trên Windows) khoảng 0.5s để xem bất cứ lúc nào'}
              </p>
            </div>
          </div>

          {!isHoldMode && (
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)]"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {GROUPS.map((group) => (
            <div
              key={group.title}
              style={{ backgroundColor: 'var(--bg-panel-alt)' }}
              className="rounded-2xl p-3.5 space-y-2.5"
            >
              <h3
                className="text-[11px] font-bold uppercase tracking-wider px-1"
                style={{ color: 'var(--accent-primary)' }}
              >
                {group.title}
              </h3>

              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 px-1 py-1 rounded-lg"
                  >
                    <span className="text-xs leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)'
                          }}
                          className="min-w-[22px] h-5 px-1.5 rounded-md font-mono text-[10px] font-semibold flex items-center justify-center shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
