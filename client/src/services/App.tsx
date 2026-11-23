import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { Play, MoreHorizontal, Menu, X } from 'lucide-react';
import {
  CompilerSettings,
  EditorSettings,
  ExecutionMode,
  FileNode,
  IdeDiagnostic,
  SupportedLanguage,
  WorkspaceFile
} from './types/ide';
import { useViewport } from './hooks/useViewport';
import { useLspClient } from './hooks/useLspClient';
import {
  createIdbFolder,
  deleteIdbEntry,
  exportIdbWorkspaceJson,
  importIdbWorkspaceJson,
  loadIdbWorkspace,
  saveIdbFile
} from './services/indexedDbWorkspace';
import { executeWithPiston } from './services/pistonRunner';
import { ActivityBar } from './components/ActivityBar';
import { ExplorerSidebar } from './components/ExplorerSidebar';
import { SearchSidebar } from './components/SearchSidebar';
import { EditorTabs } from './components/EditorTabs';
import { Breadcrumbs } from './components/Breadcrumbs';
import { CodeEditor } from './components/CodeEditor';
import { BottomPanel, TerminalChunk } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { MobileCodingToolbar } from './components/MobileCodingToolbar';
import { MobileNav, MobileTab } from './components/MobileNav';

function detectLanguage(fileName: string): SupportedLanguage {
  if (fileName.endsWith('.py')) return 'python';
  if (fileName.endsWith('.c')) return 'c';
  if (fileName.endsWith('.md')) return 'markdown';
  return 'cpp';
}

