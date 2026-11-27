import React from 'react';
import { Home, Code2, FolderTree, Terminal, Settings } from 'lucide-react';

export type MobileTab = 'editor' | 'files' | 'terminal' | 'settings';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onGoHome?: () => void;
  problemCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = React.memo(({
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
      aria-label="Điều hướng"
      style={{
        paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom) - 6px))',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))'
      }}
      className="fixed inset-x-0 bottom-0 select-none pt-1 z-30 pointer-events-none"
    >
      <div className="apple-liquid-dock pointer-events-auto relative w-fit mx-auto rounded-full p-1.5 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-0 h-[1px] opacity-80"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-primary) 45%, #ffffff) 50%, transparent 100%)'
          }}
        />
        <div className="relative z-10 flex items-center">
          {/* Giọt kính lỏng trượt mượt giữa các icon */}
          <div
            aria-hidden="true"
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
              transition: 'transform 0.38s var(--ease-ios-spring)'
            }}
            className="absolute inset-y-0 left-0 pointer-events-none"
          >
            <div className="apple-liquid-dock-active w-full h-full rounded-full" />
          </div>

          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            const badge = tab.id === 'terminal' ? problemCount : 0;

            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.label}
                title={tab.label}
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
                className="relative z-10 w-12 h-10 rounded-full flex items-center justify-center transition-colors duration-200 active:scale-95"
              >
                <span className={`relative ${active ? 'ios-nav-icon-active' : ''}`}>
                  {renderIcon(tab.id, active)}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
