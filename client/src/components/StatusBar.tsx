import React from 'react';
import { CheckCircle2, AlertTriangle, Cloud, HardDrive, Command, WifiOff, Cpu } from 'lucide-react';
import { CompilerSettings, EditorSettings, ExecutionMode, WorkspaceFile } from '../types/ide';
import { CustomSelect } from './CustomSelect';

interface StatusBarProps {
  mode: ExecutionMode;
  onToggleMode: () => void;
  activeFile: WorkspaceFile | null;
  cursor: { line: number; column: number };
  editorSettings: EditorSettings;
  compilerSettings: CompilerSettings;
  lspStatus: { cpp: string; python: string };
  errorCount: number;
  onChangeCompiler: (next: CompilerSettings) => void;
  onOpenShortcutsHud?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = React.memo(({
  mode,
  onToggleMode,
  activeFile,
  cursor,
  editorSettings,
  compilerSettings,
  lspStatus,
  errorCount,
  onChangeCompiler,
  onOpenShortcutsHud
}) => {
  const lang = activeFile?.language || 'cpp';
  const currentLsp = lang === 'python' ? lspStatus.python : lspStatus.cpp;

  return (
    <footer
      style={{
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)'
      }}
      className="h-6 text-[11px] px-1.5 flex items-center justify-between select-none shrink-0"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onToggleMode}
          title="Chuyển đổi chế độ thực thi"
          style={{
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--text-primary)'
          }}
          className="px-2 py-0.5 rounded-lg flex items-center gap-1.5 font-medium cursor-pointer hover:bg-[var(--bg-panel-alt)] transition-colors"
        >
          {mode === 'standalone' ? (
            <Cloud size={11} className="text-sky-400" />
          ) : (
            <HardDrive size={11} className="text-emerald-400" />
          )}
          <span>{mode === 'standalone' ? 'Standalone' : 'Local PC'}</span>
        </button>

        <span
          className={`flex items-center gap-1 font-medium ${
            errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {errorCount > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          <span>{errorCount === 0 ? '0 lỗi' : `${errorCount} lỗi`}</span>
        </span>

        <span className="hidden sm:inline opacity-75 truncate">{currentLsp}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="hidden md:inline opacity-75">Spaces: {editorSettings.tabSize}</span>
        <span className="hidden md:inline opacity-75">UTF-8</span>

        {onOpenShortcutsHud && (
          <button
            type="button"
            onClick={onOpenShortcutsHud}
            style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold hover:bg-[var(--bg-panel-alt)] transition-colors"
            title="Xem bảng phím tắt Magic Keyboard (hoặc giữ phím ⌘)"
          >
            <Command size={10} style={{ color: 'var(--accent-primary)' }} />
            <span>Phím tắt</span>
          </button>
        )}

        {mode === 'standalone' && (lang === 'cpp' || lang === 'c') && (
          <button
            type="button"
            onClick={() => {
              const order: Array<NonNullable<CompilerSettings['cppEngine']>> = [
                'auto',
                'offline-wasm',
                'cloud'
              ];
              const curr = compilerSettings.cppEngine || 'auto';
              const next = order[(order.indexOf(curr) + 1) % order.length];
              onChangeCompiler({ ...compilerSettings, cppEngine: next });
            }}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color:
                compilerSettings.cppEngine === 'offline-wasm'
                  ? '#10B981'
                  : 'var(--text-primary)'
            }}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold hover:bg-[var(--bg-panel-alt)] transition-colors cursor-pointer"
            title="Chuyển nhanh engine biên dịch C/C++ (Tự động / Offline Clang WASM / Cloud GCC)"
          >
            {compilerSettings.cppEngine === 'offline-wasm' ? (
              <WifiOff size={10} />
            ) : (
              <Cpu size={10} style={{ color: 'var(--accent-primary)' }} />
            )}
            <span>
              {compilerSettings.cppEngine === 'offline-wasm'
                ? 'Offline Clang'
                : compilerSettings.cppEngine === 'cloud'
                  ? 'Cloud GCC'
                  : 'Auto C/C++'}
            </span>
          </button>
        )}

        {lang === 'cpp' && (
          <CustomSelect<CompilerSettings['cppStandard']>
            value={compilerSettings.cppStandard}
            onChange={(val) =>
              onChangeCompiler({
                ...compilerSettings,
                cppStandard: val
              })
            }
            size="xs"
            variant="subtle"
            minMenuWidth={126}
            className="font-semibold"
            options={[
              { value: 'gnu++14', label: 'GNU++14' },
              { value: 'gnu++17', label: 'GNU++17' },
              { value: 'gnu++20', label: 'GNU++20' },
              { value: 'gnu++23', label: 'GNU++23' }
            ]}
          />
        )}

        {lang === 'c' && (
          <CustomSelect<CompilerSettings['cStandard']>
            value={compilerSettings.cStandard}
            onChange={(val) =>
              onChangeCompiler({
                ...compilerSettings,
                cStandard: val
              })
            }
            size="xs"
            variant="subtle"
            minMenuWidth={118}
            className="font-semibold"
            options={[
              { value: 'c11', label: 'GCC C11' },
              { value: 'c17', label: 'GCC C17' }
            ]}
          />
        )}

        {lang === 'python' && (
          <span
            style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
            className="px-2 py-0.5 rounded-lg font-semibold"
          >
            Python 3
          </span>
        )}
      </div>
    </footer>
  );
});
