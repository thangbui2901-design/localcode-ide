import React from 'react';
import { X, Play, AlignLeft, Columns2, Info } from 'lucide-react';
import { WorkspaceFile } from '../types/ide';

interface EditorTabsProps {
  openTabs: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  splitOpen: boolean;
  onSelectTab: (file: WorkspaceFile) => void;
  onCloseTab: (path: string) => void;
  onRun: () => void;
  onFormat: () => void;
  onToggleSplit: () => void;
  isRunning: boolean;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openTabs,
  activeFile,
  splitOpen,
  onSelectTab,
  onCloseTab,
  onRun,
  onFormat,
  onToggleSplit,
  isRunning
}) => {
  const renderTabBadge = (name: string) => {
    if (name.endsWith('.cpp') || name.endsWith('.cc') || name.endsWith('.hpp')) {
      return <span className="text-[#519ABA] font-bold text-[10px]">C++</span>;
    }
    if (name.endsWith('.c') || name.endsWith('.h')) {
      return <span className="text-[#E3B341] font-bold text-[10px]">C</span>;
    }
    if (name.endsWith('.py')) {
      return <span className="text-[#4EC9B0] font-bold text-[10px]">PY</span>;
    }
    if (name.endsWith('.md')) {
      return <Info size={12} className="text-[#519ABA]" />;
    }
    return null;
  };

  return (
    <div className="h-10 bg-[#252526] border-b border-[#3C3C3C] flex items-end justify-between px-1.5 pt-1 select-none shrink-0">
      <div className="flex items-end gap-1 overflow-x-auto no-scrollbar h-full">
        {openTabs.map((tab) => {
          const active = activeFile?.path === tab.path;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab)}
              title={tab.path}
              className={`h-[34px] px-3 rounded-t-lg flex items-center gap-2 cursor-pointer text-[13px] shrink-0 transition-colors ${
                active
                  ? 'bg-[#1E1E1E] text-white border-t border-x border-[#3C3C3C]'
                  : 'bg-transparent text-[#8E8E93] hover:bg-[#2C2C2E]/60 hover:text-[#CCCCCC]'
              }`}
            >
              {renderTabBadge(tab.name)}
              <span>{tab.name}</span>
              {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#E2C08D]" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.path);
                }}
                className="p-0.5 rounded hover:bg-[#3C3C3C] text-[#858585] hover:text-white ml-0.5"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 pb-1 pl-2 shrink-0">
        <button
          onClick={onRun}
          disabled={isRunning}
          title="Biên dịch & Chạy (F5)"
          className="min-w-[36px] h-8 px-2.5 rounded-lg hover:bg-[#333336] active:bg-[#007ACC] text-[#CCCCCC] hover:text-white disabled:opacity-40 flex items-center justify-center gap-1.5 text-xs"
        >
          <Play size={15} className={isRunning ? 'text-[#4EC9B0] animate-pulse' : ''} />
          <span className="hidden xl:inline">Run</span>
        </button>

        <button
          onClick={onFormat}
          title="Format Code"
          className="min-w-[36px] h-8 px-2 rounded-lg hover:bg-[#333336] text-[#CCCCCC] hover:text-white flex items-center justify-center"
        >
          <AlignLeft size={15} />
        </button>

        <button
          onClick={onToggleSplit}
          title="Split Editor (Chia đôi màn hình code)"
          className={`min-w-[36px] h-8 px-2 rounded-lg flex items-center justify-center transition-colors ${
            splitOpen ? 'bg-[#007ACC] text-white' : 'hover:bg-[#333336] text-[#CCCCCC] hover:text-white'
          }`}
        >
          <Columns2 size={15} />
        </button>
      </div>
    </div>
  );
};
