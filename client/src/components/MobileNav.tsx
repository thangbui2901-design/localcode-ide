import React from 'react';
import { Code2, FolderTree, Terminal, Settings } from 'lucide-react';

export type MobileTab = 'editor' | 'files' | 'terminal' | 'settings';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  problemCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab, problemCount }) => {
  const item = (id: MobileTab, label: string, icon: React.ReactNode, badge?: number) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => onSelectTab(id)}
        className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 relative ${
          active ? 'text-[#007ACC]' : 'text-[#858585] active:text-white'
        }`}
      >
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
        {badge ? (
          <span className="absolute top-1.5 right-6 px-1 rounded-full bg-[#F14C4C] text-white text-[9px]">
            {badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <nav
      style={{ paddingBottom: 'var(--safe-bottom)' }}
      className="bg-[#252526] border-t border-[#3C3C3C] flex items-center shrink-0 select-none"
    >
      {item('editor', 'Editor', <Code2 size={19} />)}
      {item('files', 'Files', <FolderTree size={19} />)}
      {item('terminal', 'Terminal', <Terminal size={19} />, problemCount)}
      {item('settings', 'Settings', <Settings size={19} />)}
    </nav>
  );
};
