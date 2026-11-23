import React from 'react';
import { Undo2, Redo2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SupportedLanguage } from '../types/ide';

interface MobileCodingToolbarProps {
  language: SupportedLanguage;
  onInsertToken: (token: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onMoveCursor?: (delta: -1 | 1) => void;
}

const COMMON_TOKENS = ['{', '}', '(', ')', '[', ']', ';', ':', '=', '"', "'"];
const CPP_TOKENS = ['#include', 'std::', 'cout', 'cin', '->', '<<', '>>', 'return'];
const PYTHON_TOKENS = ['def', 'if', 'else', 'for', 'while', 'import', 'return', 'print()'];
const WEB_TOKENS = ['<', '>', '</', '/>', '=>', 'const', 'class=""', '#'];

export const MobileCodingToolbar: React.FC<MobileCodingToolbarProps> = ({
  language,
  onInsertToken,
  onUndo,
  onRedo,
  onMoveCursor
}) => {
  const isWeb =
    language === 'html' || language === 'css' || language === 'javascript' || language === 'json';
  const langTokens =
    language === 'python' ? PYTHON_TOKENS : isWeb ? WEB_TOKENS : CPP_TOKENS;
  const allTokens = [...langTokens, ...COMMON_TOKENS];

  const handleAction = (e: React.PointerEvent, fn: () => void) => {
    e.preventDefault();
    fn();
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-panel-alt)',
        borderTop: '1px solid var(--bg-elevated)'
      }}
      className="h-12 flex items-center gap-1.5 px-2.5 overflow-x-auto no-scrollbar shrink-0 select-none ios-sheet-enter"
    >
      <button
        type="button"
        onPointerDown={(e) => handleAction(e, () => onInsertToken('    '))}
        style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
        className="h-9 px-3 rounded-xl font-mono text-xs font-bold shrink-0 btn-lift"
        title="Chèn Tab"
      >
        ⇥ Tab
      </button>

      {onUndo && (
        <button
          type="button"
          onPointerDown={(e) => handleAction(e, onUndo)}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 btn-lift"
          title="Hoàn tác (Undo)"
        >
          <Undo2 size={14} />
        </button>
      )}

      {onRedo && (
        <button
          type="button"
          onPointerDown={(e) => handleAction(e, onRedo)}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 btn-lift"
          title="Làm lại (Redo)"
        >
          <Redo2 size={14} />
        </button>
      )}

      {onMoveCursor && (
        <>
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, () => onMoveCursor(-1))}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 btn-lift"
            title="Con trỏ sang trái"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, () => onMoveCursor(1))}
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 btn-lift"
            title="Con trỏ sang phải"
          >
            <ChevronRight size={15} />
          </button>
        </>
      )}

      <div
        style={{ backgroundColor: 'var(--bg-hover)' }}
        className="w-px h-5 shrink-0 mx-0.5 opacity-60"
      />

      {allTokens.map((tok) => (
        <button
          key={tok}
          type="button"
          onPointerDown={(e) => handleAction(e, () => onInsertToken(tok))}
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          className="min-w-[40px] h-9 px-2.5 rounded-xl font-mono text-xs font-semibold shrink-0 btn-lift"
        >
          {tok}
        </button>
      ))}
    </div>
  );
};
