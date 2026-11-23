import React from 'react';
import { ChevronRight } from 'lucide-react';
import { WorkspaceFile } from '../types/ide';

export const Breadcrumbs: React.FC<{ file: WorkspaceFile | null; line: number }> = ({ file, line }) => {
  if (!file) return null;
  const segments = file.path.split('/');

  return (
    <div className="h-[22px] px-3 bg-[#1E1E1E] border-b border-[#2B2B2B] flex items-center gap-1 text-[12px] text-[#A0A0A0] select-none shrink-0 overflow-hidden">
      <span>workspace</span>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          <ChevronRight size={13} className="text-[#6E6E6E]" />
          <span className={i === segments.length - 1 ? 'text-[#CCCCCC]' : 'text-[#9E9E9E]'}>{seg}</span>
        </React.Fragment>
      ))}
      <ChevronRight size={13} className="text-[#6E6E6E]" />
      <span className="text-[#858585]">Line {line}</span>
    </div>
  );
};
