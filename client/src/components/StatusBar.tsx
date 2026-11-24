import React from 'react';
import { CheckCircle2, AlertTriangle, Cloud, HardDrive, Command, WifiOff, Cpu } from 'lucide-react';
import { CompilerSettings, EditorSettings, ExecutionMode, WorkspaceFile } from '../types/ide';

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

export const StatusBar: React.FC<StatusBarProps> = ({
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
        backgroundColor: 'var(--bg-panel-alt)',
        color: 'var(--text-secondary)',
        borderTop: '1px solid var(--border-subtle)'
      }}
      className="h-7 text-[11px] px-3 flex items-center justify-between select-none shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMode}
          title="Chuyển đổi chế độ thực thi"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)'
          }}
          className="px-2 py-0.5 rounded-md flex items-center gap-1.5 font-medium cursor-pointer hover:opacity-90 transition-opacity"
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
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold hover:opacity-90 transition-opacity"
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
              backgroundColor: 'var(--bg-elevated)',
              color:
                compilerSettings.cppEngine === 'offline-wasm'
                  ? '#10B981'
                  : 'var(--text-primary)'
            }}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
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
          <select
            value={compilerSettings.cppStandard}
            onChange={(e) =>
              onChangeCompiler({
                ...compilerSettings,
                cppStandard: e.target.value as CompilerSettings['cppStandard']
              })
            }
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)'
            }}
            className="px-2 py-0.5 rounded-md text-[11px] font-semibold outline-none cursor-pointer"
          >
            <option value="gnu++14">GNU++14</option>
            <option value="gnu++17">GNU++17</option>
            <option value="gnu++20">GNU++20</option>
            <option value="gnu++23">GNU++23</option>
          </select>
        )}

        {lang === 'c' && (
          <select
            value={compilerSettings.cStandard}
            onChange={(e) =>
              onChangeCompiler({
                ...compilerSettings,
                cStandard: e.target.value as CompilerSettings['cStandard']
              })
            }
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)'
            }}
            className="px-2 py-0.5 rounded-md text-[11px] font-semibold outline-none cursor-pointer"
          >
            <option value="c11">GCC C11</option>
            <option value="c17">GCC C17</option>
          </select>
        )}

        {lang === 'python' && (
          <span
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            className="px-2 py-0.5 rounded-md font-semibold"
          >
            Python 3
          </span>
        )}
      </div>
    </footer>
  );
};
