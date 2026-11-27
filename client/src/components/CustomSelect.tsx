import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  fontFamily?: string;
}

interface CustomSelectProps<T extends string = string> {
  value: T;
  options: Array<CustomSelectOption<T>>;
  onChange: (value: T) => void;
  align?: 'left' | 'right';
  size?: 'xs' | 'sm';
  variant?: 'filled' | 'subtle' | 'ghost';
  className?: string;
  minMenuWidth?: number;
  maxMenuWidth?: number;
  title?: string;
}

/**
 * Dropdown menu không viền phong cách Apple macOS / iPadOS (Portal + tự lật lên/xuống).
 * Thay thế hoàn toàn thẻ <select> mặc định thô của trình duyệt trên toàn bộ IDE.
 */
export function CustomSelect<T extends string = string>({
  value,
  options,
  onChange,
  align = 'right',
  size = 'sm',
  variant = 'filled',
  className = '',
  minMenuWidth = 148,
  maxMenuWidth = 260,
  title
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estHeight = Math.min(248, options.length * 34 + 14);
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openUp = spaceBelow < estHeight && spaceAbove > spaceBelow;
    const width = Math.min(maxMenuWidth, Math.max(minMenuWidth, rect.width));

    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(10, Math.min(window.innerWidth - width - 10, left));
    const top = openUp ? Math.max(10, rect.top - 6) : Math.min(window.innerHeight - 10, rect.bottom + 6);

    setMenuPos({ top, left, width, openUp });
  }, [open, options.length, align, minMenuWidth, maxMenuWidth]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };

    const handleWindowResize = () => setOpen(false);

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [open]);

  const bgStyle: React.CSSProperties =
    variant === 'ghost'
      ? { backgroundColor: 'transparent', color: 'var(--text-primary)' }
      : variant === 'subtle'
        ? { backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }
        : { backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-primary)' };

  const sizeClass =
    size === 'xs'
      ? 'h-6 px-2 rounded-lg text-[11px] gap-1'
      : 'h-8 px-3 rounded-[10px] text-xs gap-2';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          ...bgStyle,
          fontFamily: selectedOption?.fontFamily
        }}
        className={`inline-flex items-center justify-between font-medium hover:bg-[var(--bg-elevated)] active:scale-[0.98] transition-all outline-none cursor-pointer ${sizeClass} ${className}`}
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown
          size={size === 'xs' ? 11 : 13}
          style={{ color: 'var(--text-secondary)' }}
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: menuPos.openUp ? undefined : `${menuPos.top}px`,
              bottom: menuPos.openUp ? `${window.innerHeight - menuPos.top}px` : undefined,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow:
                '0 20px 50px -12px rgba(0, 0, 0, 0.48), 0 0 0 1px color-mix(in srgb, var(--text-primary) 8%, transparent)',
              transformOrigin: menuPos.openUp ? 'bottom center' : 'top center'
            }}
            className="z-[9999] rounded-2xl p-1.5 max-h-[248px] overflow-y-auto no-scrollbar ios-popover-enter space-y-0.5 select-none"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: opt.fontFamily
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-[10px] text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'font-semibold'
                      : 'font-medium hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check
                      size={13}
                      strokeWidth={2.5}
                      className="shrink-0"
                      style={{ color: 'var(--accent-primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
