import React from 'react';
import { FileUp, Sparkles } from 'lucide-react';

interface DropZoneOverlayProps {
  visible: boolean;
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none p-4 sm:p-6 flex items-center justify-center bg-black/45 backdrop-blur-md ios-backdrop-enter">
      <div
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '2px dashed var(--accent-primary)',
          boxShadow: '0 24px 64px -12px var(--accent-glow)'
        }}
        className="w-full max-w-lg rounded-3xl px-8 py-10 flex flex-col items-center text-center gap-3 ios-modal-enter"
      >
        <div
          style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner"
        >
          <FileUp size={30} />
        </div>
        <h3 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Thả tệp hoặc đoạn code vào Workspace
        </h3>
        <p className="text-xs leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          Hỗ trợ kéo thả trực tiếp từ ứng dụng Tệp (iPadOS Split View) hoặc kéo đoạn văn bản code (`.cpp`, `.c`, `.py`, `.html`, `.css`, `.js`, ảnh tài nguyên...)
        </p>
        <span
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-primary)' }}
          className="mt-1 px-3 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5"
        >
          <Sparkles size={12} />
          Tự động lưu &amp; mở ngay trong trình soạn thảo
        </span>
      </div>
    </div>
  );
};
