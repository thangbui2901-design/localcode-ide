import React from 'react';
import { CheckCircle2, Info, AlertCircle } from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface FloatingToastProps {
  toast: ToastItem | null;
  isMobile?: boolean;
}

export const FloatingToast: React.FC<FloatingToastProps> = ({ toast, isMobile = false }) => {
  if (!toast) return null;

  const Icon =
    toast.tone === 'error'
      ? AlertCircle
      : toast.tone === 'info'
        ? Info
        : CheckCircle2;

  const iconColor =
    toast.tone === 'error'
      ? '#F43F5E'
      : toast.tone === 'info'
        ? 'var(--accent-secondary)'
        : 'var(--accent-primary)';

  return (
    <div
      key={toast.id}
      style={{
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-card)'
      }}
      className={`fixed z-50 pointer-events-none px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs font-semibold tab-content-enter ${
        isMobile ? 'bottom-16 right-3 left-3 justify-center' : 'bottom-12 right-4'
      }`}
    >
      <Icon size={15} style={{ color: iconColor }} className="shrink-0" />
      <span className="truncate">{toast.message}</span>
    </div>
  );
};