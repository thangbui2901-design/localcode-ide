import React from 'react';
import { Files, Search, Play, Settings, Terminal as TerminalIcon } from 'lucide-react';

interface ActivityBarProps {
  activeView: 'explorer' | 'search' | null;
  onSelectView: (view: 'explorer' | 'search') => void;
  onRun: () => void;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  isRunning: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onSelectView,
  onRun,
  onToggleTerminal,
  onOpenSettings,
  isRunning
}) => {
  const navBtn = (id: 'explorer' | 'search', icon: React.ReactNode, title: string) => {
    const active = activeView === id;
    return (
      <button
        onClick={() => onSelectView(id)}
        title={title}
        className={`w-12 h-12 flex items-center justify-center relative transition-colors ${
          active ? 'text-white' : 'text-[#858585] hover:text-white'
        }`}
      >
        {active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#007ACC]" />}
        {icon}
      </button>
    );
  };

  return (
    <aside className="w-12 bg-[#333333] border-r border-[#3C3C3C] flex flex-col justify-between items-center select-none shrink-0">
      <div className="flex flex-col items-center">
        {navBtn('explorer', <Files size={22} strokeWidth={1.7} />, 'Explorer (Ctrl+Shift+E)')}
        {navBtn('search', <Search size={22} strokeWidth={1.7} />, 'Tìm kiếm trong workspace')}
        <button
          onClick={onRun}
          disabled={isRunning}
          title="Biên dịch & Chạy (F5)"
          className="w-12 h-12 flex items-center justify-center text-[#4EC9B0] hover:bg-[#2A2D2E] disabled:opacity-50"
        >
          <Play size={21} fill="currentColor" />
        </button>
      </div>

      <div className="flex flex-col items-center pb-1">
        <button
          onClick={onToggleTerminal}
          title="Bật/Tắt Terminal"
          className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white"
        >
          <TerminalIcon size={21} strokeWidth={1.7} />
        </button>
        <button
          onClick={onOpenSettings}
          title="Cài đặt Editor"
          className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white"
        >
          <Settings size={21} strokeWidth={1.7} />
        </button>
      </div>
    </aside>
  );
};
