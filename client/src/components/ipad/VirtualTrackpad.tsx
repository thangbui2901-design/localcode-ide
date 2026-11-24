import React, { useEffect, useRef, useState } from 'react';
import {
  GripHorizontal,
  X,
  ArrowLeftToLine,
  ArrowRightToLine,
  Braces,
  TextSelect,
  Move
} from 'lucide-react';

interface VirtualTrackpadProps {
  open: boolean;
  onMoveCursor: (dx: number, dy: number, select: boolean) => void;
  onSelectLine: () => void;
  onSelectBlock: () => void;
  onJumpLineEdge: (edge: 'start' | 'end') => void;
  onClose: () => void;
}

export const VirtualTrackpad: React.FC<VirtualTrackpadProps> = ({
  open,
  onMoveCursor,
  onSelectLine,
  onSelectBlock,
  onJumpLineEdge,
  onClose
}) => {
  const [pos, setPos] = useState({ x: 24, y: 84 });
  const [selectMode, setSelectMode] = useState(false);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [isDraggingWin, setIsDraggingWin] = useState(false);
  const [reticle, setReticle] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false
  });

  const dragWinRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );
  const padRef = useRef<{ lastX: number; lastY: number; accX: number; accY: number } | null>(null);

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

  const startWindowDrag = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingWin(true);
    dragWinRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y
    };
  };

  const moveWindowDrag = (e: React.PointerEvent) => {
    const d = dragWinRef.current;
    if (!d) return;
    // Anchored bottom-right using right/bottom offsets
    const dx = d.startX - e.clientX;
    const dy = d.startY - e.clientY;
    setPos({
      x: Math.max(12, Math.min(window.innerWidth - 260, d.origX + dx)),
      y: Math.max(44, Math.min(window.innerHeight - 220, d.origY + dy))
    });
  };

  const endWindowDrag = () => {
    dragWinRef.current = null;
    setIsDraggingWin(false);
  };

  const handlePadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    padRef.current = { lastX: e.clientX, lastY: e.clientY, accX: 0, accY: 0 };
    setReticle({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
  };

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = padRef.current;
    if (!st) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setReticle({
      x: Math.max(8, Math.min(rect.width - 8, e.clientX - rect.left)),
      y: Math.max(8, Math.min(rect.height - 8, e.clientY - rect.top)),
      active: true
    });

    st.accX += e.clientX - st.lastX;
    st.accY += e.clientY - st.lastY;
    st.lastX = e.clientX;
    st.lastY = e.clientY;

    const STEP_X = 9;
    const STEP_Y = 16;

    const stepsX = Math.trunc(st.accX / STEP_X);
    const stepsY = Math.trunc(st.accY / STEP_Y);
    if (stepsX !== 0 || stepsY !== 0) {
      st.accX -= stepsX * STEP_X;
      st.accY -= stepsY * STEP_Y;
      onMoveCursor(stepsX, stepsY, selectMode);
    }
  };

  const handlePadUp = () => {
    padRef.current = null;
    setReticle((r) => ({ ...r, active: false }));
  };

  return (
    <div
      style={{
        right: `${pos.x}px`,
        bottom: `${pos.y}px`,
        backgroundColor: 'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        color: 'var(--text-primary)',
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translate3d(0, 0, 0) scale(1)'
          : 'translate3d(0, 20px, 0) scale(0.86)',
        filter: visible ? 'blur(0px)' : 'blur(6px)',
        transformOrigin: 'bottom right',
        transition: isDraggingWin
          ? 'none'
          : 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.28s ease',
        willChange: 'transform, opacity, filter'
      }}
      className={`fixed z-40 w-60 rounded-2xl backdrop-blur-2xl overflow-hidden select-none ${
        visible ? '' : 'pointer-events-none'
      }`}
    >
      {/* Draggable Title Bar */}
      <div
        onPointerDown={startWindowDrag}
        onPointerMove={moveWindowDrag}
        onPointerUp={endWindowDrag}
        onPointerCancel={endWindowDrag}
        style={{
          backgroundColor: 'var(--bg-panel-alt)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
        className="px-2.5 py-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <GripHorizontal size={13} style={{ color: 'var(--text-secondary)' }} />
          <span>Trackpad Con Trỏ</span>
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="w-5 h-5 rounded-md hover:bg-[var(--bg-elevated)] flex items-center justify-center"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Interactive Glide Pad */}
      <div
        onPointerDown={handlePadDown}
        onPointerMove={handlePadMove}
        onPointerUp={handlePadUp}
        onPointerCancel={handlePadUp}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '14px 14px'
        }}
        className="h-28 m-2 rounded-xl relative overflow-hidden touch-none cursor-move flex items-center justify-center"
      >
        {!reticle.active && (
          <div className="pointer-events-none flex flex-col items-center gap-1 opacity-55">
            <Move size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-[10px] font-medium">Rê ngón tay để lướt con trỏ</span>
          </div>
        )}

        {reticle.active && (
          <div
            style={{
              left: `${reticle.x}px`,
              top: `${reticle.y}px`,
              backgroundColor: selectMode ? '#10B981' : 'var(--accent-primary)',
              boxShadow: '0 0 16px var(--accent-glow)'
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full opacity-80"
          />
        )}
      </div>

      {/* Quick Cursor / Selection Actions */}
      <div className="px-2 pb-2 grid grid-cols-5 gap-1">
        <button
          type="button"
          onClick={() => setSelectMode((v) => !v)}
          style={{
            backgroundColor: selectMode ? 'var(--accent-primary)' : 'var(--bg-elevated)',
            color: selectMode ? '#FFFFFF' : 'var(--text-primary)'
          }}
          className="h-7 rounded-lg text-[10px] font-bold flex items-center justify-center col-span-2 gap-1"
          title="Giữ chế độ bôi đen khi rê Trackpad"
        >
          <TextSelect size={12} />
          <span>{selectMode ? 'Bôi đen' : 'Di chuyển'}</span>
        </button>

        <button
          type="button"
          onClick={() => onJumpLineEdge('start')}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)]"
          title="Về đầu dòng"
        >
          <ArrowLeftToLine size={12} />
        </button>

        <button
          type="button"
          onClick={() => onJumpLineEdge('end')}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)]"
          title="Tới cuối dòng"
        >
          <ArrowRightToLine size={12} />
        </button>

        <button
          type="button"
          onClick={onSelectBlock}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)]"
          title="Chọn khối { } hiện tại"
        >
          <Braces size={12} />
        </button>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onSelectLine}
          style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-secondary)' }}
          className="w-full h-6 rounded-lg text-[10px] font-semibold hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          Chọn nhanh nguyên dòng
        </button>
      </div>
    </div>
  );
};
