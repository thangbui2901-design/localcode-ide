import React, { useEffect, useState } from 'react';
import type * as monacoEditor from 'monaco-editor';

interface IPadAccessoryBarProps {
  editor: monacoEditor.editor.IStandaloneCodeEditor | null;
  onRun: () => void;
  isRunning?: boolean;
}

const QUICK_TOKENS = [
  { label: '⇥ Tab', value: '    ' },
  { label: '{', value: '{' },
  { label: '}', value: '}' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: '[', value: '[' },
  { label: ']', value: ']' },
  { label: ';', value: ';' },
  { label: '<<', value: ' << ' },
  { label: '>>', value: ' >> ' },
  { label: '->', value: '->' },
  { label: '#', value: '#' },
  { label: '&', value: '&' },
  { label: '*', value: '*' },
  { label: ':', value: ':' },
  { label: '"', value: '"' },
];

export const IPadAccessoryBar: React.FC<IPadAccessoryBarProps> = ({
  editor,
  onRun,
  isRunning = false,
}) => {
  const [bottomOffset, setBottomOffset] = useState<number>(0);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    const hasTouch =
      typeof window !== 'undefined' &&
      (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    setIsTouchDevice(hasTouch);

    if (!hasTouch || !window.visualViewport) return;

    const updatePosition = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBottomOffset(keyboardHeight);
    };

    window.visualViewport.addEventListener('resize', updatePosition);
    window.visualViewport.addEventListener('scroll', updatePosition);
    updatePosition();

    return () => {
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, []);

  if (!isTouchDevice) return null;

  const insertText = (text: string) => {
    if (!editor) return;
    editor.focus();
    editor.trigger('ipad-accessory', 'type', { text });
  };

  return (
    <div
      style={{ bottom: `${bottomOffset}px` }}
      className="fixed left-0 right-0 z-50 flex items-center gap-1.5 overflow-x-auto border-t border-zinc-700 bg-zinc-900/95 px-2 py-1.5 backdrop-blur-md select-none"
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRun}
        disabled={isRunning}
        className="shrink-0 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-emerald-500 disabled:opacity-50"
      >
        {isRunning ? 'Đang chạy...' : '▶ Run'}
      </button>

      <div className="h-5 w-px shrink-0 bg-zinc-700" />

      {QUICK_TOKENS.map((token) => (
        <button
          key={token.label}
          type="button"
          onMouseDown={(e) => e.preventDefault()} // Giữ nguyên bàn phím ảo iPad không bị tụt xuống
          onClick={() => insertText(token.value)}
          className="min-w-[34px] shrink-0 rounded bg-zinc-800 px-2.5 py-1.5 font-mono text-xs text-zinc-100 active:bg-zinc-700"
        >
          {token.label}
        </button>
      ))}
    </div>
  );
};