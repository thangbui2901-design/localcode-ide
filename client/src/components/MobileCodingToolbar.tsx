import React from 'react';
import { SupportedLanguage } from '../types/ide';

interface MobileCodingToolbarProps {
  language: SupportedLanguage;
  onInsertToken: (token: string) => void;
}

const COMMON_TOKENS = ['{', '}', '(', ')', '[', ']', ';', ':', '=', '->', '<<', '>>'];
const CPP_TOKENS = ['#include', 'std::', 'cout', 'cin', 'return'];
const PYTHON_TOKENS = ['def', 'if', 'else', 'for', 'while', 'import', 'return'];

export const MobileCodingToolbar: React.FC<MobileCodingToolbarProps> = ({ language, onInsertToken }) => {
  const langTokens = language === 'python' ? PYTHON_TOKENS : CPP_TOKENS;
  const allTokens = [...langTokens, ...COMMON_TOKENS];

  return (
    <div className="h-11 bg-[#252526] border-t border-b border-[#3C3C3C] flex items-center gap-1.5 px-2 overflow-x-auto no-scrollbar shrink-0 select-none">
      {allTokens.map((tok) => (
        <button
          key={tok}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onInsertToken(tok);
          }}
          className="min-w-[44px] h-9 px-2.5 rounded bg-[#333333] active:bg-[#007ACC] text-[#E0E0E0] code-font text-xs font-medium shrink-0 border border-[#454545]"
        >
          {tok}
        </button>
      ))}
    </div>
  );
};
