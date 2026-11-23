import React from 'react';
import { Home, Code2, FolderTree, Terminal, Settings } from 'lucide-react';

export type MobileTab = 'editor' | 'files' | 'terminal' | 'settings';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onGoHome?: () => void;
  problemCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  onGoHome,
  problemCount
}) => {
  const tabs: Array<{ id: 'home' | MobileTab; label: string }> = onGoHome
    ? [
        { id: 'home', label: 'Trang chủ' },
        { id: 'editor', label: 'Code' },
        { id: 'files', label: 'Dự án' },
        { id: 'terminal', label: 'Chạy' },
        { id: 'settings', label: 'Thêm' }
      ]
    : [
        { id: 'editor', label: 'Editor' },
        { id: 'files', label: 'Files' },
        { id: 'terminal', label: 'Terminal' },
        { id: 'settings', label: 'Settings' }
      ];

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );

  const renderIcon = (id: 'home' | MobileTab, active: boolean) => {
    const strokeWidth = active ? 2.25 : 1.85;
    switch (id) {
      case 'home':
        return <Home size={19} strokeWidth={strokeWidth} />;
      case 'editor':
        return <Code2 size={19} strokeWidth={strokeWidth} />;
      case 'files':
        return <FolderTree size={19} strokeWidth={strokeWidth} />;
      case 'terminal':
        return <Terminal size={19} strokeWidth={strokeWidth} />;
      case 'settings':
        return <Settings size={19} strokeWidth={strokeWidth} />;
    }
  };

  return (
    <nav
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-subtle)'
      }}
      className="w-full shrink-0 select-none backdrop-blur-xl"
    >
      <div className="relative max-w-lg mx-auto flex items-center">
        {/* Thanh gạch chân trượt mượt kiểu cổ điển chuẩn iOS */}
        <div
          aria-hidden="true"
          style={{
            width: `${100 / tabs.length}%`,
            transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            transition: 'transform 0.36s var(--ease-ios-spring)'
          }}
          className="absolute bottom-0 left-0 flex justify-center pointer-events-none"
        >
          <span
            style={{
              backgroundColor: 'var(--accent-primary)',
              boxShadow: '0 0 10px var(--accent-glow)'
            }}
            className="w-11 h-[2.5px] rounded-full"
          />
        </div>

        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          const badge = tab.id === 'terminal' ? problemCount : 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'home') {
                  onGoHome?.();
                } else {
                  onSelectTab(tab.id);
                }
              }}
              style={{
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              className="relative flex-1 h-[54px] flex flex-col items-center justify-center gap-1 transition-colors duration-200 active:scale-95"
            >
              <span className={active ? 'ios-nav-icon-active' : ''}>
                {renderIcon(tab.id, active)}
              </span>
              <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
              {badge > 0 && (
                <span className="absolute top-1.5 right-4 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
