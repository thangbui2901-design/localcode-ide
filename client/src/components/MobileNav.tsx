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
    <nav className="w-full shrink-0 select-none px-3.5 pt-1.5 pb-2.5 z-20 pointer-events-none">
      <div
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-panel) 86%, transparent)',
          border: '1px solid var(--border-subtle)',
          boxShadow:
            '0 14px 36px -10px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
        className="pointer-events-auto relative max-w-md mx-auto rounded-full p-1.5 backdrop-blur-2xl"
      >
        <div className="relative flex items-center">
          {/* Viên thuốc trượt bo tròn mượt bên trong giống thanh bar iOS/Messenger */}
          <div
            aria-hidden="true"
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
              transition: 'transform 0.38s var(--ease-ios-spring)'
            }}
            className="absolute inset-y-0 left-0 pointer-events-none"
          >
            <div
              style={{
                backgroundColor: 'color-mix(in srgb, var(--text-primary) 11%, transparent)'
              }}
              className="w-full h-full rounded-full"
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
                className="relative z-10 flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 active:scale-95"
              >
                <span className={`relative ${active ? 'ios-nav-icon-active' : ''}`}>
                  {renderIcon(tab.id, active)}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {badge}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
