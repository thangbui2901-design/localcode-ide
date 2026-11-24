import React, { useMemo, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { WorkspaceFile } from '../types/ide';
import { FileTypeIcon } from './FileTypeIcon';

interface SearchSidebarProps {
  files: WorkspaceFile[];
  onJump: (file: WorkspaceFile, line: number, column: number) => void;
  onCloseMobile?: () => void;
  isOverlay?: boolean;
}

export const SearchSidebar: React.FC<SearchSidebarProps> = ({
  files,
  onJump,
  onCloseMobile
}) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ file: WorkspaceFile; line: number; col: number; text: string }> = [];
    for (const file of files) {
      if (file.language === 'asset') continue;
      const lines = file.content.split('\n');
      lines.forEach((lineText, idx) => {
        const foundIdx = lineText.toLowerCase().indexOf(q);
        if (foundIdx !== -1) {
          results.push({
            file,
            line: idx + 1,
            col: foundIdx + 1,
            text: lineText.trim()
          });
        }
      });
    }
    return results;
  }, [files, query]);

  const fileMatchCount = useMemo(() => new Set(matches.map((m) => m.file.path)).size, [matches]);

  return (
    <div className="w-full h-full flex flex-col select-none bg-transparent overflow-hidden">
      {/* Pill Search Input matching OutlinePanel */}
      <div className="px-3 pb-2.5 shrink-0">
        <div
          style={{
            backgroundColor: 'var(--bg-panel-alt)',
            border: '1px solid var(--border-subtle)'
          }}
          className="h-9 px-2.5 rounded-xl flex items-center gap-2 transition-colors focus-within:border-[var(--accent-primary)]"
        >
          <SearchIcon size={13} className="shrink-0 opacity-65" style={{ color: 'var(--text-secondary)' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ khóa trong các tệp..."
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)'
            }}
            className="flex-1 min-w-0 !bg-transparent !border-none !rounded-none text-xs outline-none placeholder:opacity-60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ color: 'var(--text-secondary)' }}
              className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-[var(--bg-hover)] shrink-0"
              title="Xóa từ khóa"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {query.trim() && (
          <div
            className="mt-1.5 px-1 text-[10px] font-medium flex items-center justify-between"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>
              {matches.length > 0
                ? `${matches.length} kết quả trong ${fileMatchCount} tệp`
                : 'Không tìm thấy kết quả'}
            </span>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-1 text-xs">
        {!query.trim() ? (
          <div className="px-3 py-8 text-center text-[11px] opacity-65" style={{ color: 'var(--text-secondary)' }}>
            Nhập tên hàm, biến hoặc đoạn code để tìm nhanh toàn dự án.
          </div>
        ) : matches.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Không tìm thấy kết quả phù hợp cho “{query.trim()}”.
          </div>
        ) : (
          matches.map((m, i) => (
            <button
              key={`${m.file.path}:${m.line}:${m.col}:${i}`}
              type="button"
              onClick={() => {
                onJump(m.file, m.line, m.col);
                onCloseMobile?.();
              }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileTypeIcon fileName={m.file.name} size={13} className="shrink-0" />
                  <span
                    className="font-semibold text-[11px] truncate"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {m.file.name}
                  </span>
                </div>
                <span
                  className="font-mono text-[10px] shrink-0 opacity-75"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  :{m.line}
                </span>
              </div>
              <div
                className="truncate code-font text-[11px] mt-0.5 opacity-85"
                style={{ color: 'var(--text-primary)' }}
              >
                {m.text}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