export default function App() {
  const { breakpoint, width, height, isKeyboardOpen } = useViewport();
  const primaryEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const secondaryEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const runWsRef = useRef<WebSocket | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<ExecutionMode>('standalone');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openTabPaths, setOpenTabPaths] = useState<string[]>([]);

  const [primaryPath, setPrimaryPath] = useState<string | null>(null);
  const [secondaryPath, setSecondaryPath] = useState<string | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [activePane, setActivePane] = useState<'primary' | 'secondary'>('primary');

  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [sidebarView, setSidebarView] = useState<'explorer' | 'search' | null>('explorer');
  const [bottomOpen, setBottomOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const [logs, setLogs] = useState<TerminalChunk[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticsMap, setDiagnosticsMap] = useState<Record<string, IdeDiagnostic[]>>({});

  const [stdinPreset, setStdinPreset] = useState<string>(() => localStorage.getItem('localcode_stdin') || '');
  const [autoEof, setAutoEof] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem('localcode_stdin', stdinPreset);
  }, [stdinPreset]);

  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    tabSize: 4,
    wordWrap: 'off',
    minimap: true,
    lineNumbers: 'on',
    autoSave: true,
    formatOnSave: false,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    theme: 'vs-dark-modern'
  });

  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>({
    cStandard: 'c11',
    cppStandard: 'gnu++17',
    pistonUrl: 'https://emkc.org/api/v2/piston/execute'
  });

  const primaryFile = files.find((f) => f.path === primaryPath) || null;
  const secondaryFile = files.find((f) => f.path === secondaryPath) || null;
  const activeFile = splitOpen && activePane === 'secondary' ? secondaryFile : primaryFile;
  const activeEditorRef = splitOpen && activePane === 'secondary' ? secondaryEditorRef : primaryEditorRef;

  const openTabs = openTabPaths
    .map((p) => files.find((f) => f.path === p))
    .filter((f): f is WorkspaceFile => Boolean(f));

  const allDiagnostics = Object.values(diagnosticsMap).flat();

  const loadWorkspaceForMode = useCallback(async (targetMode: ExecutionMode) => {
    if (targetMode === 'local') {
      const data = await fetch('/api/files').then((r) => r.json());
      const loaded: WorkspaceFile[] = (data.files || []).map((f: any) => ({
        ...f,
        language: detectLanguage(f.name)
      }));
      setTree(data.tree || []);
      setFiles(loaded);
      return loaded;
    } else {
      const data = await loadIdbWorkspace();
      setTree(data.tree);
      setFiles(data.files);
      return data.files;
    }
  }, []);

  // Tự động phát hiện Local PC Backend; nếu không có (Netlify / iPad) thì chạy Standalone IndexedDB + Piston
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let detectedMode: ExecutionMode = 'standalone';
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 1100);
        const res = await fetch('/api/files', { signal: controller.signal });
        window.clearTimeout(timer);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          detectedMode = 'local';
        }
      } catch {
        detectedMode = 'standalone';
      }

      if (cancelled) return;
      setMode(detectedMode);
      const loaded = await loadWorkspaceForMode(detectedMode);
      if (loaded.length > 0) {
        const initialTabs = loaded.slice(0, 3).map((f) => f.path);
        setOpenTabPaths(initialTabs);
        setPrimaryPath(loaded[0].path);
        if (loaded[1]) setSecondaryPath(loaded[1].path);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadWorkspaceForMode]);

  useEffect(() => {
    setSidebarView(breakpoint === 'desktop' ? 'explorer' : null);
    setBottomOpen(breakpoint === 'desktop');
  }, [breakpoint]);

  const handleSwitchMode = async (nextMode: ExecutionMode) => {
    setMode(nextMode);
    setDiagnosticsMap({});
    const loaded = await loadWorkspaceForMode(nextMode);
    if (loaded.length > 0) {
      setOpenTabPaths(loaded.slice(0, 3).map((f) => f.path));
      setPrimaryPath(loaded[0].path);
      setSecondaryPath(loaded[1]?.path || null);
    }
  };

  const openFileInActivePane = useCallback(
    (file: WorkspaceFile) => {
      if (!openTabPaths.includes(file.path)) {
        setOpenTabPaths((prev) => [...prev, file.path]);
      }
      if (splitOpen && activePane === 'secondary') {
        setSecondaryPath(file.path);
      } else {
        setPrimaryPath(file.path);
      }
    },
    [openTabPaths, splitOpen, activePane]
  );

  const handleDiagnostics = useCallback((uri: string, diags: IdeDiagnostic[]) => {
    setDiagnosticsMap((prev) => ({ ...prev, [uri]: diags }));
  }, []);

  const handleNavigate = useCallback(
    (uri: string, line: number, column: number) => {
      const target = files.find((f) => f.uri === uri);
      if (target) {
        openFileInActivePane(target);
        setTimeout(() => {
          activeEditorRef.current?.revealLineInCenter(line);
          activeEditorRef.current?.setPosition({ lineNumber: line, column });
          activeEditorRef.current?.focus();
        }, 60);
      }
    },
    [files, openFileInActivePane, activeEditorRef]
  );

  const { lspStatus, syncDocument } = useLspClient(mode, activeFile, files, handleDiagnostics, handleNavigate);

  const saveFile = useCallback(
    async (fileToSave?: WorkspaceFile, explicitContent?: string) => {
      const target = fileToSave || activeFile;
      if (!target) return;
      let content = explicitContent ?? target.content;

      if (mode === 'local') {
        if (editorSettings.formatOnSave) {
          const res = await fetch('/api/format', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: content, language: target.language })
          }).then((r) => r.json());
          if (res.formatted) content = res.formatted;
        }

        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: target.path, content })
        });
      } else {
        await saveIdbFile(target.path, content);
      }

      setFiles((prev) => prev.map((f) => (f.path === target.path ? { ...f, content, dirty: false } : f)));
    },
    [activeFile, mode, editorSettings.formatOnSave]
  );

  const handleCodeChange = (targetFile: WorkspaceFile | null, newCode: string) => {
    if (!targetFile) return;

    syncDocument(targetFile, newCode);
    setFiles((prev) => prev.map((f) => (f.path === targetFile.path ? { ...f, content: newCode, dirty: true } : f)));

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      if (editorSettings.autoSave) {
        saveFile(targetFile, newCode);
      }
    }, 250);
  };

  const handleRun = async () => {
    if (!activeFile || isRunning) return;
    await saveFile(activeFile);

    setIsRunning(true);
    setLogs([]);
    if (breakpoint === 'mobile') {
      setMobileTab('terminal');
    } else {
      setBottomOpen(true);
    }

    // Chế độ Cloud Standalone (Netlify / iPad không cần PC) -> Piston API
    if (mode === 'standalone') {
      const latestFiles = files.map((f) => (f.path === activeFile.path ? { ...f, content: activeFile.content } : f));
      await executeWithPiston(activeFile, latestFiles, compilerSettings, stdinPreset, {
        onChunk: (type, text) => {
          setLogs((prev) => [...prev, { type, text }]);
        },
        onFinish: (code, elapsedMs) => {
          setIsRunning(false);
          setLogs((prev) => [
            ...prev,
            { type: 'status', text: `\n[Hoàn thành với mã ${code} trong ${elapsedMs}ms]\n` }
          ]);
        }
      });
      return;
    }

    // Chế độ Local PC Backend -> WebSocket GCC/Python thật
    runWsRef.current?.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/run`);
    runWsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'run',
          filePath: activeFile.path,
          fileName: activeFile.name,
          code: activeFile.content,
          language: activeFile.language,
          cStandard: compilerSettings.cStandard,
          cppStandard: compilerSettings.cppStandard,
          initialStdin: stdinPreset,
          autoEof
        })
      );
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'exit') {
        setIsRunning(false);
        setLogs((prev) => [
          ...prev,
          { type: 'status', text: `\n[Tiến trình kết thúc với mã ${msg.code} trong ${msg.elapsedMs}ms]\n` }
        ]);
      } else {
        setLogs((prev) => [...prev, { type: msg.type, text: msg.text }]);
      }
    };

    ws.onerror = () => {
      setIsRunning(false);
      setLogs((prev) => [...prev, { type: 'stderr', text: 'Không thể kết nối tới LocalCode Execution Server.\n' }]);
    };
  };

  const handleSendStdin = (line: string) => {
    setLogs((prev) => [...prev, { type: 'stdin', text: line }]);
    if (runWsRef.current?.readyState === WebSocket.OPEN) {
      runWsRef.current.send(JSON.stringify({ type: 'stdin', data: line }));
    }
  };

  const handleInsertToken = (token: string) => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const needsSpace = ['def', 'if', 'else', 'for', 'while', 'import', 'return', '#include'].includes(token);
    const text = needsSpace ? `${token} ` : token;

    editor.executeEdits('mobile-toolbar', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();
  };

  const handleUpdateCompiler = async (next: CompilerSettings) => {
    setCompilerSettings(next);
    if (mode === 'local') {
      await fetch('/api/compiler-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cppStandard: next.cppStandard, cStandard: next.cStandard })
      });
    }
  };

  const handleCreateFile = async (relPath: string) => {
    if (mode === 'local') {
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath, content: '' })
      });
    } else {
      await saveIdbFile(relPath, '');
    }

    const updated = await loadWorkspaceForMode(mode);
    const created = updated.find((f) => f.path === relPath);
    if (created) openFileInActivePane(created);
  };

  const handleCreateFolder = async (relPath: string) => {
    if (mode === 'local') {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath })
      });
    } else {
      await createIdbFolder(relPath);
    }
    await loadWorkspaceForMode(mode);
  };

  const handleDeleteEntry = async (relPath: string) => {
    if (mode === 'local') {
      await fetch('/api/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath })
      });
    } else {
      await deleteIdbEntry(relPath);
    }
    const updated = await loadWorkspaceForMode(mode);
    const validPaths = new Set(updated.map((f) => f.path));
    setOpenTabPaths((prev) => prev.filter((p) => validPaths.has(p)));
    if (primaryPath && !validPaths.has(primaryPath)) setPrimaryPath(updated[0]?.path || null);
    if (secondaryPath && !validPaths.has(secondaryPath)) setSecondaryPath(updated[0]?.path || null);
  };

  const handleToggleSplit = () => {
    setSplitOpen((prev) => {
      const next = !prev;
      if (next) {
        if (!secondaryPath) {
          const alt =
            openTabs.find((t) => t.path !== primaryPath) ||
            files.find((f) => f.path !== primaryPath) ||
            primaryFile;
          setSecondaryPath(alt?.path || null);
        }
        setActivePane('secondary');
      } else {
        setActivePane('primary');
      }
      return next;
    });
  };

  const handleFormat = async () => {
    if (!activeFile) return;
    if (mode === 'local') {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeFile.content, language: activeFile.language })
      }).then((r) => r.json());
      if (res.formatted) handleCodeChange(activeFile, res.formatted);
    } else {
      activeEditorRef.current?.getAction('editor.action.formatDocument')?.run();
    }
  };

  const handleExportBackup = async () => {
    const json = await exportIdbWorkspaceJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localcode-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File) => {
    const text = await file.text();
    await importIdbWorkspaceJson(text);
    const loaded = await loadWorkspaceForMode('standalone');
    if (loaded.length > 0) {
      setOpenTabPaths(loaded.slice(0, 3).map((f) => f.path));
      setPrimaryPath(loaded[0].path);
    }
  };

  if (breakpoint === 'mobile') {
    return (
      <div
        style={{ paddingTop: 'var(--safe-top)' }}
        className="w-full h-full flex flex-col bg-[#1E1E1E] overflow-hidden"
      >
        <header className="h-12 px-3 bg-[#252526] border-b border-[#3C3C3C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-[#007ACC] text-white font-bold text-[11px]">LC</span>
            <span className="text-sm font-medium text-white truncate">{activeFile?.path || 'LocalCode'}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="min-w-[68px] min-h-[38px] px-3 rounded bg-[#007ACC] active:bg-[#1F8AD2] text-white font-semibold text-xs flex items-center justify-center gap-1"
            >
              <Play size={14} fill="currentColor" />
              <span>{isRunning ? '...' : 'Run'}</span>
            </button>
            <button
              onClick={() => setMobileMoreOpen((v) => !v)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded active:bg-[#3C3C3C] text-[#CCCCCC]"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        {mobileMoreOpen && (
          <div className="bg-[#252526] border-b border-[#3C3C3C] px-3 py-2 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                handleFormat();
                setMobileMoreOpen(false);
              }}
              className="py-2 px-3 rounded bg-[#333333] text-white"
            >
              Format Code
            </button>
            <button
              onClick={() => {
                setEditorSettings((s) => ({ ...s, lineNumbers: s.lineNumbers === 'on' ? 'off' : 'on' }));
                setMobileMoreOpen(false);
              }}
              className="py-2 px-3 rounded bg-[#333333] text-white"
            >
              Line Numbers: {editorSettings.lineNumbers.toUpperCase()}
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col relative">
          <div className={`flex-1 min-h-0 flex flex-col ${mobileTab === 'editor' ? 'flex' : 'hidden'}`}>
            <CodeEditor
              file={primaryFile}
              settings={editorSettings}
              breakpoint="mobile"
              editorRef={primaryEditorRef}
              onChange={(val) => handleCodeChange(primaryFile, val)}
              onSave={() => saveFile(primaryFile || undefined)}
              onRun={handleRun}
              onCursorChange={(line, column) => setCursor({ line, column })}
            />
            <MobileCodingToolbar language={primaryFile?.language || 'cpp'} onInsertToken={handleInsertToken} />
          </div>

          {mobileTab === 'files' && (
            <div className="flex-1 min-h-0 bg-[#252526]">
              <ExplorerSidebar
                tree={tree}
                files={files}
                activeFile={primaryFile}
                onSelectFile={(f) => {
                  setPrimaryPath(f.path);
                  setMobileTab('editor');
                }}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onDeleteEntry={handleDeleteEntry}
                onRefresh={() => loadWorkspaceForMode(mode)}
              />
            </div>
          )}

          {mobileTab === 'terminal' && (
            <div className="flex-1 min-h-0 flex flex-col justify-end bg-black/50" onClick={() => setMobileTab('editor')}>
              <div onClick={(e) => e.stopPropagation()}>
                <BottomPanel
                  mode={mode}
                  logs={logs}
                  diagnostics={allDiagnostics}
                  isRunning={isRunning}
                  stdinPreset={stdinPreset}
                  autoEof={autoEof}
                  onChangeStdinPreset={setStdinPreset}
                  onChangeAutoEof={setAutoEof}
                  onRunWithInput={handleRun}
                  onSendStdin={handleSendStdin}
                  onSendEof={() => runWsRef.current?.send(JSON.stringify({ type: 'eof' }))}
                  onKill={() => runWsRef.current?.send(JSON.stringify({ type: 'kill' }))}
                  onClear={() => setLogs([])}
                  onJumpToDiagnostic={(d) => {
                    const found = files.find((f) => f.uri === d.uri);
                    if (found) setPrimaryPath(found.path);
                    setMobileTab('editor');
                    setTimeout(() => {
                      primaryEditorRef.current?.revealLineInCenter(d.line);
                      primaryEditorRef.current?.setPosition({ lineNumber: d.line, column: d.column });
                    }, 50);
                  }}
                  onClose={() => setMobileTab('editor')}
                  isSheet
                />
              </div>
            </div>
          )}
        </div>

        <SettingsModal
          open={mobileTab === 'settings'}
          onClose={() => setMobileTab('editor')}
          mode={mode}
          onChangeMode={handleSwitchMode}
          editorSettings={editorSettings}
          onUpdateEditor={setEditorSettings}
          compilerSettings={compilerSettings}
          onUpdateCompiler={handleUpdateCompiler}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />

        {!isKeyboardOpen && (
          <MobileNav activeTab={mobileTab} onSelectTab={(t) => setMobileTab(t)} problemCount={allDiagnostics.length} />
        )}
      </div>
    );
  }

  const splitDirection = breakpoint === 'tablet' && width < height ? 'flex-col' : 'flex-row';

  return (
    <div
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      className="w-full h-full flex flex-col bg-[#1E1E1E] overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex relative">
        <ActivityBar
          activeView={sidebarView}
          onSelectView={(v) => setSidebarView((prev) => (prev === v ? null : v))}
          onRun={handleRun}
          onToggleTerminal={() => setBottomOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          isRunning={isRunning}
        />

        {sidebarView === 'explorer' && breakpoint === 'desktop' && (
          <ExplorerSidebar
            tree={tree}
            files={files}
            activeFile={activeFile}
            onSelectFile={openFileInActivePane}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteEntry={handleDeleteEntry}
            onRefresh={() => loadWorkspaceForMode(mode)}
          />
        )}

        {sidebarView === 'search' && breakpoint === 'desktop' && (
          <SearchSidebar
            files={files}
            onJump={(f, line, col) => {
              openFileInActivePane(f);
              setTimeout(() => {
                activeEditorRef.current?.revealLineInCenter(line);
                activeEditorRef.current?.setPosition({ lineNumber: line, column: col });
                activeEditorRef.current?.focus();
              }, 40);
            }}
          />
        )}

        {sidebarView && breakpoint === 'tablet' && (
          <div className="fixed inset-0 z-40 bg-black/50 flex" onClick={() => setSidebarView(null)}>
            <div onClick={(e) => e.stopPropagation()} className="h-full">
              {sidebarView === 'explorer' ? (
                <ExplorerSidebar
                  tree={tree}
                  files={files}
                  activeFile={activeFile}
                  onSelectFile={openFileInActivePane}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onDeleteEntry={handleDeleteEntry}
                  onRefresh={() => loadWorkspaceForMode(mode)}
                  onCloseMobile={() => setSidebarView(null)}
                  isOverlay
                />
              ) : (
                <SearchSidebar
                  files={files}
                  onJump={(f, line, col) => {
                    openFileInActivePane(f);
                    setTimeout(() => {
                      activeEditorRef.current?.revealLineInCenter(line);
                      activeEditorRef.current?.setPosition({ lineNumber: line, column: col });
                      activeEditorRef.current?.focus();
                    }, 40);
                  }}
                  onCloseMobile={() => setSidebarView(null)}
                  isOverlay
                />
              )}
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex items-center bg-[#252526]">
            {breakpoint === 'tablet' && (
              <button
                onClick={() => setSidebarView((prev) => (prev === 'explorer' ? null : 'explorer'))}
                className="min-w-[44px] h-10 flex items-center justify-center border-r border-[#3C3C3C] text-[#CCCCCC]"
                title="Mở Explorer"
              >
                <Menu size={17} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <EditorTabs
                openTabs={openTabs}
                activeFile={activeFile}
                splitOpen={splitOpen}
                onSelectTab={openFileInActivePane}
                onCloseTab={(closedPath) => {
                  const next = openTabPaths.filter((p) => p !== closedPath);
                  setOpenTabPaths(next);
                  if (primaryPath === closedPath) setPrimaryPath(next[next.length - 1] || null);
                  if (secondaryPath === closedPath) setSecondaryPath(next[next.length - 1] || null);
                }}
                onRun={handleRun}
                onFormat={handleFormat}
                onToggleSplit={handleToggleSplit}
                isRunning={isRunning}
              />
            </div>
          </div>

          <Breadcrumbs file={activeFile} line={cursor.line} />

          <div className={`flex-1 min-h-0 min-w-0 flex ${splitDirection}`}>
            <div
              onClick={() => setActivePane('primary')}
              className={`flex-1 min-w-0 min-h-0 flex flex-col relative ${
                splitOpen && activePane === 'primary' ? 'border-t-2 border-[#007ACC]' : ''
              }`}
            >
              {splitOpen && (
                <div className="h-7 px-2.5 bg-[#252526] border-b border-[#3C3C3C] flex items-center justify-between text-[11px]">
                  <select
                    value={primaryPath || ''}
                    onChange={(e) => setPrimaryPath(e.target.value)}
                    className="bg-transparent text-[#CCCCCC] outline-none cursor-pointer truncate max-w-[85%]"
                  >
                    {files.map((f) => (
                      <option key={f.path} value={f.path} className="bg-[#252526]">
                        {f.path}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#007ACC] font-medium">PANE 1</span>
                </div>
              )}

              <CodeEditor
                file={primaryFile}
                settings={editorSettings}
                breakpoint={breakpoint}
                editorRef={primaryEditorRef}
                onChange={(val) => handleCodeChange(primaryFile, val)}
                onSave={() => saveFile(primaryFile || undefined)}
                onRun={handleRun}
                onFocusEditor={() => setActivePane('primary')}
                onCursorChange={(line, column) => {
                  if (activePane === 'primary') setCursor({ line, column });
                }}
              />
            </div>

            {splitOpen && (
              <div
                onClick={() => setActivePane('secondary')}
                className={`flex-1 min-w-0 min-h-0 flex flex-col border-l border-t md:border-t-0 border-[#3C3C3C] relative ${
                  activePane === 'secondary' ? 'border-t-2 border-t-[#007ACC]' : ''
                }`}
              >
                <div className="h-7 px-2.5 bg-[#252526] border-b border-[#3C3C3C] flex items-center justify-between text-[11px]">
                  <select
                    value={secondaryPath || ''}
                    onChange={(e) => setSecondaryPath(e.target.value)}
                    className="bg-transparent text-[#CCCCCC] outline-none cursor-pointer truncate max-w-[80%]"
                  >
                    {files.map((f) => (
                      <option key={f.path} value={f.path} className="bg-[#252526]">
                        {f.path}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#4EC9B0] font-medium">PANE 2</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSplitOpen(false);
                        setActivePane('primary');
                      }}
                      title="Đóng Split Editor"
                      className="p-0.5 rounded hover:bg-[#3C3C3C] text-[#858585] hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <CodeEditor
                  file={secondaryFile}
                  settings={editorSettings}
                  breakpoint={breakpoint}
                  editorRef={secondaryEditorRef}
                  onChange={(val) => handleCodeChange(secondaryFile, val)}
                  onSave={() => saveFile(secondaryFile || undefined)}
                  onRun={handleRun}
                  onFocusEditor={() => setActivePane('secondary')}
                  onCursorChange={(line, column) => {
                    if (activePane === 'secondary') setCursor({ line, column });
                  }}
                />
              </div>
            )}
          </div>

          {breakpoint === 'tablet' && isKeyboardOpen && (
            <MobileCodingToolbar language={activeFile?.language || 'cpp'} onInsertToken={handleInsertToken} />
          )}

          {bottomOpen && breakpoint === 'desktop' && (
            <BottomPanel
              mode={mode}
              logs={logs}
              diagnostics={allDiagnostics}
              isRunning={isRunning}
              stdinPreset={stdinPreset}
              autoEof={autoEof}
              onChangeStdinPreset={setStdinPreset}
              onChangeAutoEof={setAutoEof}
              onRunWithInput={handleRun}
              onSendStdin={handleSendStdin}
              onSendEof={() => runWsRef.current?.send(JSON.stringify({ type: 'eof' }))}
              onKill={() => runWsRef.current?.send(JSON.stringify({ type: 'kill' }))}
              onClear={() => setLogs([])}
              onJumpToDiagnostic={(d) => {
                const found = files.find((f) => f.uri === d.uri);
                if (found) openFileInActivePane(found);
                setTimeout(() => {
                  activeEditorRef.current?.revealLineInCenter(d.line);
                  activeEditorRef.current?.setPosition({ lineNumber: d.line, column: d.column });
                  activeEditorRef.current?.focus();
                }, 40);
              }}
              onClose={() => setBottomOpen(false)}
            />
          )}

          {bottomOpen && breakpoint === 'tablet' && (
            <div
              className="fixed inset-0 z-40 bg-black/50 flex flex-col justify-end"
              onClick={() => setBottomOpen(false)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <BottomPanel
                  mode={mode}
                  logs={logs}
                  diagnostics={allDiagnostics}
                  isRunning={isRunning}
                  stdinPreset={stdinPreset}
                  autoEof={autoEof}
                  onChangeStdinPreset={setStdinPreset}
                  onChangeAutoEof={setAutoEof}
                  onRunWithInput={handleRun}
                  onSendStdin={handleSendStdin}
                  onSendEof={() => runWsRef.current?.send(JSON.stringify({ type: 'eof' }))}
                  onKill={() => runWsRef.current?.send(JSON.stringify({ type: 'kill' }))}
                  onClear={() => setLogs([])}
                  onJumpToDiagnostic={(d) => {
                    setBottomOpen(false);
                    const found = files.find((f) => f.uri === d.uri);
                    if (found) openFileInActivePane(found);
                    setTimeout(() => {
                      activeEditorRef.current?.revealLineInCenter(d.line);
                      activeEditorRef.current?.setPosition({ lineNumber: d.line, column: d.column });
                    }, 40);
                  }}
                  onClose={() => setBottomOpen(false)}
                  isSheet
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <StatusBar
        mode={mode}
        onToggleMode={() => handleSwitchMode(mode === 'local' ? 'standalone' : 'local')}
        activeFile={activeFile}
        cursor={cursor}
        editorSettings={editorSettings}
        compilerSettings={compilerSettings}
        lspStatus={lspStatus}
        errorCount={allDiagnostics.filter((d) => d.severity === 'error').length}
        onChangeCompiler={handleUpdateCompiler}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={mode}
        onChangeMode={handleSwitchMode}
        editorSettings={editorSettings}
        onUpdateEditor={setEditorSettings}
        compilerSettings={compilerSettings}
        onUpdateCompiler={handleUpdateCompiler}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />
    </div>
  );
}