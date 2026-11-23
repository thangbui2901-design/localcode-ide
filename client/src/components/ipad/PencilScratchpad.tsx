import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  ArrowUpRight,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Grid,
  X,
  Hand
} from 'lucide-react';

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  tool: 'pen' | 'highlighter' | 'eraser' | 'arrow';
  color: string;
  size: number;
  points: StrokePoint[];
}

type PaperStyle = 'dots' | 'grid' | 'blank';

interface PencilScratchpadProps {
  projectKey: string;
  onClose: () => void;
  onExportToast?: (msg: string) => void;
}

const PEN_COLORS = [
  { id: 'sky', value: '#38BDF8', label: 'Xanh dương' },
  { id: 'emerald', value: '#34D399', label: 'Xanh ngọc' },
  { id: 'amber', value: '#FBBF24', label: 'Vàng' },
  { id: 'rose', value: '#FB7185', label: 'Đỏ hồng' },
  { id: 'violet', value: '#C084FC', label: 'Tím' },
  { id: 'ink', value: 'auto', label: 'Mực chuẩn' }
];

const SIZES = [2, 4, 7];

function storageKeyFor(projectKey: string): string {
  return `localcode.ipad.scratchpad.v1::${projectKey || 'default'}`;
}

export const PencilScratchpad: React.FC<PencilScratchpadProps> = ({
  projectKey,
  onClose,
  onExportToast
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser' | 'arrow'>('pen');
  const [color, setColor] = useState<string>('#38BDF8');
  const [size, setSize] = useState<number>(3);
  const [paper, setPaper] = useState<PaperStyle>('dots');
  const [pencilOnly, setPencilOnly] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  const activeStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  // Load strokes whenever projectKey changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyFor(projectKey));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setStrokes(parsed);
          setRedoStack([]);
          return;
        }
      }
    } catch {
      // ignore corrupted storage
    }
    setStrokes([]);
    setRedoStack([]);
  }, [projectKey]);

  // Debounced auto-save strokes
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKeyFor(projectKey), JSON.stringify(strokes));
      } catch {
        // quota exceeded
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [strokes, projectKey]);

  const resolveInkColor = useCallback((strokeColor: string): string => {
    if (strokeColor !== 'auto') return strokeColor;
    const computed = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-primary')
      .trim();
    return computed || '#F1F5F9';
  }, []);

  const drawSingleStroke = useCallback(
    (ctx: CanvasRenderingContext2D, s: Stroke) => {
      if (!s.points.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = s.size * 4.5;
      } else if (s.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = resolveInkColor(s.color);
        ctx.lineWidth = s.size * 5.2;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = resolveInkColor(s.color);
        ctx.lineWidth = s.size;
      }

      if (s.tool === 'arrow') {
        const start = s.points[0];
        const end = s.points[s.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = Math.max(10, s.size * 3.2);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle - Math.PI / 6),
          end.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle + Math.PI / 6),
          end.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (s.points.length === 1) {
        const pt = s.points[0];
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Smooth quadratic curve with subtle Apple Pencil pressure variation
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;

        if (s.tool === 'pen') {
          const pressureFactor = 0.6 + Math.min(1.4, Math.max(0.2, curr.pressure)) * 0.85;
          ctx.lineWidth = Math.max(1, s.size * pressureFactor);
        }

        ctx.beginPath();
        if (i === 1) {
          ctx.moveTo(prev.x, prev.y);
        } else {
          const prev2 = s.points[i - 2];
          ctx.moveTo((prev2.x + prev.x) / 2, (prev2.y + prev.y) / 2);
        }
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        ctx.stroke();
      }
      ctx.restore();
    },
    [resolveInkColor]
  );

  const redrawAll = useCallback(
    (extraStroke?: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      for (const s of strokes) {
        drawSingleStroke(ctx, s);
      }
      if (extraStroke) {
        drawSingleStroke(ctx, extraStroke);
      }
      ctx.restore();
    },
    [strokes, drawSingleStroke]
  );

  // Sync canvas dimensions on container resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      redrawAll(activeStrokeRef.current);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawAll]);

  useEffect(() => {
    redrawAll(activeStrokeRef.current);
  }, [strokes, redrawAll]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pencilOnly && e.pointerType === 'touch') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getPoint(e);
    activeStrokeRef.current = {
      tool,
      color,
      size,
      points: [pt]
    };
    redrawAll(activeStrokeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    if (pencilOnly && e.pointerType === 'touch') return;
    const pt = getPoint(e);
    const pts = activeStrokeRef.current.points;
    if (activeStrokeRef.current.tool === 'arrow') {
      activeStrokeRef.current.points = [pts[0], pt];
    } else {
      const last = pts[pts.length - 1];
      const distSq = (pt.x - last.x) ** 2 + (pt.y - last.y) ** 2;
      if (distSq < 2.2) return;
      pts.push(pt);
    }
    redrawAll(activeStrokeRef.current);
  };

  const finishStroke = () => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    isDrawingRef.current = false;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  };

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim() || '#0E1426';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const a = document.createElement('a');
    a.href = exportCanvas.toDataURL('image/png');
    a.download = `scratchpad-${(projectKey || 'algo').replace(/[^a-z0-9_-]/gi, '_')}.png`;
    a.click();
    onExportToast?.('Đã xuất ảnh bảng nháp thuật toán');
  };

  const paperBgStyle: React.CSSProperties =
    paper === 'dots'
      ? {
          backgroundImage: 'radial-gradient(var(--border-subtle) 1.35px, transparent 1.35px)',
          backgroundSize: '20px 20px'
        }
      : paper === 'grid'
        ? {
            backgroundImage:
              'linear-gradient(to right, var(--border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '22px 22px'
          }
        : {};

  return (
    <div
      style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      className="h-full flex flex-col overflow-hidden select-none"
    >
      {/* Top Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-panel-alt)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
        className="px-3 py-2 flex items-center justify-between gap-2 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <PenTool size={14} style={{ color: 'var(--accent-primary)' }} className="shrink-0" />
          <span className="text-xs font-bold truncate">Bảng nháp Apple Pencil</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setPencilOnly((v) => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors ${
              pencilOnly
                ? 'bg-[var(--bg-active)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Bật chống chạm lòng bàn tay (chỉ nhận Apple Pencil)"
          >
            <Hand size={11} />
            <span>{pencilOnly ? 'Chỉ Pencil' : 'Bút & Tay'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setPaper((p) => (p === 'dots' ? 'grid' : p === 'grid' ? 'blank' : 'dots'))
            }
            className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
            title={`Nền giấy: ${paper === 'dots' ? 'Chấm bi' : paper === 'grid' ? 'Ô vuông' : 'Trống'}`}
          >
            <Grid size={13} />
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
            title="Xuất ảnh PNG"
          >
            <Download size={13} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
            title="Đóng bảng nháp"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tools Palette */}
      <div
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
        className="px-2.5 py-2 flex items-center justify-between gap-2 flex-wrap shrink-0"
      >
        <div className="flex items-center gap-1 bg-[var(--bg-panel-alt)] p-0.5 rounded-xl">
          {[
            { id: 'pen' as const, icon: PenTool, label: 'Bút vẽ' },
            { id: 'arrow' as const, icon: ArrowUpRight, label: 'Mũi tên / Cây / Đồ thị' },
            { id: 'highlighter' as const, icon: Highlighter, label: 'Đánh dấu' },
            { id: 'eraser' as const, icon: Eraser, label: 'Tẩy' }
          ].map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTool(item.id)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title={item.label}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {PEN_COLORS.map((c) => {
            const active = color === c.value && tool !== 'eraser';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setColor(c.value);
                  if (tool === 'eraser') setTool('pen');
                }}
                title={c.label}
                style={{
                  backgroundColor: c.value === 'auto' ? 'var(--text-primary)' : c.value,
                  boxShadow: active ? '0 0 0 2px var(--bg-panel), 0 0 0 3.5px var(--accent-primary)' : undefined
                }}
                className="w-4 h-4 rounded-full transition-transform hover:scale-110"
              />
            );
          })}
        </div>

        {/* Size + Undo/Redo/Clear */}
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                size === s ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-elevated)]'
              }`}
              title={`Cỡ nét ${s}px`}
            >
              <span
                style={{
                  width: `${s + 3}px`,
                  height: `${s + 3}px`,
                  backgroundColor: size === s ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                className="rounded-full"
              />
            </button>
          ))}

          <span className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-subtle)' }} />

          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 flex items-center justify-center"
            title="Hoàn tác"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="w-7 h-7 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 flex items-center justify-center"
            title="Làm lại"
          >
            <Redo2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (strokes.length > 0) {
                setStrokes([]);
                setRedoStack([]);
              }
            }}
            disabled={strokes.length === 0}
            className="w-7 h-7 rounded-lg hover:bg-rose-500/15 text-rose-400 disabled:opacity-30 flex items-center justify-center"
            title="Xóa toàn bộ bảng nháp"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Drawing Canvas */}
      <div
        ref={containerRef}
        style={paperBgStyle}
        className="flex-1 min-h-0 relative overflow-hidden cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="block w-full h-full touch-none"
        />

        {strokes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6 opacity-50">
            <PenTool size={22} className="mb-2" style={{ color: 'var(--accent-primary)' }} />
            <p className="text-xs font-semibold">Vẽ cây, đồ thị, trace mảng bằng Apple Pencil</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Tự động lưu theo dự án · Hỗ trợ nét lực nhấn & mũi tên
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
