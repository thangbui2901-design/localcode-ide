import React from 'react';
import { CheckCircle2, AlertTriangle, Cloud, HardDrive } from 'lucide-react';
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
  onChangeCompiler
}) => {
  const lang = activeFile?.language || 'cpp';
  const currentLsp = lang === 'python' ? lspStatus.python : lspStatus.cpp;

  return (
    <footer className="h-6 bg-[#007ACC] text-white text-[11px] px-2.5 flex items-center justify-between select-none shrink-0">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleMode}
          title="Chuyển đổi giữa Local Backend (PC) và Cloud Standalone (Netlify / iPad)"
          className="px-1.5 py-0.5 rounded bg-[#005A9E] hover:bg-[#004578] flex items-center gap-1 font-medium cursor-pointer"
        >
          {mode === 'standalone' ? <Cloud size={12} /> : <HardDrive size={12} />}
          <span>{mode === 'standalone' ? 'Cloud (Piston + IDB)' : 'Local PC'}</span>
        </button>

        <span className="flex items-center gap-1">
          {errorCount > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          <span>{errorCount}</span>
        </span>

        <span className="hidden sm:inline opacity-90">{currentLsp}</span>
      </div>

      <div className="flex items-center gap-3">
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="hidden md:inline">Spaces: {editorSettings.tabSize}</span>
        <span className="hidden md:inline">UTF-8</span>

        {lang === 'cpp' && (
          <select
            value={compilerSettings.cppStandard}
            onChange={(e) =>
              onChangeCompiler({
                ...compilerSettings,
                cppStandard: e.target.value as CompilerSettings['cppStandard']
              })
            }
            className="bg-[#005A9E] text-white px-1.5 py-0.5 rounded outline-none cursor-pointer"
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
            className="bg-[#005A9E] text-white px-1.5 py-0.5 rounded outline-none cursor-pointer"
          >
            <option value="c11">GCC C11</option>
            <option value="c17">GCC C17</option>
          </select>
        )}

        {lang === 'python' && <span className="font-medium">Python 3</span>}
      </div>
    </footer>
  );
};
