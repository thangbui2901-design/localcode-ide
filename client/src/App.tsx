import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { FileTypeIcon } from './components/FileTypeIcon';
import {
  Play,
  Square,
  Palette,
  FolderOpen,
  Search,
  Settings,
  Columns,
  Sparkles,
  Wand2,
  Download,
  Upload,
  PanelLeft,
  PanelBottom,
  X,
  Plus,
  MoreHorizontal,
  Cpu,
  Check,
  Maximize2,
  Minimize2,
  Radio,
  ImagePlus
} from 'lucide-react';
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
import { executeWithPiston, terminateCloudExecution } from './services/pistonRunner';
import { ExplorerSidebar } from './components/ExplorerSidebar';
import { SearchSidebar } from './components/SearchSidebar';
import { CodeEditor } from './components/CodeEditor';
import { BottomPanel, TerminalChunk } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { MobileCodingToolbar } from './components/MobileCodingToolbar';
import { MobileNav, MobileTab } from './components/MobileNav';
import { HeaderTimer } from './components/HeaderTimer';
import { FloatingToast, ToastItem, ToastTone } from './components/FloatingToast';
import { WebPreviewPane } from './components/WebPreviewPane';

export type UiThemeId =
  | 'midnight-indigo'
  | 'cyber-emerald'
  | 'dracula-neon'
  | 'vscode-dark'
  | 'lavender-light'
  | 'solarized-light';

export type UiDensity = 'bento' | 'compact';

interface ThemeOption {
  id: UiThemeId;
  name: string;
  mode: 'dark' | 'light';
  bgSwatch: string;
  accentSwatch: string;
  monacoTheme: string;
}

const UI_THEMES: ThemeOption[] = [
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    mode: 'dark',
    bgSwatch: '#111022',
    accentSwatch: '#7C5CFF',
    monacoTheme: 'vs-dark-modern'
  },
  {
    id: 'cyber-emerald',
    name: 'Cyber Emerald',
    mode: 'dark',
    bgSwatch: '#0C1714',
    accentSwatch: '#10B981',
    monacoTheme: 'vs-dark-modern'
  },
  {
    id: 'dracula-neon',
    name: 'Dracula Neon',
    mode: 'dark',
    bgSwatch: '#1B1C26',
    accentSwatch: '#BD93F9',
    monacoTheme: 'vs-dark-modern'
  },
  {
    id: 'vscode-dark',
    name: 'VS Code Dark+',
    mode: 'dark',
    bgSwatch: '#1E1E1E',
    accentSwatch: '#0EA5E9',
    monacoTheme: 'vs-dark-modern'
  },
  {
    id: 'lavender-light',
    name: 'Lavender Daylight',
    mode: 'light',
    bgSwatch: '#FFFFFF',
    accentSwatch: '#6D4AFF',
    monacoTheme: 'code-ide-light'
  },
  {
    id: 'solarized-light',
    name: 'Solarized Paper',
    mode: 'light',
    bgSwatch: '#FDF6E3',
    accentSwatch: '#D97706',
    monacoTheme: 'code-ide-light'
  }
];

function getAllMonacoNamespaces(): Array<typeof monaco> {
  const namespaces: Array<typeof monaco> = [];
  if (monaco?.languages && monaco?.editor) {
    namespaces.push(monaco);
  }
  if (typeof window !== 'undefined') {
    const winMonaco = (window as any).monaco;
    if (winMonaco?.languages && winMonaco?.editor && !namespaces.includes(winMonaco)) {
      namespaces.push(winMonaco);
    }
  }
  return namespaces;
}

function ensureBuiltInIntelliSense() {
  // Đã chuyển sang CodeEditor.tsx
}

function applyEnhancedEditorBehavior(_editor: monaco.editor.ICodeEditor) {
  // Đã chuyển sang CodeEditor.tsx
}

function applyMonacoThemeForUi(themeId: UiThemeId) {
  const themeMeta = UI_THEMES.find((t) => t.id === themeId) || UI_THEMES[0];
  getAllMonacoNamespaces().forEach((m) => {
    try {
      if (themeMeta.mode === 'dark') {
        m.editor.defineTheme('vs-dark-modern', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6E7191', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'A78BFA', fontStyle: 'bold' },
            { token: 'string', foreground: '5EEAD4' },
            { token: 'number', foreground: 'F472B6' },
            { token: 'type', foreground: '38BDF8' }
          ],
          colors: {
            'editor.background': themeMeta.bgSwatch,
            'editor.foreground': '#ECEAF8',
            'editor.lineHighlightBackground': '#FFFFFF0B',
            'editor.selectionBackground': `${themeMeta.accentSwatch}44`,
            'editorCursor.foreground': themeMeta.accentSwatch,
            'editorLineNumber.foreground': '#5C5F7A',
            'editorLineNumber.activeForeground': themeMeta.accentSwatch
          }
        });
        m.editor.setTheme('vs-dark-modern');
      } else {
        m.editor.defineTheme('code-ide-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '8C89A6', fontStyle: 'italic' },
            { token: 'keyword', foreground: '6D4AFF', fontStyle: 'bold' },
            { token: 'string', foreground: '0D9488' },
            { token: 'number', foreground: 'DB2777' },
            { token: 'type', foreground: '0284C7' }
          ],
          colors: {
            'editor.background': themeMeta.bgSwatch,
            'editor.foreground': '#17162B',
            'editor.lineHighlightBackground': '#00000008',
            'editor.selectionBackground': `${themeMeta.accentSwatch}28`,
            'editorCursor.foreground': themeMeta.accentSwatch,
            'editorLineNumber.foreground': '#9E9BB8',
            'editorLineNumber.activeForeground': themeMeta.accentSwatch
          }
        });
        m.editor.setTheme('code-ide-light');
      }
    } catch {
      // Bỏ qua nếu Monaco chưa mount xong
    }
  });
}

function detectLanguage(fileName: string): SupportedLanguage {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.c')) return 'c';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(lower)) return 'asset';
  return 'cpp';
}

function isWebLanguage(lang?: SupportedLanguage): boolean {
  return lang === 'html' || lang === 'css' || lang === 'javascript' || lang === 'json' || lang === 'asset';
}

