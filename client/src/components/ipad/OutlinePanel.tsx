import React, { useMemo, useState } from 'react';
import { ListTree, Box, Braces, Hash, Code2, Search } from 'lucide-react';
import { SupportedLanguage, WorkspaceFile } from '../../types/ide';

export interface OutlineSymbol {
  name: string;
  kind: 'class' | 'struct' | 'function' | 'macro' | 'section';
  line: number;
  detail?: string;
}

interface OutlinePanelProps {
  file: WorkspaceFile | null;
  currentLine: number;
  onJumpToLine: (line: number) => void;
}

const CPP_SKIP_NAMES = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'else',
  'return',
  'sizeof',
  'alignof',
  'decltype',
  'static_assert'
]);

export function extractOutlineSymbols(content: string, lang?: SupportedLanguage): OutlineSymbol[] {
  if (!content || !lang || lang === 'asset') return [];
  const lines = content.split('\n');
  const symbols: OutlineSymbol[] = [];

  if (lang === 'cpp' || lang === 'c') {
    lines.forEach((raw, idx) => {
      const line = raw.trim();
      const lineNum = idx + 1;
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) return;

      const nsMatch = line.match(/^namespace\s+([A-Za-z_]\w*)/);
      if (nsMatch) {
        symbols.push({ name: nsMatch[1], kind: 'section', line: lineNum, detail: 'namespace' });
        return;
      }

      const classMatch = line.match(/^(?:template\s*<[^>]*>\s*)?(class|struct|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/);
      if (classMatch && !line.endsWith(';')) {
        symbols.push({
          name: classMatch[2],
          kind: classMatch[1].startsWith('struct') ? 'struct' : 'class',
          line: lineNum,
          detail: classMatch[1]
        });
        return;
      }

      const macroMatch = line.match(/^#define\s+([A-Za-z_]\w*(?:\([^)]*\))?)/);
      if (macroMatch) {
        symbols.push({ name: macroMatch[1], kind: 'macro', line: lineNum, detail: '#define' });
        return;
      }

      // Function definition heuristic
      const fnMatch = line.match(
        /^(?:(?:static|inline|virtual|constexpr|extern|friend|unsigned|signed|long|short|const|auto|void|int|double|float|bool|char|string|std::[\w:<>]+|[\w:]+(?:<[^>]+>)?)\s+[*&\s]*)+([A-Za-z_~][\w:~]*)\s*\(([^;]*)\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?:\{|$)/
      );
      if (fnMatch) {
        const fnName = fnMatch[1];
        if (!CPP_SKIP_NAMES.has(fnName) && !line.endsWith(';')) {
          symbols.push({
            name: `${fnName}()`,
            kind: 'function',
            line: lineNum,
            detail: fnMatch[2].trim().slice(0, 26) || 'void'
          });
        }
      }
    });
  } else if (lang === 'python') {
    lines.forEach((raw, idx) => {
      const line = raw.trim();
      const lineNum = idx + 1;
      const cls = line.match(/^class\s+([A-Za-z_]\w*)/);
      if (cls) {
        symbols.push({ name: cls[1], kind: 'class', line: lineNum, detail: 'class' });
        return;
      }
      const fn = line.match(/^(async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
      if (fn) {
        symbols.push({
          name: `${fn[2]}()`,
          kind: 'function',
          line: lineNum,
          detail: fn[1] ? 'async def' : 'def'
        });
      }
    });
  } else if (lang === 'javascript') {
    lines.forEach((raw, idx) => {
      const line = raw.trim();
      const lineNum = idx + 1;
      const cls = line.match(/^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/);
      if (cls) {
        symbols.push({ name: cls[1], kind: 'class', line: lineNum, detail: 'class' });
        return;
      }
      const fn = line.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (fn) {
        symbols.push({ name: `${fn[1]}()`, kind: 'function', line: lineNum, detail: 'function' });
        return;
      }
      const arrow = line.match(
        /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/
      );
      if (arrow) {
        symbols.push({ name: `${arrow[1]}()`, kind: 'function', line: lineNum, detail: '=>' });
      }
    });
  } else if (lang === 'html') {
    lines.forEach((raw, idx) => {
      const lineNum = idx + 1;
      const idMatch = raw.match(/<([a-zA-Z][\w-]*)[^>]*\bid=["']([^"']+)["']/);
      if (idMatch) {
        symbols.push({
          name: `<${idMatch[1]}#${idMatch[2]}>`,
          kind: 'section',
          line: lineNum,
          detail: 'id'
        });
        return;
      }
      const landmark = raw.match(/<(header|nav|main|section|article|aside|footer|form)\b/i);
      if (landmark) {
        symbols.push({
          name: `<${landmark[1].toLowerCase()}>`,
          kind: 'section',
          line: lineNum,
          detail: 'landmark'
        });
      }
    });
  } else if (lang === 'css') {
    lines.forEach((raw, idx) => {
      const line = raw.trim();
      const lineNum = idx + 1;
      if (line.startsWith('@media') || line.startsWith('@keyframes')) {
        symbols.push({
          name: line.replace(/\{.*$/, '').trim(),
          kind: 'macro',
          line: lineNum,
          detail: 'at-rule'
        });
      } else if (/^[.#a-zA-Z[\]:_-][^{};]*\{/.test(line) && !line.startsWith('/*')) {
        const sel = line.replace(/\{.*$/, '').trim();
        if (sel.length > 0 && sel.length <= 44) {
          symbols.push({ name: sel, kind: 'section', line: lineNum, detail: 'selector' });
        }
      }
    });
  }

  return symbols;
}

export const OutlinePanel: React.FC<OutlinePanelProps> = ({ file, currentLine, onJumpToLine }) => {
  const [query, setQuery] = useState('');

  const symbols = useMemo(
    () => extractOutlineSymbols(file?.content || '', file?.language),
    [file?.content, file?.language]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return symbols;
    return symbols.filter((s) => s.name.toLowerCase().includes(q));
  }, [symbols, query]);

  // Active symbol = last symbol with line <= currentLine
  const activeSymbolLine = useMemo(() => {
    let best = -1;
    for (const s of symbols) {
      if (s.line <= currentLine) best = s.line;
    }
    return best;
  }, [symbols, currentLine]);

  const renderIcon = (kind: OutlineSymbol['kind']) => {
    switch (kind) {
      case 'class':
        return <Box size={13} className="text-amber-400 shrink-0" />;
      case 'struct':
        return <Braces size={13} className="text-emerald-400 shrink-0" />;
      case 'macro':
        return <Hash size={13} className="text-violet-400 shrink-0" />;
      case 'section':
        return <Code2 size={13} className="text-sky-400 shrink-0" />;
      default:
        return <ListTree size={13} className="text-sky-400 shrink-0" />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-2.5 pb-2 shrink-0">
        <div
          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
          className="h-8 px-2.5 rounded-xl flex items-center gap-2"
        >
          <Search size={12} style={{ color: 'var(--text-secondary)' }} className="shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lọc hàm, lớp, cấu trúc..."
            style={{ color: 'var(--text-primary)' }}
            className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:opacity-60"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5">
        {!file ? (
          <div className="py-10 px-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            Mở một tệp mã nguồn để xem mục lục cấu trúc.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 px-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            {symbols.length === 0
              ? `Chưa phát hiện hàm hoặc lớp nào trong ${file.name}.`
              : `Không tìm thấy "${query}".`}
          </div>
        ) : (
          filtered.map((sym, idx) => {
            const isCurrent = sym.line === activeSymbolLine;
            return (
              <button
                key={`${sym.line}-${sym.name}-${idx}`}
                type="button"
                onClick={() => onJumpToLine(sym.line)}
                style={{
                  backgroundColor: isCurrent ? 'var(--bg-active)' : 'transparent',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)'
                }}
                className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {renderIcon(sym.kind)}
                  <span className="text-xs font-mono font-medium truncate">{sym.name}</span>
                </div>
                <span
                  className="text-[10px] font-mono shrink-0 opacity-65"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  :{sym.line}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
