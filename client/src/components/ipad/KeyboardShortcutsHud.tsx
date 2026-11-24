import React, { useEffect, useState } from 'react';
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
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 280);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.26s var(--ease-ios-out)'
      }}
      className={`fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4 ${
        visible ? '' : 'pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-panel) 94%, transparent)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          color: 'var(--text-primary)',
          opacity: visible ? 1 : 0,
          transform: visible
            ? 'translate3d(0, 0, 0) scale(1)'
            : 'translate3d(0, 18px, 0) scale(0.92)',
          filter: visible ? 'blur(0px)' : 'blur(8px)',
          transition:
            'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.28s ease',
          willChange: 'transform, opacity, filter'
        }}
        className="w-full max-w-4xl rounded-3xl p-5 sm:p-6 backdrop-blur-2xl"
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