function getFileBadgeColor(lang: SupportedLanguage): string {
  if (lang === 'python') return 'bg-emerald-500/15 text-emerald-500';
  if (lang === 'c') return 'bg-sky-500/15 text-sky-500';
  if (lang === 'markdown') return 'bg-amber-500/15 text-amber-500';
  if (lang === 'html') return 'bg-orange-500/15 text-orange-500';
  if (lang === 'css') return 'bg-cyan-500/15 text-cyan-500';
  if (lang === 'javascript') return 'bg-yellow-500/15 text-yellow-500';
  if (lang === 'json') return 'bg-lime-500/15 text-lime-500';
  if (lang === 'asset') return 'bg-pink-500/15 text-pink-500';
  return 'bg-violet-500/15 text-violet-500';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const { breakpoint, width, height, isKeyboardOpen } = useViewport();
  const primaryEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const secondaryEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const runWsRef = useRef<WebSocket | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const sidebarAssetInputRef = useRef<HTMLInputElement | null>(null);

  const liveContentMapRef = useRef<Record<string, string>>({});

  const [toast, setToast] = useState<ToastItem | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now() + Math.random(), message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 1850);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [uiTheme, setUiTheme] = useState<UiThemeId>(() => {
    const saved = localStorage.getItem('codeide_ui_theme') as UiThemeId | null;
    return UI_THEMES.some((t) => t.id === saved) ? (saved as UiThemeId) : 'midnight-indigo';
  });

  const [uiDensity, setUiDensity] = useState<UiDensity>(() => {
    const saved = localStorage.getItem('codeide_ui_density');
    return saved === 'compact' ? 'compact' : 'bento';
  });

  const [typingSound, setTypingSound] = useState<boolean>(() => {
    const saved = localStorage.getItem('codeide_typing_sound');
    return saved === null ? true : saved === 'true';
  });

  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const currentThemeObj = UI_THEMES.find((t) => t.id === uiTheme) || UI_THEMES[0];

  useEffect(() => {
    localStorage.setItem('codeide_typing_sound', String(typingSound));
  }, [typingSound]);

  useEffect(() => {
    const syncAllMonaco = () => {
      ensureBuiltInIntelliSense();
      applyMonacoThemeForUi(uiTheme);
      getAllMonacoNamespaces().forEach((m) => {
        m.editor.getEditors().forEach((ed) => applyEnhancedEditorBehavior(ed));
      });
      if (primaryEditorRef.current) applyEnhancedEditorBehavior(primaryEditorRef.current);
      if (secondaryEditorRef.current) applyEnhancedEditorBehavior(secondaryEditorRef.current);
    };

    syncAllMonaco();

    const disposables: monaco.IDisposable[] = [];
    getAllMonacoNamespaces().forEach((m) => {
      disposables.push(
        m.editor.onDidCreateEditor((ed) => {
          syncAllMonaco();
          applyEnhancedEditorBehavior(ed);
        })
      );
    });

    const poll = window.setInterval(() => {
      syncAllMonaco();
      if ((window as any).monaco && primaryEditorRef.current) {
        window.clearInterval(poll);
      }
    }, 200);

    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 12000);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stopPoll);
      disposables.forEach((d) => d.dispose());
    };
  }, [uiTheme]);

  const [mode, setMode] = useState<ExecutionMode>('standalone');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openTabPaths, setOpenTabPaths] = useState<string[]>([]);

  const [primaryPath, setPrimaryPath] = useState<string | null>(null);
  const [secondaryPath, setSecondaryPath] = useState<string | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [activePane, setActivePane] = useState<'primary' | 'secondary'>('primary');

  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const [previewHtmlPath, setPreviewHtmlPath] = useState<string | null>(null);
  const [liveRevision, setLiveRevision] = useState(0);

  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [activeLineCount, setActiveLineCount] = useState<number>(1);
  const [sidebarView, setSidebarView] = useState<'explorer' | 'search' | null>('explorer');
  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('codeide_bottom_height'));
    return saved >= 150 && saved <= 560 ? saved : 240;
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const [logs, setLogs] = useState<TerminalChunk[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  const [diagnosticsMap, setDiagnosticsMap] = useState<Record<string, IdeDiagnostic[]>>({});

  const [stdinPreset, setStdinPreset] = useState<string>(() => localStorage.getItem('localcode_stdin') || '');
  const [autoEof, setAutoEof] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem('localcode_stdin', stdinPreset);
  }, [stdinPreset]);

  useEffect(() => {
    localStorage.setItem('codeide_bottom_height', String(bottomHeight));
  }, [bottomHeight]);

  useEffect(() => {
    ensureBuiltInIntelliSense();
    if (primaryEditorRef.current) applyEnhancedEditorBehavior(primaryEditorRef.current);
    if (secondaryEditorRef.current) applyEnhancedEditorBehavior(secondaryEditorRef.current);
  }, [breakpoint, splitOpen, livePreviewOpen, primaryPath, secondaryPath]);

  const startResizeBottom = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const nextH = Math.min(560, Math.max(150, startH + delta));
      setBottomHeight(nextH);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    tabSize: 4,
    wordWrap: 'off',
    minimap: false,
    lineNumbers: 'on',
    autoSave: true,
    formatOnSave: false,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    theme: currentThemeObj.monacoTheme
  });

  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>({
    cStandard: 'c11',
    cppStandard: 'gnu++17',
    pistonUrl: 'https://emkc.org/api/v2/piston/execute'
  });

  useEffect(() => {
    if (!themePickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemePickerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [themePickerOpen]);

  useEffect(() => {
    localStorage.setItem('codeide_ui_theme', uiTheme);
    localStorage.setItem('codeide_ui_density', uiDensity);

    document.documentElement.setAttribute('data-ui-theme', uiTheme);
    document.documentElement.setAttribute('data-ui-density', uiDensity);
    document.documentElement.classList.toggle('dark', currentThemeObj.mode === 'dark');

    setEditorSettings((prev) => ({ ...prev, theme: currentThemeObj.monacoTheme }));
    applyMonacoThemeForUi(uiTheme);
    const timer = window.setTimeout(() => applyMonacoThemeForUi(uiTheme), 100);
    return () => window.clearTimeout(timer);
  }, [uiTheme, uiDensity, currentThemeObj]);

  const cycleNextTheme = () => {
    const idx = UI_THEMES.findIndex((t) => t.id === uiTheme);
    const next = UI_THEMES[(idx + 1) % UI_THEMES.length];
    setUiTheme(next.id);
    showToast(`Theme: ${next.name}`, 'info');
  };

  const isFocusMode = !sidebarView && !bottomOpen;
  const toggleFocusMode = () => {
    if (isFocusMode) {
      setSidebarView('explorer');
      setBottomOpen(true);
      showToast('Đã thoát chế độ Tập trung', 'info');
    } else {
      setSidebarView(null);
      setBottomOpen(false);
      showToast('Chế độ Tập trung (Zen Mode)', 'info');
    }
  };

  const primaryFile = files.find((f) => f.path === primaryPath) || null;
  const secondaryFile = files.find((f) => f.path === secondaryPath) || null;
  const activeFile = splitOpen && activePane === 'secondary' ? secondaryFile : primaryFile;
  const activeEditorRef = splitOpen && activePane === 'secondary' ? secondaryEditorRef : primaryEditorRef;

  const hasWebFiles = useMemo(() => files.some((f) => isWebLanguage(f.language)), [files]);
  const showLiveServerBtn = isWebLanguage(activeFile?.language) || hasWebFiles || livePreviewOpen;

  const liveFiles = useMemo(
    () =>
      files.map((f) => ({
        ...f,
        content: liveContentMapRef.current[f.path] ?? f.content
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, liveRevision]
  );

  useEffect(() => {
    if (!activeFile) {
      setActiveLineCount(0);
      return;
    }
    if (activeFile.language === 'asset') {
      setActiveLineCount(1);
      return;
    }
    const content = liveContentMapRef.current[activeFile.path] ?? activeFile.content;
    setActiveLineCount(content.split('\n').length);
  }, [activeFile]);

  const openTabs = openTabPaths
    .map((p) => files.find((f) => f.path === p))
    .filter((f): f is WorkspaceFile => Boolean(f));

  const allDiagnostics = Object.values(diagnosticsMap).flat();

  const flushLiveContent = useCallback(() => {
    const map = liveContentMapRef.current;
    setFiles((prev) =>
      prev.map((f) =>
        map[f.path] !== undefined && map[f.path] !== f.content ? { ...f, content: map[f.path] } : f
      )
    );
  }, []);

  const loadWorkspaceForMode = useCallback(async (targetMode: ExecutionMode) => {
    if (targetMode === 'local') {
      const data = await fetch('/api/files').then((r) => r.json());
      const loaded: WorkspaceFile[] = (data.files || []).map((f: any) => ({
        ...f,
        language: detectLanguage(f.name)
      }));
      const nextMap: Record<string, string> = {};
      loaded.forEach((f) => {
        nextMap[f.path] = f.content;
      });
      liveContentMapRef.current = nextMap;
      setTree(data.tree || []);
      setFiles(loaded);
      return loaded;
    } else {
      const data = await loadIdbWorkspace();
      const loaded: WorkspaceFile[] = data.files.map((f) => ({
        ...f,
        language: detectLanguage(f.name)
      }));
      const nextMap: Record<string, string> = {};
      loaded.forEach((f) => {
        nextMap[f.path] = f.content;
      });
      liveContentMapRef.current = nextMap;
      setTree(data.tree);
      setFiles(loaded);
      return loaded;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let detectedMode: ExecutionMode = 'standalone';
      const isCapacitorNative =
        window.location.protocol === 'capacitor:' ||
        Boolean(
          (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
            ?.isNativePlatform?.()
        );

      for (let attempt = 0; !isCapacitorNative && attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 1200);
          const res = await fetch('/api/files', { signal: controller.signal });
          window.clearTimeout(timer);
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            detectedMode = 'local';
            break;
          }
        } catch {
          // Đợi backend mở cổng
        }
        if (attempt < 2) {
          await new Promise((r) => window.setTimeout(r, 700));
        }
      }

      if (cancelled) return;
      setMode(detectedMode);
      const loaded = await loadWorkspaceForMode(detectedMode);
      if (loaded.length > 0) {
        const initialTabs = loaded.slice(0, 4).map((f) => f.path);
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
    try {
      const loaded = await loadWorkspaceForMode(nextMode);
      setMode(nextMode);
      setDiagnosticsMap({});
      if (loaded.length > 0) {
        setOpenTabPaths(loaded.slice(0, 4).map((f) => f.path));
        setPrimaryPath(loaded[0].path);
        setSecondaryPath(loaded[1]?.path || null);
      }
      showToast(
        nextMode === 'local' ? 'Đã chuyển sang Local PC Server' : 'Đã chuyển sang Cloud + WASM',
        'info'
      );
    } catch {
      setMode('standalone');
      showToast('Không kết nối được Local PC Server', 'error');
      setLogs((prev) => [
        ...prev,
        {
          type: 'stderr',
          text: 'Không kết nối được Local PC Server. Đang giữ chế độ Cloud + WASM.\n'
        }
      ]);
    }
  };

  const openFileInActivePane = useCallback(
    (file: WorkspaceFile) => {
      flushLiveContent();
      if (!openTabPaths.includes(file.path)) {
        setOpenTabPaths((prev) => [...prev, file.path]);
      }
      if (file.language === 'html') {
        setPreviewHtmlPath(file.path);
      }
      if (splitOpen && activePane === 'secondary') {
        setSecondaryPath(file.path);
      } else {
        setPrimaryPath(file.path);
      }
    },
    [openTabPaths, splitOpen, activePane, flushLiveContent]
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
    async (fileToSave?: WorkspaceFile, explicitContent?: string, manualTrigger = false) => {
      const target = fileToSave || activeFile;
      if (!target) return;
      let content = explicitContent ?? liveContentMapRef.current[target.path] ?? target.content;

      if (mode === 'local') {
        if (editorSettings.formatOnSave && target.language !== 'asset') {
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

      const latestLive = liveContentMapRef.current[target.path];
      if (latestLive === undefined || latestLive === content) {
        liveContentMapRef.current[target.path] = content;
        setFiles((prev) =>
          prev.map((f) => (f.path === target.path ? { ...f, content, dirty: false } : f))
        );
      }

      if (manualTrigger) {
        showToast(`Đã lưu ${target.name}`, 'success');
      }
    },
    [activeFile, mode, editorSettings.formatOnSave, showToast]
  );

  const handleCodeChange = (targetFile: WorkspaceFile | null, newCode: string) => {
    if (!targetFile) return;

    liveContentMapRef.current[targetFile.path] = newCode;
    syncDocument(targetFile, newCode);

    if (isWebLanguage(targetFile.language)) {
      setLiveRevision((r) => r + 1);
    }

    if (activeFile?.path === targetFile.path) {
      setActiveLineCount(newCode.split('\n').length);
    }

    if (!targetFile.dirty) {
      setFiles((prev) =>
        prev.map((f) => (f.path === targetFile.path ? { ...f, dirty: true } : f))
      );
    }

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      if (editorSettings.autoSave) {
        const latest = liveContentMapRef.current[targetFile.path] ?? newCode;
        saveFile(targetFile, latest, false);
      }
    }, 450);
  };

  const handleImportAssets = useCallback(
    async (fileList: FileList) => {
      flushLiveContent();
      const items = Array.from(fileList);
      if (items.length === 0) return;

      let lastImportedName = '';
      for (const item of items) {
        const isJson = item.name.toLowerCase().endsWith('.json');
        const content = isJson ? await item.text() : await readFileAsDataUrl(item);
        const relPath = item.name;

        if (mode === 'local') {
          await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: relPath, content })
          });
        } else {
          await saveIdbFile(relPath, content);
        }
        lastImportedName = relPath;
      }

      await loadWorkspaceForMode(mode);
      setLiveRevision((r) => r + 1);
      showToast(
        items.length === 1
          ? `Đã thêm ${lastImportedName} (dùng ./${lastImportedName})`
          : `Đã thêm ${items.length} tệp tài nguyên vào Workspace`,
        'success'
      );
    },
    [flushLiveContent, mode, loadWorkspaceForMode, showToast]
  );

  const handleToggleLiveServer = () => {
    setLivePreviewOpen((prev) => {
      const next = !prev;
      if (next) {
        if (splitOpen) setSplitOpen(false);
        if (activeFile?.language === 'html') setPreviewHtmlPath(activeFile.path);
        setLiveRevision((r) => r + 1);
        showToast('Live Server đang chạy (Cổng 5500)', 'success');
      } else {
        showToast('Đã tắt Live Server', 'info');
      }
      return next;
    });
  };

  const handlePreviewConsole = useCallback((type: 'stdout' | 'stderr', text: string) => {
    setLogs((prev) => [...prev, { type, text }]);
  }, []);

  const handleRun = async () => {
    if (!activeFile || isRunning) return;

    const liveContent =
      activeFile.language === 'asset'
        ? activeFile.content
        : (activeEditorRef.current?.getValue() ??
          liveContentMapRef.current[activeFile.path] ??
          activeFile.content);
    const currentFile: WorkspaceFile = { ...activeFile, content: liveContent };

    await saveFile(currentFile, liveContent, false);

    if (isWebLanguage(currentFile.language)) {
      if (splitOpen) setSplitOpen(false);
      if (currentFile.language === 'html') setPreviewHtmlPath(currentFile.path);
      setLivePreviewOpen(true);
      setLiveRevision((r) => r + 1);
      setLogs([
        {
          type: 'status',
          text: `[Live Server] Đang phục vụ ${currentFile.name} tại http://127.0.0.1:5500 (CSS Hot-Reload đang bật)\n`
        }
      ]);
      showToast(`Live Server: ${currentFile.name}`, 'success');
      return;
    }

    setIsRunning(true);
    setLastElapsedMs(null);
    setLogs([]);
    if (breakpoint === 'mobile') {
      setMobileTab('terminal');
    } else {
      setBottomOpen(true);
    }

    if (mode === 'standalone') {
      const latestFiles = files.map((f) => ({
        ...f,
        content: f.path === currentFile.path ? liveContent : (liveContentMapRef.current[f.path] ?? f.content)
      }));
      try {
        await executeWithPiston(currentFile, latestFiles, compilerSettings, stdinPreset, {
          onChunk: (type, text) => {
            setLogs((prev) => [...prev, { type, text }]);
          },
          onFinish: (code, elapsedMs) => {
            setIsRunning(false);
            setLastElapsedMs(elapsedMs);
            setLogs((prev) => [
              ...prev,
              { type: 'status', text: `\n[Hoàn thành với mã ${code} trong ${elapsedMs}ms]\n` }
            ]);
          }
        });
      } catch (err: any) {
        setIsRunning(false);
        setLogs((prev) => [
          ...prev,
          { type: 'stderr', text: `Lỗi thực thi Cloud: ${err?.message || 'Không xác định'}\n` }
        ]);
      }
      return;
    }

    runWsRef.current?.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/run`);
    runWsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'run',
          filePath: currentFile.path,
          fileName: currentFile.name,
          code: liveContent,
          language: currentFile.language,
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
        setLastElapsedMs(msg.elapsedMs);
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

  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;

  const saveFileRef = useRef(saveFile);
  saveFileRef.current = saveFile;

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      const keyLower = e.key.toLowerCase();

      if (
        e.key === 'F5' ||
        (isModifier && e.key === 'Enter') ||
        (e.metaKey && !e.shiftKey && keyLower === 'r')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRunRef.current();
        return;
      }

      if (isModifier && keyLower === 's') {
        e.preventDefault();
        e.stopPropagation();
        saveFileRef.current(undefined, undefined, true);
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onGlobalKeyDown, { capture: true });
  }, []);

  const handleSendStdin = (line: string) => {
    setLogs((prev) => [...prev, { type: 'stdin', text: line }]);
    if (runWsRef.current?.readyState === WebSocket.OPEN) {
      runWsRef.current.send(JSON.stringify({ type: 'stdin', data: line }));
    }
  };

  const handleKill = () => {
    if (mode === 'standalone') {
      terminateCloudExecution();
    } else {
      runWsRef.current?.send(JSON.stringify({ type: 'kill' }));
    }
    showToast('Đã dừng thực thi', 'info');
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
    flushLiveContent();
    const initialContent = relPath.toLowerCase().endsWith('.html')
      ? `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Live Server Demo</title>\n</head>\n<body>\n  <h1>Xin chào Live Server!</h1>\n</body>\n</html>\n`
      : '';

    if (mode === 'local') {
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath, content: initialContent })
      });
    } else {
      await saveIdbFile(relPath, initialContent);
    }

    const updated = await loadWorkspaceForMode(mode);
    const created = updated.find((f) => f.path === relPath);
    if (created) openFileInActivePane(created);
    showToast(`Đã tạo tệp ${relPath}`, 'success');
  };

  const handleCreateFolder = async (relPath: string) => {
    flushLiveContent();
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
    showToast(`Đã tạo thư mục ${relPath}`, 'success');
  };

  const handleDeleteEntry = async (relPath: string) => {
    delete liveContentMapRef.current[relPath];
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
    showToast(`Đã xóa ${relPath}`, 'info');
  };

  const handleQuickNewFile = async () => {
    const baseName = `untitled_${files.length + 1}.cpp`;
    await handleCreateFile(baseName);
  };

  const handleCreateTemplateFile = async (relPath: string, initialContent: string) => {
    flushLiveContent();
    if (mode === 'local') {
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath, content: initialContent })
      });
    } else {
      await saveIdbFile(relPath, initialContent);
    }

    const updated = await loadWorkspaceForMode(mode);
    const created = updated.find((f) => f.path === relPath);
    if (created) openFileInActivePane(created);
    showToast(`Đã tạo ${relPath}`, 'success');
  };

  /** Khởi tạo nhanh bộ 3 tệp HTML + CSS + JS đã liên kết sẵn */
  const handleCreateWebStarterProject = async () => {
    flushLiveContent();
    const hasRootIndex = files.some((f) => f.path === 'index.html');
    const prefix = hasRootIndex ? `web_${Date.now().toString().slice(-3)}/` : '';

    const starterFiles: Array<{ path: string; content: string }> = [
      {
        path: `${prefix}index.html`,
        content: [
          '<!DOCTYPE html>',
          '<html lang="vi">',
          '<head>',
          '  <meta charset="UTF-8" />',
          '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          '  <title>Web Starter Project</title>',
          '  <link rel="stylesheet" href="style.css" />',
          '</head>',
          '<body>',
          '  <main class="card">',
          '    <span class="badge">● LIVE :5500</span>',
          '    <h1>Xin chào Web Starter!</h1>',
          '    <p>Chỉnh sửa <code>style.css</code> hoặc <code>app.js</code> và bấm Go Live để xem trực tiếp.</p>',
          '    <button id="actionBtn">Bấm thử: <span id="counter">0</span></button>',
          '  </main>',
          '  <script type="module" src="app.js"></script>',
          '</body>',
          '</html>',
          ''
        ].join('\n')
      },
      {
        path: `${prefix}style.css`,
        content: [
          ':root {',
          '  --bg: #0f111a;',
          '  --card: #181b2a;',
          '  --accent: #7c5cff;',
          '  --text: #f8fafc;',
          '}',
          '',
          '* {',
          '  box-sizing: border-box;',
          '  margin: 0;',
          '  padding: 0;',
          '}',
          '',
          'body {',
          '  min-height: 100vh;',
          '  display: grid;',
          '  place-items: center;',
          '  background: var(--bg);',
          '  color: var(--text);',
          '  font-family: system-ui, -apple-system, sans-serif;',
          '  padding: 20px;',
          '}',
          '',
          '.card {',
          '  max-width: 440px;',
          '  background: var(--card);',
          '  padding: 28px;',
          '  border-radius: 24px;',
          '  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);',
          '}',
          '',
          '.badge {',
          '  display: inline-block;',
          '  font-size: 11px;',
          '  font-weight: 700;',
          '  color: #10b981;',
          '  background: rgba(16, 185, 129, 0.15);',
          '  padding: 4px 10px;',
          '  border-radius: 999px;',
          '  margin-bottom: 12px;',
          '}',
          '',
          'h1 {',
          '  font-size: 22px;',
          '  margin-bottom: 8px;',
          '}',
          '',
          'p {',
          '  font-size: 14px;',
          '  opacity: 0.8;',
          '  line-height: 1.6;',
          '  margin-bottom: 18px;',
          '}',
          '',
          'button {',
          '  border: none;',
          '  border-radius: 12px;',
          '  padding: 10px 18px;',
          '  background: var(--accent);',
          '  color: #fff;',
          '  font-weight: 600;',
          '  cursor: pointer;',
          '}',
          ''
        ].join('\n')
      },
      {
        path: `${prefix}app.js`,
        content: [
          'let count = 0;',
          'const btn = document.getElementById("actionBtn");',
          'const counterEl = document.getElementById("counter");',
          '',
          'console.log("Web Starter đã sẵn sàng!");',
          '',
          'btn?.addEventListener("click", () => {',
          '  count += 1;',
          '  if (counterEl) counterEl.textContent = String(count);',
          '  console.log("Số lần bấm:", count);',
          '});',
          ''
        ].join('\n')
      }
    ];

    if (prefix) {
      if (mode === 'local') {
        await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: prefix.slice(0, -1) })
        });
      } else {
        await createIdbFolder(prefix.slice(0, -1));
      }
    }

    for (const item of starterFiles) {
      if (mode === 'local') {
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.path, content: item.content })
        });
      } else {
        await saveIdbFile(item.path, item.content);
      }
    }

    const updated = await loadWorkspaceForMode(mode);
    const createdPaths = starterFiles.map((s) => s.path);
    setOpenTabPaths((prev) => Array.from(new Set([...prev, ...createdPaths])));
    const htmlEntry = updated.find((f) => f.path === createdPaths[0]);
    if (htmlEntry) {
      setPreviewHtmlPath(htmlEntry.path);
      openFileInActivePane(htmlEntry);
    }
    showToast(`Đã tạo Web Starter (${prefix || 'index.html, style.css, app.js'})`, 'success');
  };

  const handleToggleSplit = () => {
    flushLiveContent();
    setSplitOpen((prev) => {
      const next = !prev;
      if (next) {
        setLivePreviewOpen(false);
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
    if (!activeFile || activeFile.language === 'asset') return;
    const currentCode =
      activeEditorRef.current?.getValue() ??
      liveContentMapRef.current[activeFile.path] ??
      activeFile.content;

    if (mode === 'local' && !isWebLanguage(activeFile.language)) {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, language: activeFile.language })
      }).then((r) => r.json());
      if (res.formatted) {
        liveContentMapRef.current[activeFile.path] = res.formatted;
        setFiles((prev) =>
          prev.map((f) => (f.path === activeFile.path ? { ...f, content: res.formatted, dirty: true } : f))
        );
      }
    } else {
      activeEditorRef.current?.getAction('editor.action.formatDocument')?.run();
    }
    showToast(`Đã căn chỉnh ${activeFile.name}`, 'success');
  };

  const handleExportBackup = async () => {
    flushLiveContent();
    const json = await exportIdbWorkspaceJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-ide-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất bản sao lưu Workspace (.json)', 'success');
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      await importIdbWorkspaceJson(text);
      const loaded = await loadWorkspaceForMode('standalone');
      if (loaded.length > 0) {
        setOpenTabPaths(loaded.slice(0, 4).map((f) => f.path));
        setPrimaryPath(loaded[0].path);
      }
      showToast(`Đã khôi phục ${loaded.length} tệp từ bản sao lưu`, 'success');
    } catch {
      showToast('Tệp sao lưu không hợp lệ', 'error');
    }
  };

  const closeTab = (closedPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    flushLiveContent();
    const next = openTabPaths.filter((p) => p !== closedPath);
    setOpenTabPaths(next);
    if (primaryPath === closedPath) setPrimaryPath(next[next.length - 1] || null);
    if (secondaryPath === closedPath) setSecondaryPath(next[next.length - 1] || null);
  };

  const mobileToolbarLang =
    primaryFile?.language === 'python' ||
    primaryFile?.language === 'c' ||
    primaryFile?.language === 'cpp' ||
    primaryFile?.language === 'markdown'
      ? primaryFile.language
      : 'cpp';

  /* ===================== MOBILE VIEW ===================== */
  if (breakpoint === 'mobile') {
    return (
      <div
        style={{ paddingTop: 'var(--safe-top)', backgroundColor: 'var(--bg-canvas)' }}
        className="w-full h-full flex flex-col overflow-hidden theme-scope"
      >
        <header
          style={{ backgroundColor: 'var(--bg-panel)' }}
          className="mx-2 mt-2 h-12 px-3 rounded-2xl flex items-center justify-between shrink-0 shadow-md"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate">{activeFile?.name || 'Code IDE'}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <HeaderTimer />

            <button
              onClick={cycleNextTheme}
              className="h-9 px-2.5 rounded-xl flex items-center gap-1.5 bg-[var(--bg-elevated)] btn-lift text-xs font-medium"
              title="Đổi giao diện"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentThemeObj.accentSwatch }}
              />
              <Palette size={14} />
            </button>

            <button
              onClick={handleRun}
              disabled={isRunning}
              className="h-9 px-3.5 rounded-xl accent-btn font-semibold text-xs flex items-center justify-center gap-1.5 btn-lift"
            >
              <Play size={13} fill="currentColor" />
              <span>{isWebLanguage(activeFile?.language) ? 'Live' : isRunning ? '...' : 'Run'}</span>
            </button>

            <button
              onClick={() => setMobileMoreOpen((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--bg-elevated)] btn-lift"
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        </header>

        {mobileMoreOpen && (
          <div className="mx-2 mt-1.5 ide-card px-3 py-2.5 flex flex-col gap-2 text-xs tab-content-enter">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>
                Theme: <b style={{ color: 'var(--text-primary)' }}>{currentThemeObj.name}</b>
              </span>
              <button
                onClick={cycleNextTheme}
                className="py-1.5 px-3 rounded-xl bg-[var(--bg-elevated)] btn-lift font-medium"
              >
                Đổi Theme khác
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  handleFormat();
                  setMobileMoreOpen(false);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--bg-elevated)] btn-lift font-medium"
              >
                Format Code
              </button>
              <button
                onClick={() => {
                  setEditorSettings((s) => ({ ...s, lineNumbers: s.lineNumbers === 'on' ? 'off' : 'on' }));
                  setMobileMoreOpen(false);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--bg-elevated)] btn-lift font-medium"
              >
                Số dòng: {editorSettings.lineNumbers.toUpperCase()}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col p-2 relative">
          <div
            key={mobileTab}
            className={`flex-1 min-h-0 flex flex-col ide-card overflow-hidden tab-content-enter ${
              mobileTab === 'editor' ? 'flex' : 'hidden'
            }`}
          >
            {livePreviewOpen ? (
              <WebPreviewPane
                files={liveFiles}
                activeFile={primaryFile}
                selectedHtmlPath={previewHtmlPath}
                revision={liveRevision}
                onSelectHtmlPath={setPreviewHtmlPath}
                onImportAssets={handleImportAssets}
                onConsoleMessage={handlePreviewConsole}
                onExportSuccess={(name) => showToast(`Đã xuất tệp ${name} độc lập`, 'success')}
                onClose={() => setLivePreviewOpen(false)}
              />
            ) : (
              <>
                <CodeEditor
                  file={primaryFile}
                  settings={editorSettings}
                  breakpoint="mobile"
                  editorRef={primaryEditorRef}
                  typingSound={typingSound}
                  onChange={(val) => handleCodeChange(primaryFile, val)}
                  onSave={() => saveFile(primaryFile || undefined, undefined, true)}
                  onRun={handleRun}
                  onCursorChange={(line, column) => setCursor({ line, column })}
                  onQuickCreateTemplate={handleCreateTemplateFile}
                  onQuickCreateWebProject={handleCreateWebStarterProject}
                />
                <MobileCodingToolbar language={mobileToolbarLang} onInsertToken={handleInsertToken} />
              </>
            )}
          </div>

          {mobileTab === 'files' && (
            <div className="flex-1 min-h-0 ide-card overflow-hidden tab-content-enter explorer-clean">
              <ExplorerSidebar
                tree={tree}
                files={files}
                activeFile={primaryFile}
                onSelectFile={(f) => {
                  flushLiveContent();
                  setPrimaryPath(f.path);
                  setLivePreviewOpen(false);
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
            <div
              className="flex-1 min-h-0 flex flex-col justify-end rounded-2xl overflow-hidden tab-content-enter"
              onClick={() => setMobileTab('editor')}
            >
              <div onClick={(e) => e.stopPropagation()} className="ide-card overflow-hidden">
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
                  onKill={handleKill}
                  onClear={() => setLogs([])}
                  onJumpToDiagnostic={(d) => {
                    const found = files.find((f) => f.uri === d.uri);
                    if (found) {
                      flushLiveContent();
                      setPrimaryPath(found.path);
                    }
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
          uiTheme={uiTheme}
          onChangeUiTheme={setUiTheme}
          uiDensity={uiDensity}
          onChangeUiDensity={setUiDensity}
          typingSound={typingSound}
          onChangeTypingSound={setTypingSound}
        />

        <FloatingToast toast={toast} isMobile />

        {!isKeyboardOpen && (
          <MobileNav activeTab={mobileTab} onSelectTab={(t) => setMobileTab(t)} problemCount={allDiagnostics.length} />
        )}
      </div>
    );
  }

  /* ===================== DESKTOP & IPAD TABLET VIEW ===================== */
  const splitDirection = breakpoint === 'tablet' && width < height ? 'flex-col' : 'flex-row';
  const outerGapClass = uiDensity === 'compact' ? 'px-1.5 gap-1.5' : 'px-2.5 gap-2.5';

  return (
    <div
      style={{
        paddingTop: `calc(var(--safe-top) + ${uiDensity === 'compact' ? '4px' : '8px'})`,
        paddingBottom: `calc(var(--safe-bottom) + ${uiDensity === 'compact' ? '4px' : '8px'})`,
        backgroundColor: 'var(--bg-canvas)'
      }}
      className={`w-full h-full flex flex-col ${outerGapClass} overflow-hidden select-none`}
    >
      {/* TOP FLOATING HEADER BAR */}
      <header className="ide-card h-13 px-3.5 py-2 flex items-center justify-between gap-3 shrink-0 relative z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setSidebarView((prev) => (prev ? null : 'explorer'))}
            className={`p-2 rounded-xl text-xs btn-lift shrink-0 ${
              sidebarView
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                : 'bg-transparent text-[var(--text-secondary)]'
            }`}
            title="Ẩn / Hiện thanh thư mục"
          >
            <PanelLeft size={16} />
          </button>

          <div className="hidden md:flex items-center p-1 rounded-2xl bg-[var(--bg-panel-alt)] gap-1 shrink-0">
            <button
              onClick={() => {
                if (splitOpen) handleToggleSplit();
              }}
              className={`tab-pill px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                !splitOpen
                  ? 'accent-pill-active'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles size={13} />
              <span>Single Editor</span>
            </button>

            <button
              onClick={() => {
                if (!splitOpen) handleToggleSplit();
              }}
              className={`tab-pill px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                splitOpen
                  ? 'accent-pill-active'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Columns size={13} />
              <span>Split View</span>
            </button>

            <button
              onClick={() => handleSwitchMode(mode === 'local' ? 'standalone' : 'local')}
              className="tab-pill px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="Chuyển chế độ Cloud (Pyodide/GCC) hoặc Local PC"
            >
              <Cpu size={13} className="text-emerald-500" />
              <span>{mode === 'standalone' ? 'Cloud + WASM' : 'Local PC'}</span>
            </button>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <HeaderTimer />

          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setThemePickerOpen((v) => !v)}
              className="h-9 px-3 rounded-xl bg-[var(--bg-elevated)] flex items-center gap-2 text-xs font-medium btn-lift"
              title="Thay đổi giao diện & bố cục"
            >
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: currentThemeObj.accentSwatch }}
              />
              <Palette size={14} />
              <span className="hidden lg:inline">{currentThemeObj.name}</span>
            </button>

            {themePickerOpen && (
              <div className="absolute right-0 mt-2 w-72 ide-card p-3.5 z-50 tab-content-enter shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Chủ đề màu sắc (Theme)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] uppercase" style={{ color: 'var(--text-secondary)' }}>
                    {currentThemeObj.mode}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 mb-3.5">
                  {UI_THEMES.map((t) => {
                    const selected = t.id === uiTheme;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setUiTheme(t.id);
                          showToast(`Theme: ${t.name}`, 'info');
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all btn-lift ${
                          selected
                            ? 'bg-[var(--bg-active)]'
                            : 'bg-[var(--bg-panel-alt)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-5 h-5 rounded-lg flex items-center justify-center shadow-xs"
                            style={{ backgroundColor: t.bgSwatch }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: t.accentSwatch }}
                            />
                          </span>
                          <span>{t.name}</span>
                        </div>
                        {selected && <Check size={14} style={{ color: t.accentSwatch }} />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Kiểu bố cục (Layout)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <button
                      onClick={() => setUiDensity('bento')}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium btn-lift ${
                        uiDensity === 'bento'
                          ? 'accent-pill-active'
                          : 'bg-[var(--bg-panel-alt)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Bento Bo Góc
                    </button>
                    <button
                      onClick={() => setUiDensity('compact')}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium btn-lift ${
                        uiDensity === 'compact'
                          ? 'accent-pill-active'
                          : 'bg-[var(--bg-panel-alt)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Compact Gọn
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      toggleFocusMode();
                      setThemePickerOpen(false);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--bg-elevated)] text-xs font-medium flex items-center justify-center gap-1.5 btn-lift"
                  >
                    {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isFocusMode ? 'Thoát chế độ Tập trung' : 'Chế độ Tập trung (Zen Mode)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setBottomOpen((v) => !v)}
            className={`h-9 px-2.5 rounded-xl text-xs btn-lift flex items-center gap-1.5 ${
              bottomOpen
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
            title="Ẩn / Hiện bảng Terminal bên dưới"
          >
            <PanelBottom size={15} />
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="h-9 w-9 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-lift"
            title="Cài đặt chi tiết"
          >
            <Settings size={15} />
          </button>

          {isRunning ? (
            <button
              onClick={handleKill}
              className="h-9 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-500/30 btn-lift"
            >
              <Square size={12} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="h-9 px-4 rounded-xl accent-btn font-semibold text-xs flex items-center gap-1.5 btn-lift"
            >
              <Play size={13} fill="currentColor" />
              <span>{isWebLanguage(activeFile?.language) ? 'Go Live' : 'Run Code'}</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className={`flex-1 min-h-0 flex ${uiDensity === 'compact' ? 'gap-1.5' : 'gap-2.5'} relative`}>
        {/* LEFT EXPLORER / SEARCH CARD */}
        {sidebarView && breakpoint === 'desktop' && (
          <aside className="w-64 shrink-0 ide-card flex flex-col overflow-hidden tab-content-enter">
            <div className="p-2.5 flex items-center justify-between gap-1.5">
              <div className="flex-1 flex p-1 rounded-xl bg-[var(--bg-panel-alt)]">
                <button
                  onClick={() => setSidebarView('explorer')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 tab-pill ${
                    sidebarView === 'explorer'
                      ? 'accent-pill-active'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <FolderOpen size={13} />
                  <span>Files</span>
                </button>
                <button
                  onClick={() => setSidebarView('search')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 tab-pill ${
                    sidebarView === 'search'
                      ? 'accent-pill-active'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <Search size={13} />
                  <span>Search</span>
                </button>
              </div>
            </div>

            <div className={`flex-1 min-h-0 overflow-hidden theme-scope ${sidebarView === 'explorer' ? 'explorer-clean' : ''}`}>
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
                />
              )}
            </div>

            <div className="p-3 m-2.5 rounded-2xl bg-[var(--bg-panel-alt)] space-y-2">
              <div className="flex items-center justify-between">
                <span
                  style={{ color: 'var(--text-primary)' }}
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {files.length} tệp trong Workspace
                </span>
              </div>

              <button
                type="button"
                onClick={() => sidebarAssetInputRef.current?.click()}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="w-full py-1.5 px-2.5 rounded-xl font-medium text-[11px] flex items-center justify-center gap-1.5 btn-lift"
              >
                <ImagePlus size={12} className="text-emerald-500" />
                <span>Import Ảnh / Font / JSON</span>
              </button>
              <input
                ref={sidebarAssetInputRef}
                type="file"
                multiple
                accept="image/*,.json,.woff,.woff2,.ttf,.otf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleImportAssets(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExportBackup}
                  className="flex-1 py-1.5 px-2.5 rounded-xl accent-btn font-medium text-[11px] flex items-center justify-center gap-1 btn-lift"
                >
                  <Download size={12} />
                  <span>Backup</span>
                </button>
                <label
                  style={{ color: 'var(--text-primary)' }}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-[var(--bg-elevated)] font-medium text-[11px] flex items-center justify-center gap-1 cursor-pointer btn-lift"
                >
                  <Upload size={12} />
                  <span>Restore</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportBackup(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </aside>
        )}

        {sidebarView && breakpoint === 'tablet' && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex p-3" onClick={() => setSidebarView(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="h-full w-72 ide-card overflow-hidden theme-scope explorer-clean tab-content-enter"
            >
              <ExplorerSidebar
                tree={tree}
                files={files}
                activeFile={activeFile}
                onSelectFile={(f) => {
                  openFileInActivePane(f);
                  setSidebarView(null);
                }}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onDeleteEntry={handleDeleteEntry}
                onRefresh={() => loadWorkspaceForMode(mode)}
                onCloseMobile={() => setSidebarView(null)}
                isOverlay
              />
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: EDITOR (+ LIVE SERVER PREVIEW) ON TOP + TERMINAL AT BOTTOM */}
        <div className={`flex-1 min-w-0 min-h-0 flex flex-col ${uiDensity === 'compact' ? 'gap-1.5' : 'gap-2.5'}`}>
          {/* EDITOR CARD */}
          <main className="flex-1 min-w-0 min-h-0 ide-card flex flex-col overflow-hidden">
            <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between gap-2 bg-[var(--bg-panel-alt)]/60">
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {openTabs.map((tab) => {
                  const isActive = activeFile?.path === tab.path;
                  return (
                    <div
                      key={tab.path}
                      onClick={() => openFileInActivePane(tab)}
                      className={`tab-pill group px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer shrink-0 ${
                        isActive
                          ? 'accent-pill-active'
                          : 'bg-[var(--bg-elevated)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <FileTypeIcon
                        fileName={tab.name}
                        size={15}
                        className={isActive ? 'drop-shadow-xs' : ''}
                      />
                      <span className="truncate max-w-[140px]">{tab.name}</span>
                      {tab.dirty && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-white' : 'bg-[var(--accent-primary)]'
                          }`}
                        />
                      )}
                      <button
                        onClick={(e) => closeTab(tab.path, e)}
                        className={`p-0.5 rounded-md transition-opacity ${
                          isActive
                            ? 'hover:bg-white/20 text-white'
                            : 'opacity-60 group-hover:opacity-100 hover:bg-black/10'
                        }`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={handleQuickNewFile}
                  className="p-1.5 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-lift shrink-0"
                  title="Tạo nhanh tệp mới"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {showLiveServerBtn && (
                  <button
                    onClick={handleToggleLiveServer}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 btn-lift ${
                      livePreviewOpen
                        ? 'accent-pill-active'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title="Bật / Tắt Live Server xem trước web theo thời gian thực"
                  >
                    <Radio
                      size={13}
                      className={livePreviewOpen ? 'animate-pulse text-white' : 'text-emerald-500'}
                    />
                    <span>{livePreviewOpen ? 'Port :5500' : 'Go Live'}</span>
                  </button>
                )}

                <button
                  onClick={handleFormat}
                  className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] text-xs font-medium flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-lift"
                  title="Định dạng mã nguồn"
                >
                  <Wand2 size={13} style={{ color: 'var(--accent-primary)' }} />
                  <span className="hidden xl:inline">Format</span>
                </button>
              </div>
            </div>

            <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-2 min-w-0">
                {activeFile && <FileTypeIcon fileName={activeFile.name} size={14} />}
                <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {activeFile?.path || 'Chưa mở tệp'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span>{activeLineCount} lines</span>
                <span>
                  Ln {cursor.line}, Col {cursor.column}
                </span>
                {activeFile && (
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${getFileBadgeColor(
                      activeFile.language
                    )}`}
                  >
                    {activeFile.language}
                  </span>
                )}
              </div>
            </div>

            <div
              key={activeFile?.path || 'empty-editor'}
              className={`flex-1 min-h-0 min-w-0 flex tab-content-enter ${splitDirection}`}
            >
              <div
                onClick={() => setActivePane('primary')}
                className={`flex-1 min-w-0 min-h-0 flex flex-col relative ${
                  splitOpen && activePane === 'primary' ? 'ring-2 ring-inset ring-[var(--accent-primary)]/40 rounded-b-2xl' : ''
                }`}
              >
                {splitOpen && (
                  <div className="h-8 px-3 bg-[var(--bg-panel-alt)] flex items-center justify-between text-[11px]">
                    <select
                      value={primaryPath || ''}
                      onChange={(e) => {
                        flushLiveContent();
                        setPrimaryPath(e.target.value);
                      }}
                      className="bg-transparent text-[var(--text-primary)] outline-none cursor-pointer truncate max-w-[85%]"
                    >
                      {files.map((f) => (
                        <option key={f.path} value={f.path}>
                          {f.path}
                        </option>
                      ))}
                    </select>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--bg-active)] text-[10px] font-semibold">
                      PANE 1
                    </span>
                  </div>
                )}

                <CodeEditor
                  file={primaryFile}
                  settings={editorSettings}
                  breakpoint={breakpoint}
                  editorRef={primaryEditorRef}
                  typingSound={typingSound}
                  onChange={(val) => handleCodeChange(primaryFile, val)}
                  onSave={() => saveFile(primaryFile || undefined, undefined, true)}
                  onRun={handleRun}
                  onFocusEditor={() => setActivePane('primary')}
                  onCursorChange={(line, column) => {
                    if (activePane === 'primary') setCursor({ line, column });
                  }}
                  onQuickCreateTemplate={handleCreateTemplateFile}
                  onQuickCreateWebProject={handleCreateWebStarterProject}
                />
              </div>

              {livePreviewOpen && !splitOpen && (
                <div
                  style={{ borderColor: 'var(--bg-elevated)' }}
                  className="flex-1 min-w-0 min-h-0 flex flex-col border-t md:border-t-0 md:border-l"
                >
                  <WebPreviewPane
                    files={liveFiles}
                    activeFile={primaryFile}
                    selectedHtmlPath={previewHtmlPath}
                    revision={liveRevision}
                    onSelectHtmlPath={setPreviewHtmlPath}
                    onImportAssets={handleImportAssets}
                    onConsoleMessage={handlePreviewConsole}
                    onExportSuccess={(name) => showToast(`Đã xuất tệp ${name} độc lập`, 'success')}
                    onClose={() => setLivePreviewOpen(false)}
                  />
                </div>
              )}

              {splitOpen && (
                <div
                  onClick={() => setActivePane('secondary')}
                  className={`flex-1 min-w-0 min-h-0 flex flex-col relative ${
                    activePane === 'secondary' ? 'ring-2 ring-inset ring-[var(--accent-primary)]/40 rounded-b-2xl' : ''
                  }`}
                >
                  <div className="h-8 px-3 bg-[var(--bg-panel-alt)] flex items-center justify-between text-[11px]">
                    <select
                      value={secondaryPath || ''}
                      onChange={(e) => {
                        flushLiveContent();
                        setSecondaryPath(e.target.value);
                      }}
                      className="bg-transparent text-[var(--text-primary)] outline-none cursor-pointer truncate max-w-[80%]"
                    >
                      {files.map((f) => (
                        <option key={f.path} value={f.path}>
                          {f.path}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 text-[10px] font-semibold">
                        PANE 2
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          flushLiveContent();
                          setSplitOpen(false);
                          setActivePane('primary');
                        }}
                        className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
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
                    typingSound={typingSound}
                    onChange={(val) => handleCodeChange(secondaryFile, val)}
                    onSave={() => saveFile(secondaryFile || undefined, undefined, true)}
                    onRun={handleRun}
                    onFocusEditor={() => setActivePane('secondary')}
                    onCursorChange={(line, column) => {
                      if (activePane === 'secondary') setCursor({ line, column });
                    }}
                    onQuickCreateTemplate={handleCreateTemplateFile}
                    onQuickCreateWebProject={handleCreateWebStarterProject}
                  />
                </div>
              )}
            </div>

            {breakpoint === 'tablet' && isKeyboardOpen && (
              <div className="theme-scope">
                <MobileCodingToolbar language={mobileToolbarLang} onInsertToken={handleInsertToken} />
              </div>
            )}
          </main>

          {/* BOTTOM TERMINAL / CONSOLE CARD (DESKTOP) */}
          {bottomOpen && breakpoint === 'desktop' && (
            <section
              style={{ height: `${bottomHeight}px` }}
              className="w-full shrink-0 ide-card flex flex-col overflow-hidden tab-content-enter relative"
            >
              <div
                onMouseDown={startResizeBottom}
                title="Kéo lên / xuống để chỉnh chiều cao Terminal"
                className="h-2.5 w-full cursor-row-resize flex items-center justify-center group shrink-0"
              >
                <span className="w-10 h-1 rounded-full bg-[var(--bg-elevated)] group-hover:bg-[var(--accent-primary)] transition-colors" />
              </div>

              <div className="px-3.5 pb-1.5 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg accent-btn flex items-center justify-center shrink-0">
                    <Sparkles size={13} />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {isRunning
                        ? 'Đang thực thi mã nguồn...'
                        : lastElapsedMs !== null
                          ? `Hoàn thành trong ${lastElapsedMs}ms`
                          : livePreviewOpen
                            ? 'Live Server Console (127.0.0.1:5500)'
                            : 'Console & Test Input'}
                    </h3>
                    <span
                      className="hidden sm:inline text-[11px] truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      •{' '}
                      {isWebLanguage(activeFile?.language)
                        ? 'HTML5 / CSS3 / ES2024 CSS Hot-Reload Engine'
                        : activeFile?.language === 'python'
                          ? 'Pyodide WebAssembly Worker (Offline Ready)'
                          : 'GCC 14.2 Compiler Explorer Engine'}
                    </span>
                  </div>
                </div>

                <div className="w-32 sm:w-44 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden shrink-0">
                  <div
                    style={{
                      background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
                    }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      isRunning || livePreviewOpen
                        ? 'w-3/4 animate-pulse'
                        : lastElapsedMs !== null
                          ? 'w-full'
                          : 'w-1/4 opacity-50'
                    }`}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden theme-scope flex flex-col">
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
                  onKill={handleKill}
                  onClear={() => {
                    setLogs([]);
                    setLastElapsedMs(null);
                  }}
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
              </div>
            </section>
          )}
        </div>

        {/* TABLET CONSOLE SHEET */}
        {bottomOpen && breakpoint === 'tablet' && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex flex-col justify-end p-3"
            onClick={() => setBottomOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="ide-card overflow-hidden theme-scope tab-content-enter"
            >
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
                onKill={handleKill}
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
      </div>

      {/* FLOATING ROUNDED STATUS BAR */}
      <div className="ide-card overflow-hidden status-bar-wrap shrink-0">
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
      </div>

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
        uiTheme={uiTheme}
        onChangeUiTheme={setUiTheme}
        uiDensity={uiDensity}
        onChangeUiDensity={setUiDensity}
        typingSound={typingSound}
        onChangeTypingSound={setTypingSound}
      />

      <FloatingToast toast={toast} />
    </div>
  );
}