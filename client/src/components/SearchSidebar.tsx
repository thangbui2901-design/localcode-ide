import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { WorkspaceFile } from '../types/ide';

interface SearchSidebarProps {
  files: WorkspaceFile[];
  onJump: (file: WorkspaceFile, line: number, column: number) => void;
  onCloseMobile?: () => void;
  isOverlay?: boolean;
}

export const SearchSidebar: React.FC<SearchSidebarProps> = ({
  files,
  onJump,
  onCloseMobile,
  isOverlay = false
}) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ file: WorkspaceFile; line: number; col: number; text: string }> = [];
    for (const file of files) {
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

  return (
    <div
      className={`bg-[#252526] border-r border-[#3C3C3C] flex flex-col select-none ${
        isOverlay ? 'w-72 max-w-[82vw] h-full shadow-2xl' : 'w-64 shrink-0 h-full'
      }`}
    >
      <div className="h-9 px-3 flex items-center justify-between text-[11px] tracking-wider uppercase text-[#BBBBBB] border-b border-[#3C3C3C]">
        <span>Search</span>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-[#37373D] text-[#CCCCCC]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-2 border-b border-[#3C3C3C]">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm từ khóa trong các tệp..."
          className="w-full bg-[#3C3C3C] text-white text-xs px-2.5 py-1.5 rounded border border-[#4C4C4C] focus:border-[#007ACC] outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 text-xs">
        {query.trim() && matches.length === 0 && (
          <div className="text-[#858585] px-2 py-2">Không tìm thấy kết quả phù hợp.</div>
        )}
        {matches.map((m, i) => (
          <div
            key={i}
            onClick={() => {
              onJump(m.file, m.line, m.col);
              onCloseMobile?.();
            }}
            className="px-2 py-1.5 rounded hover:bg-[#2A2D2E] cursor-pointer"
          >
            <div className="text-[#007ACC] font-medium flex justify-between">
              <span>{m.file.name}</span>
              <span className="text-[#858585]">:{m.line}</span>
            </div>
            <div className="text-[#CCCCCC] truncate code-font text-[11px] mt-0.5">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
