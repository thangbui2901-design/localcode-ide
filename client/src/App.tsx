import React, {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
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
  ImagePlus,
  Home,
  Command,
  ListTree,
  ChevronRight
} from 'lucide-react';
import {
  CompilerSettings,
  EditorSettings,
  ExecutionMode,
  FileNode,
  IdeDiagnostic,
  SupportedLanguage,
  TestCaseItem,
  TestCaseResult,
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
  renameIdbEntry,
  saveIdbFile
} from './services/indexedDbWorkspace';
import {
  executeWithPiston,
  isOfflineCppPreloaded,
  preloadOfflineCppCompiler,
  terminateCloudExecution
} from './services/pistonRunner';
import { ExplorerSidebar } from './components/ExplorerSidebar';
import { SearchSidebar } from './components/SearchSidebar';
import { CodeEditor, EditorCodeSelection } from './components/CodeEditor';
import { BottomPanel, TerminalChunk } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { CustomSelect } from './components/CustomSelect';
import { MobileCodingToolbar } from './components/MobileCodingToolbar';
import { MobileNav, MobileTab } from './components/MobileNav';
import { HeaderTimer } from './components/HeaderTimer';
import { FloatingToast, ToastItem, ToastTone } from './components/FloatingToast';
import { HomeScreen, NewProjectTemplate, QuickStartKind } from './components/HomeScreen';
import { CommandPalette, PaletteCommand, PaletteIcons } from './components/CommandPalette';
import { SplashScreen } from './components/SplashScreen';
import { OutlinePanel, extractOutlineSymbols } from './components/ipad/OutlinePanel';
import { DropZoneOverlay } from './components/ipad/DropZoneOverlay';
import { LeftActivityPill } from './components/ipad/LeftActivityPill';
import { IpadRightTool } from './components/ipad/IpadFloatingDock';

// Tải lười (Code-Splitting) các panel/modal phụ để khởi động nhẹ & tiết kiệm RAM trên iOS/iPadOS
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const WebPreviewPane = lazy(() =>
  import('./components/WebPreviewPane').then((m) => ({ default: m.WebPreviewPane }))
);
const PencilScratchpad = lazy(() =>
  import('./components/ipad/PencilScratchpad').then((m) => ({ default: m.PencilScratchpad }))
);
const ProblemNotesPane = lazy(() =>
  import('./components/ipad/ProblemNotesPane').then((m) => ({ default: m.ProblemNotesPane }))
);
const AiAssistantPane = lazy(() =>
  import('./components/ipad/AiAssistantPane').then((m) => ({ default: m.AiAssistantPane }))
);
import type { AiAutoPromptRequest } from './components/ipad/AiAssistantPane';
import { AiSettings, loadAiSettings, saveAiSettings } from './services/geminiAi';
const DiffViewerModal = lazy(() =>
  import('./components/ipad/DiffViewerModal').then((m) => ({ default: m.DiffViewerModal }))
);
const VirtualTrackpad = lazy(() =>
  import('./components/ipad/VirtualTrackpad').then((m) => ({ default: m.VirtualTrackpad }))
);
const KeyboardShortcutsHud = lazy(() =>
  import('./components/ipad/KeyboardShortcutsHud').then((m) => ({
    default: m.KeyboardShortcutsHud
  }))
);
import { downloadZipArchive } from './utils/zipExporter';
import {
  ACCENT_PRESETS,
  VisualPreferences,
  loadVisualPreferences,
  resolveWallpaperStyle,
  saveVisualPreferences
} from './utils/visualPrefs';
import {
  ensurePointerOriginTracker,
  runThemeRippleTransition
} from './utils/themeTransition';
import {
  isNativeMotionAvailable,
  runNativePageTransition,
  syncNativeBackdropColor
} from './utils/nativeMotion';
import {
  hapticError,
  hapticLight,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
  isHapticsEnabled,
  isNativeIosFilesSyncAvailable,
  setHapticsEnabled,
  syncWorkspaceWithDeviceFiles
} from './utils/iosNative';
import { UI_THEMES, UiThemeId, getThemeById } from './utils/themes';

export type { UiThemeId };
export type UiDensity = 'bento' | 'compact';

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

function applyMonacoThemeForUi(themeId: UiThemeId, accentOverride?: string) {
  const themeMeta = getThemeById(themeId);
  const accentHex = accentOverride || themeMeta.accentSwatch;
  const syn = themeMeta.syntax;
  getAllMonacoNamespaces().forEach((m) => {
    try {
      if (themeMeta.mode === 'dark') {
        m.editor.defineTheme('vs-dark-modern', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: syn.comment, fontStyle: 'italic' },
            { token: 'keyword', foreground: syn.keyword, fontStyle: 'bold' },
            { token: 'string', foreground: syn.string },
            { token: 'number', foreground: syn.number },
            { token: 'type', foreground: syn.type }
          ],
          colors: {
            'editor.background': themeMeta.bgSwatch,
            'editor.foreground': syn.foreground,
            'editor.lineHighlightBackground': '#FFFFFF08',
            'editor.selectionBackground': `${accentHex}38`,
            'editorCursor.foreground': accentHex,
            'editorLineNumber.foreground': syn.lineNumber,
            'editorLineNumber.activeForeground': accentHex,
            'editorIndentGuide.background1': '#FFFFFF10',
            'editorIndentGuide.activeBackground1': `${accentHex}55`,
            focusBorder: '#00000000'
          }
        });
        m.editor.setTheme('vs-dark-modern');
      } else {
        m.editor.defineTheme('code-ide-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: syn.comment, fontStyle: 'italic' },
            { token: 'keyword', foreground: syn.keyword, fontStyle: 'bold' },
            { token: 'string', foreground: syn.string },
            { token: 'number', foreground: syn.number },
            { token: 'type', foreground: syn.type }
          ],
          colors: {
            'editor.background': themeMeta.bgSwatch,
            'editor.foreground': syn.foreground,
            'editor.lineHighlightBackground': '#00000006',
            'editor.selectionBackground': `${accentHex}24`,
            'editorCursor.foreground': accentHex,
            'editorLineNumber.foreground': syn.lineNumber,
            'editorLineNumber.activeForeground': accentHex,
            'editorIndentGuide.background1': '#00000010',
            'editorIndentGuide.activeBackground1': `${accentHex}55`,
            focusBorder: '#00000000'
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
  if (/\.(txt|in|inp|out|csv|dat|log)$/i.test(lower)) return 'plaintext';
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

function useMountOnce(active: boolean): boolean {
  const [mounted, setMounted] = useState(active);
  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);
  return mounted;
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

  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => isHapticsEnabled());
  const [isSyncingFiles, setIsSyncingFiles] = useState<boolean>(false);
  const [offlineCppState, setOfflineCppState] = useState<'idle' | 'loading' | 'ready'>(() =>
    isOfflineCppPreloaded() ? 'ready' : 'idle'
  );
  const [offlineCppPercent, setOfflineCppPercent] = useState<number>(() =>
    isOfflineCppPreloaded() ? 100 : 0
  );

  const handleChangeHapticsEnabled = useCallback((enabled: boolean) => {
    setHapticsEnabled(enabled);
    setHapticsEnabledState(enabled);
  }, []);

  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [splashPhase, setSplashPhase] = useState<'active' | 'exiting' | 'done'>('active');
  const [showHomeScreen, setShowHomeScreenRaw] = useState<boolean>(true);
  const showHomeScreenRef = useRef<boolean>(true);
  showHomeScreenRef.current = showHomeScreen;

  // Khi cài trên iPad/iPhone (.ipa), mọi thao tác chuyển Home <-> Editor tự động chạy
  // bằng Swift Native UINavigationController Parallax Spring (120Hz Metal CoreAnimation)!
  const setShowHomeScreen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(showHomeScreenRef.current) : next;
    if (resolved === showHomeScreenRef.current) return;
    showHomeScreenRef.current = resolved;
    const direction: 'push' | 'pop' = resolved ? 'pop' : 'push';
    if (isNativeMotionAvailable()) {
      void runNativePageTransition(direction, () => {
        setShowHomeScreenRaw(resolved);
      });
    } else {
      setShowHomeScreenRaw(resolved);
    }
  }, []);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [visualPrefs, setVisualPrefs] = useState<VisualPreferences>(() => loadVisualPreferences());

  useEffect(() => {
    ensurePointerOriginTracker();
  }, []);

  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStartRef = useRef<number | null>(null);
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleUpdateVisualPrefs = useCallback((patch: Partial<VisualPreferences>) => {
    setVisualPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveVisualPreferences(next);
      return next;
    });
  }, []);

  const activeAccentOverride = useMemo(() => {
    if (visualPrefs.accentColor === 'auto') return undefined;
    return ACCENT_PRESETS.find((a) => a.id === visualPrefs.accentColor);
  }, [visualPrefs.accentColor]);

  const wallpaperStyle = useMemo(() => resolveWallpaperStyle(visualPrefs), [visualPrefs]);

  const lastAppliedMonacoKeyRef = useRef<string>('');
  const isThemeRipplingRef = useRef<boolean>(false);
  const activeThemeRef = useRef<UiThemeId>(uiTheme);
  activeThemeRef.current = isThemeRipplingRef.current ? activeThemeRef.current : uiTheme;

  const syncThemeMetadataAndEditor = useCallback(
    (themeId: UiThemeId, accentPrimary?: string) => {
      const meta = getThemeById(themeId);
      localStorage.setItem('codeide_ui_theme', themeId);
      document.documentElement.setAttribute('data-ui-theme', themeId);
      document.documentElement.classList.toggle('dark', meta.mode === 'dark');
      document.documentElement.style.colorScheme = meta.mode;

      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', meta.bgSwatch);
      syncNativeBackdropColor(meta.canvasBg);

      const iosStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (iosStatusMeta) {
        iosStatusMeta.setAttribute('content', meta.mode === 'light' ? 'default' : 'black-translucent');
      }
      try {
        const capStatusBar = (window as any).Capacitor?.Plugins?.StatusBar;
        if (capStatusBar?.setStyle) {
          void capStatusBar.setStyle({
            style: meta.mode === 'light' ? 'LIGHT' : 'DARK'
          });
        }
      } catch {
        // Bỏ qua nếu chạy trên trình duyệt web thông thường
      }

      setEditorSettings((prev) =>
        prev.theme === meta.monacoTheme ? prev : { ...prev, theme: meta.monacoTheme }
      );

      const monacoKey = `${themeId}::${accentPrimary ?? ''}`;
      if (lastAppliedMonacoKeyRef.current !== monacoKey) {
        applyMonacoThemeForUi(themeId, accentPrimary);
        lastAppliedMonacoKeyRef.current = monacoKey;
      }
    },
    []
  );

  const handleChangeUiTheme = useCallback(
    (nextTheme: UiThemeId, toastLabel?: string) => {
      if (nextTheme === activeThemeRef.current) return;
      activeThemeRef.current = nextTheme;
      hapticSelection();
      const nextMeta = getThemeById(nextTheme);
      const accentPrimary = activeAccentOverride?.primary;
      const ringAccent = accentPrimary || nextMeta.accentSwatch;
      const monacoKey = `${nextTheme}::${accentPrimary ?? ''}`;

      isThemeRipplingRef.current = true;

      runThemeRippleTransition(
        () => {
          // Siêu nhẹ (< 0.5ms): chỉ đổi attribute CSS biến màu (KHÔNG chạy flushSync re-render 4.500 dòng App.tsx!)
          document.documentElement.setAttribute('data-ui-theme', nextTheme);

          if (!showHomeScreen) {
            applyMonacoThemeForUi(nextTheme, accentPrimary);
            lastAppliedMonacoKeyRef.current = monacoKey;
          }
        },
        {
          targetBg: nextMeta.canvasBg,
          accentColor: ringAccent,
          onFinished: () => {
            // Đồng bộ React state sau khi sóng tròn đã chạy xong 100% -> 0 khựng ở cả đầu lẫn cuối!
            startTransition(() => {
              setUiTheme(nextTheme);
              if (toastLabel) {
                showToast(toastLabel, 'info');
              }
            });

            const runDeferredMeta = () => {
              isThemeRipplingRef.current = false;
              syncThemeMetadataAndEditor(nextTheme, accentPrimary);
            };

            const ric = (window as unknown as {
              requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            }).requestIdleCallback;
            if (ric) {
              ric(runDeferredMeta, { timeout: 140 });
            } else {
              window.setTimeout(runDeferredMeta, 32);
            }
          }
        }
      );
    },
    [uiTheme, activeAccentOverride, showHomeScreen, showToast, syncThemeMetadataAndEditor]
  );
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('codeide_pinned_paths');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [testCasesByFile, setTestCasesByFile] = useState<Record<string, TestCaseItem[]>>(() => {
    try {
      const raw = localStorage.getItem('codeide_test_cases_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [testResultsByFile, setTestResultsByFile] = useState<
    Record<string, Record<string, TestCaseResult>>
  >({});
  const [isRunningTests, setIsRunningTests] = useState(false);

  const currentThemeObj = UI_THEMES.find((t) => t.id === uiTheme) || UI_THEMES[0];

  useEffect(() => {
    try {
      localStorage.setItem('codeide_pinned_paths', JSON.stringify(pinnedPaths));
    } catch {
      // Bỏ qua
    }
  }, [pinnedPaths]);

  useEffect(() => {
    try {
      localStorage.setItem('codeide_test_cases_v1', JSON.stringify(testCasesByFile));
    } catch {
      // Bỏ qua
    }
  }, [testCasesByFile]);

  useEffect(() => {
    localStorage.setItem('codeide_typing_sound', String(typingSound));
  }, [typingSound]);

  useEffect(() => {
    const monacoKey = `${uiTheme}::${activeAccentOverride?.primary ?? ''}`;
    const syncAllMonaco = (force = false) => {
      if (!force && (isThemeRipplingRef.current || lastAppliedMonacoKeyRef.current === monacoKey)) return;
      ensureBuiltInIntelliSense();
      applyMonacoThemeForUi(uiTheme, activeAccentOverride?.primary);
      lastAppliedMonacoKeyRef.current = monacoKey;
      getAllMonacoNamespaces().forEach((m) => {
        m.editor.getEditors().forEach((ed) => applyEnhancedEditorBehavior(ed));
      });
      if (primaryEditorRef.current) applyEnhancedEditorBehavior(primaryEditorRef.current);
      if (secondaryEditorRef.current) applyEnhancedEditorBehavior(secondaryEditorRef.current);
    };

    syncAllMonaco(false);

    const disposables: monaco.IDisposable[] = [];
    getAllMonacoNamespaces().forEach((m) => {
      disposables.push(
        m.editor.onDidCreateEditor((ed) => {
          syncAllMonaco(true);
          applyEnhancedEditorBehavior(ed);
        })
      );
    });

    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [uiTheme, activeAccentOverride]);

  // Đồng bộ Màu nhấn tự do, Con trỏ phát sáng & Chế độ Kính mờ lên <html>
  useEffect(() => {
    const root = document.documentElement;
    if (activeAccentOverride) {
      root.style.setProperty('--accent-primary', activeAccentOverride.primary);
      root.style.setProperty('--accent-secondary', activeAccentOverride.secondary);
      root.style.setProperty('--accent-glow', activeAccentOverride.glow);
      root.style.setProperty('--bg-active', activeAccentOverride.activeBg);
    } else {
      root.style.removeProperty('--accent-primary');
      root.style.removeProperty('--accent-secondary');
      root.style.removeProperty('--accent-glow');
      root.style.removeProperty('--bg-active');
    }

    root.setAttribute('data-glow-caret', visualPrefs.glowCaret ? 'on' : 'off');
    root.setAttribute('data-wallpaper-active', wallpaperStyle ? 'true' : 'false');
    root.style.setProperty('--glass-blur', `${visualPrefs.glassBlur}px`);
    root.style.setProperty('--glass-opacity', `${visualPrefs.glassOpacity}%`);
  }, [activeAccentOverride, visualPrefs, wallpaperStyle]);

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
  const [sidebarView, setSidebarView] = useState<'explorer' | 'search' | 'outline' | null>('explorer');
  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('codeide_bottom_height'));
    return saved >= 150 && saved <= 560 ? saved : 240;
  });

  // ===== iPad Pro Exclusive Layout & Tool States =====
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('codeide_sidebar_width'));
    return saved >= 195 && saved <= 420 ? saved : 256;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  const [renderedSidebarView, setRenderedSidebarView] = useState<'explorer' | 'search' | 'outline'>(
    'explorer'
  );
  const [renderedRightKind, setRenderedRightKind] = useState<'scratchpad' | 'notes' | 'ai' | 'console'>(
    'scratchpad'
  );
  const [tabletDrawerMounted, setTabletDrawerMounted] = useState(false);
  const [tabletDrawerVisible, setTabletDrawerVisible] = useState(false);

  useEffect(() => {
    if (sidebarView) {
      setRenderedSidebarView(sidebarView);
    }
  }, [sidebarView]);

  useEffect(() => {
    if (breakpoint !== 'tablet') {
      setTabletDrawerMounted(false);
      setTabletDrawerVisible(false);
      return;
    }
    if (sidebarView) {
      setTabletDrawerMounted(true);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTabletDrawerVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }
    setTabletDrawerVisible(false);
    const t = window.setTimeout(() => setTabletDrawerMounted(false), 300);
    return () => window.clearTimeout(t);
  }, [sidebarView, breakpoint]);
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = Number(localStorage.getItem('codeide_split_ratio'));
    return saved >= 25 && saved <= 75 ? saved : 50;
  });
  const [consoleDock, setConsoleDock] = useState<'bottom' | 'right'>(() =>
    localStorage.getItem('codeide_console_dock') === 'right' ? 'right' : 'bottom'
  );
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('codeide_right_panel_width'));
    return saved >= 280 && saved <= 680 ? saved : 390;
  });
  const [ipadRightTool, setIpadRightTool] = useState<IpadRightTool>(null);

  useEffect(() => {
    if (ipadRightTool) {
      setRenderedRightKind(ipadRightTool);
    } else if (bottomOpen && consoleDock === 'right') {
      setRenderedRightKind('console');
    }
  }, [ipadRightTool, bottomOpen, consoleDock]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [fileSnapshots, setFileSnapshots] = useState<Record<string, string>>({});
  const [trackpadOpen, setTrackpadOpen] = useState(false);
  const [shortcutsHudOpen, setShortcutsHudOpen] = useState(false);
  const [shortcutsHudHoldMode, setShortcutsHudHoldMode] = useState(false);
  const diffMounted = useMountOnce(diffOpen);
  const trackpadMounted = useMountOnce(trackpadOpen);
  const shortcutsHudMounted = useMountOnce(shortcutsHudOpen);
  const scratchpadMounted = useMountOnce(ipadRightTool === 'scratchpad');
  const notesMounted = useMountOnce(ipadRightTool === 'notes');
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [aiAutoPrompt, setAiAutoPrompt] = useState<AiAutoPromptRequest | null>(null);
  const [editorSelection, setEditorSelection] = useState<EditorCodeSelection | null>(null);
  const aiMounted = useMountOnce(ipadRightTool === 'ai' || mobileAiOpen);

  const handleUpdateAiSettings = useCallback((patch: Partial<AiSettings>) => {
    setAiSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAiSettings(next);
      if (patch.showDockButton === false) {
        setIpadRightTool((cur) => (cur === 'ai' ? null : cur));
        setMobileAiOpen(false);
      }
      return next;
    });
  }, []);
  const [isDragOverWorkspace, setIsDragOverWorkspace] = useState(false);
  const [requestedConsoleTab, setRequestedConsoleTab] = useState<{
    tab: 'terminal' | 'input' | 'tests' | 'problems';
    seq: number;
  } | null>(null);

  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const dragDepthRef = useRef(0);
  const cmdHoldTimerRef = useRef<number | null>(null);
  const cmdComboUsedRef = useRef(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const [logs, setLogs] = useState<TerminalChunk[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  const interactiveSessionRef = useRef<{
    id: number;
    activeFile: WorkspaceFile;
    latestFiles: WorkspaceFile[];
    accumulatedStdin: string;
    printedStdout: string;
  } | null>(null);
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
    localStorage.setItem('codeide_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('codeide_split_ratio', String(splitRatio));
  }, [splitRatio]);

  useEffect(() => {
    localStorage.setItem('codeide_console_dock', consoleDock);
  }, [consoleDock]);

  useEffect(() => {
    localStorage.setItem('codeide_right_panel_width', String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    ensureBuiltInIntelliSense();
    if (primaryEditorRef.current) applyEnhancedEditorBehavior(primaryEditorRef.current);
    if (secondaryEditorRef.current) applyEnhancedEditorBehavior(secondaryEditorRef.current);
  }, [breakpoint, splitOpen, livePreviewOpen, primaryPath, secondaryPath]);

  const startResizeBottom = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomHeight;
    setIsResizingBottom(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = startY - moveEvent.clientY;
      const nextH = Math.min(560, Math.max(150, startH + delta));
      setBottomHeight(nextH);
    };

    const onPointerUp = () => {
      setIsResizingBottom(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const startResizeSidebar = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    setIsResizingSidebar(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextW = Math.min(420, Math.max(195, startW + (moveEvent.clientX - startX)));
      setSidebarWidth(nextW);
    };

    const onPointerUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const startResizeRightPanel = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightPanelWidth;
    setIsResizingRightPanel(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextW = Math.min(680, Math.max(280, startW + (startX - moveEvent.clientX)));
      setRightPanelWidth(nextW);
    };

    const onPointerUp = () => {
      setIsResizingRightPanel(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const startResizeSplit = (e: React.PointerEvent, vertical: boolean) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onPointerMove = (moveEvent: PointerEvent) => {
      const pct = vertical
        ? ((moveEvent.clientY - rect.top) / Math.max(1, rect.height)) * 100
        : ((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      setSplitRatio(Math.min(75, Math.max(25, Math.round(pct * 10) / 10)));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => ({
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
    hardwareKeyboardMode: localStorage.getItem('codeide_hw_keyboard_mode') === 'true',
    theme: currentThemeObj.monacoTheme
  }));

  useEffect(() => {
    localStorage.setItem('codeide_hw_keyboard_mode', String(Boolean(editorSettings.hardwareKeyboardMode)));
  }, [editorSettings.hardwareKeyboardMode]);

  const handleToggleHardwareKeyboardMode = useCallback(() => {
    hapticSelection();
    setEditorSettings((prev) => {
      const next = !prev.hardwareKeyboardMode;
      showToast(
        next
          ? 'Đã bật chế độ Bàn phím rời (Ẩn bàn phím ảo iPad)'
          : 'Đã tắt chế độ Bàn phím rời (Hiện lại phím ảo khi chạm)',
        'info'
      );
      return { ...prev, hardwareKeyboardMode: next };
    });
  }, [showToast]);

  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>(() => {
    const savedEngine = localStorage.getItem('codeide_cpp_engine');
    const cppEngine =
      savedEngine === 'offline-wasm' || savedEngine === 'cloud' || savedEngine === 'auto'
        ? savedEngine
        : 'auto';
    return {
      cStandard: localStorage.getItem('codeide_c_standard') || 'c11',
      cppStandard: localStorage.getItem('codeide_cpp_standard') || 'gnu++17',
      pistonUrl: 'https://emkc.org/api/v2/piston/execute',
      cppEngine
    };
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
    localStorage.setItem('codeide_ui_density', uiDensity);
    document.documentElement.setAttribute('data-ui-density', uiDensity);
    if (isThemeRipplingRef.current) return;
    syncThemeMetadataAndEditor(uiTheme, activeAccentOverride?.primary);
  }, [uiTheme, uiDensity, activeAccentOverride, syncThemeMetadataAndEditor]);

  const cycleNextTheme = () => {
    const idx = UI_THEMES.findIndex((t) => t.id === activeThemeRef.current);
    const next = UI_THEMES[(idx + 1) % UI_THEMES.length];
    handleChangeUiTheme(next.id, `Theme: ${next.name}`);
  };

  const isFocusMode = zenMode;
  const toggleFocusMode = useCallback(() => {
    setZenMode((prev) => {
      const next = !prev;
      if (next) {
        setSidebarView(null);
        setBottomOpen(false);
        showToast('Chế độ Tập trung (Zen Mode)', 'info');
      } else {
        if (breakpoint === 'desktop') {
          setSidebarView('explorer');
          setBottomOpen(true);
        }
        showToast('Đã thoát chế độ Tập trung', 'info');
      }
      return next;
    });
  }, [breakpoint, showToast]);

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
      let loaded = await loadWorkspaceForMode(detectedMode);

      // Trên ứng dụng iOS/iPadOS (Capacitor), đồng bộ thầm lặng 2 chiều với app Tệp (Files) ngay khi mở app
      if (detectedMode === 'standalone' && isNativeIosFilesSyncAvailable()) {
        try {
          const syncRes = await syncWorkspaceWithDeviceFiles(loaded, saveIdbFile, createIdbFolder, {
            allowWebPicker: false
          });
          if (!cancelled && syncRes.pulled > 0) {
            loaded = await loadWorkspaceForMode('standalone');
          }
        } catch {
          // Bỏ qua nếu iOS chưa cấp quyền sẵn
        }
      }

      if (cancelled) return;
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
      hapticSelection();
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
        hapticLight();
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
    hapticMedium();

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
      const initialStdin = stdinPreset
        ? stdinPreset.endsWith('\n')
          ? stdinPreset
          : `${stdinPreset}\n`
        : '';
      const session = {
        id: Date.now(),
        activeFile: { ...currentFile, content: liveContent },
        latestFiles,
        accumulatedStdin: initialStdin,
        printedStdout: ''
      };
      interactiveSessionRef.current = session;
      setIsWaitingForInput(false);
      await runStandaloneInteractiveStep(session, false, false);
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
        void loadWorkspaceForMode('local');
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

  const runStandaloneInteractiveStep = async (
    session: {
      id: number;
      activeFile: WorkspaceFile;
      latestFiles: WorkspaceFile[];
      accumulatedStdin: string;
      printedStdout: string;
    },
    forceEof: boolean,
    suppressHeader: boolean
  ) => {
    setIsRunning(true);
    setIsWaitingForInput(false);
    let stepStdout = '';
    const stepStderr: string[] = [];

    try {
      await executeWithPiston(
        session.activeFile,
        session.latestFiles,
        compilerSettings,
        session.accumulatedStdin,
        {
          onChunk: (type, text) => {
            if (interactiveSessionRef.current?.id !== session.id) return;
            if (type === 'stdout') {
              stepStdout += text;
            } else if (type === 'stderr') {
              stepStderr.push(text);
            } else {
              setLogs((prev) => [...prev, { type, text }]);
            }
          },
          onSyncedFiles: async (syncedFiles) => {
            if (!syncedFiles || syncedFiles.length === 0) return;
            const activeDir = session.activeFile.path.includes('/')
              ? session.activeFile.path.slice(0, session.activeFile.path.lastIndexOf('/'))
              : '';
            const savedNames: string[] = [];
            for (const sf of syncedFiles) {
              const targetPath = activeDir ? `${activeDir}/${sf.name}` : sf.name;
              await saveIdbFile(targetPath, sf.content);
              liveContentMapRef.current[targetPath] = sf.content;
              savedNames.push(sf.name);
            }
            await loadWorkspaceForMode('standalone');
            const summary =
              savedNames.length === 1
                ? `Đã đồng bộ tệp ${savedNames[0]} vào Workspace`
                : `Đã đồng bộ ${savedNames.length} tệp (${savedNames.join(', ')}) vào Workspace`;
            setLogs((prev) => [...prev, { type: 'status', text: `\n[Workspace] ${summary}\n` }]);
            showToast(summary, 'success');
          },
          onFinish: (code, elapsedMs, waitingForInput) => {
            if (interactiveSessionRef.current?.id !== session.id) return;
            setIsRunning(false);
            setLastElapsedMs(elapsedMs);

            const prevOut = session.printedStdout;
            const deltaStdout = stepStdout.startsWith(prevOut)
              ? stepStdout.slice(prevOut.length)
              : stepStdout.slice(Math.min(stepStdout.length, prevOut.length));
            session.printedStdout = stepStdout;

            const chunksToAdd: TerminalChunk[] = [];
            if (deltaStdout) {
              chunksToAdd.push({ type: 'stdout', text: deltaStdout });
            }
            if (stepStderr.length > 0) {
              chunksToAdd.push({ type: 'stderr', text: stepStderr.join('') });
            }

            if (waitingForInput && !forceEof) {
              hapticLight();
              setIsWaitingForInput(true);
              if (chunksToAdd.length > 0) {
                setLogs((prev) => [...prev, ...chunksToAdd]);
              }
            } else {
              interactiveSessionRef.current = null;
              setIsWaitingForInput(false);
              if (code === 0) {
                hapticSuccess();
              } else {
                hapticError();
              }
              if (isOfflineCppPreloaded()) {
                setOfflineCppState('ready');
                setOfflineCppPercent(100);
              }
              chunksToAdd.push({
                type: 'status',
                text: `\n[Hoàn thành với mã ${code} trong ${elapsedMs}ms]\n`
              });
              setLogs((prev) => [...prev, ...chunksToAdd]);
            }
          }
        },
        {
          interactive: !forceEof,
          suppressHeader,
          syncFiles: true
        }
      );
    } catch (err: any) {
      if (interactiveSessionRef.current?.id !== session.id) return;
      interactiveSessionRef.current = null;
      setIsRunning(false);
      setIsWaitingForInput(false);
      setLogs((prev) => [
        ...prev,
        { type: 'stderr', text: `Lỗi thực thi Cloud: ${err?.message || 'Không xác định'}\n` }
      ]);
    }
  };

  const handleSendStdin = (line: string) => {
    setLogs((prev) => [...prev, { type: 'stdin', text: line }]);
    if (mode === 'standalone') {
      const session = interactiveSessionRef.current;
      if (session) {
        const normalized = line.endsWith('\n') ? line : `${line}\n`;
        session.accumulatedStdin += normalized;
        void runStandaloneInteractiveStep(session, false, true);
      }
      return;
    }
    if (runWsRef.current?.readyState === WebSocket.OPEN) {
      runWsRef.current.send(JSON.stringify({ type: 'stdin', data: line }));
    }
  };

  const handleSendEof = () => {
    if (mode === 'standalone') {
      const session = interactiveSessionRef.current;
      if (session) {
        setLogs((prev) => [...prev, { type: 'status', text: ' [EOF]\n' }]);
        void runStandaloneInteractiveStep(session, true, true);
      }
      return;
    }
    runWsRef.current?.send(JSON.stringify({ type: 'eof' }));
  };

  const handleKill = () => {
    if (mode === 'standalone') {
      interactiveSessionRef.current = null;
      setIsWaitingForInput(false);
      setIsRunning(false);
      terminateCloudExecution();
      setLogs((prev) => [...prev, { type: 'status', text: '\n[Đã dừng tiến trình]\n' }]);
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

  const handleEditorUndo = () => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.trigger('mobile-toolbar', 'undo', null);
    editor.focus();
  };

  const handleEditorRedo = () => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.trigger('mobile-toolbar', 'redo', null);
    editor.focus();
  };

  const handleMoveCursor = (delta: -1 | 1) => {
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.trigger('mobile-toolbar', delta < 0 ? 'cursorLeft' : 'cursorRight', null);
    editor.focus();
  };

  const isTouchDevice =
    typeof window !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

  const isNativeCapacitor =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
      Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
          ?.isNativePlatform?.()
      ));

  const handleUpdateCompiler = async (next: CompilerSettings) => {
    hapticSelection();
    setCompilerSettings(next);
    try {
      localStorage.setItem('codeide_cpp_standard', next.cppStandard);
      localStorage.setItem('codeide_c_standard', next.cStandard);
      if (next.cppEngine) localStorage.setItem('codeide_cpp_engine', next.cppEngine);
    } catch {
      // ignore
    }
    if (mode === 'local') {
      await fetch('/api/compiler-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cppStandard: next.cppStandard, cStandard: next.cStandard })
      });
    }
  };

  const handleSyncDeviceFiles = useCallback(async () => {
    if (isSyncingFiles) return;
    flushLiveContent();
    hapticLight();
    setIsSyncingFiles(true);
    try {
      const latestSnap = files.map((f) => ({
        ...f,
        content: liveContentMapRef.current[f.path] ?? f.content
      }));
      const res = await syncWorkspaceWithDeviceFiles(latestSnap, saveIdbFile, createIdbFolder, {
        allowWebPicker: true
      });
      if (res.mode === 'unsupported') {
        hapticWarning();
        showToast('Trình duyệt hiện tại chưa hỗ trợ chọn thư mục — hãy dùng app iOS/iPadOS (.ipa) hoặc Chrome/Edge', 'info');
        return;
      }
      if (res.pulled > 0) {
        await loadWorkspaceForMode('standalone');
      }
      hapticSuccess();
      if (res.pushed === 0 && res.pulled === 0) {
        showToast(`Mọi tệp đã đồng bộ khớp với ${res.folderName || 'app Tệp'}`, 'success');
      } else {
        showToast(
          `Đồng bộ ${res.folderName || 'app Tệp'}: ↑${res.pushed} đẩy ra, ↓${res.pulled} kéo vào`,
          'success'
        );
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        hapticError();
        showToast(`Lỗi đồng bộ tệp: ${err?.message || 'Không xác định'}`, 'error');
      }
    } finally {
      setIsSyncingFiles(false);
    }
  }, [files, flushLiveContent, isSyncingFiles, loadWorkspaceForMode, showToast]);

  const handlePreloadOfflineCpp = useCallback(async () => {
    if (offlineCppState === 'loading') return;
    hapticLight();
    setOfflineCppState('loading');
    setOfflineCppPercent(5);
    try {
      await preloadOfflineCppCompiler((pct) => setOfflineCppPercent(pct));
      setOfflineCppState('ready');
      setOfflineCppPercent(100);
      hapticSuccess();
      showToast('Trình biên dịch C/C++ Offline Clang WASM đã sẵn sàng!', 'success');
    } catch (err: any) {
      setOfflineCppState(isOfflineCppPreloaded() ? 'ready' : 'idle');
      hapticError();
      showToast(err?.message || 'Không thể tải trình biên dịch Clang WASM', 'error');
    }
  }, [offlineCppState, showToast]);

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
    hapticWarning();
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
    hapticSelection();
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
    hapticLight();
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

  const mobileToolbarLang: SupportedLanguage = activeFile?.language || primaryFile?.language || 'cpp';

  const handleQuickStartFromHome = async (kind: QuickStartKind) => {
    const suffix = Date.now().toString().slice(-3);

    if (kind === 'web-starter') {
      await handleCreateWebStarterProject();
      setShowHomeScreen(false);
      setMobileTab('editor');
      return;
    }

    const starterMap: Record<Exclude<QuickStartKind, 'web-starter'>, { name: string; content: string }> = {
      python: {
        name: `main_${suffix}.py`,
        content: `# Python 3 – Code With You\ndef greet(name: str) -> str:\n    return f"Xin chào {name}! Chúc bạn code vui vẻ 🚀"\n\nif __name__ == "__main__":\n    print(greet("Coder"))\n`
      },
      javascript: {
        name: `app_${suffix}.js`,
        content: `// JavaScript ES2024 – Code With You\nconst skills = ["Python", "JavaScript", "C++", "HTML/CSS"];\nconsole.log("Bắt đầu hành trình lập trình:", skills.join(" • "));\n`
      },
      cpp: {
        name: `main_${suffix}.cpp`,
        content: `#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    cout << "Xin chao tu C++!\\n";\n    return 0;\n}\n`
      },
      'cpp-oop': {
        name: `oop_${suffix}.cpp`,
        content: `#include <iostream>\n#include <string>\nusing namespace std;\n\nclass SinhVien {\nprivate:\n    string maSV;\n    string hoTen;\npublic:\n    SinhVien(string ma, string ten) : maSV(ma), hoTen(ten) {}\n    void xuat() const {\n        cout << maSV << " - " << hoTen << "\\n";\n    }\n};\n\nint main() {\n    SinhVien sv("SV01", "Nguyen Van A");\n    sv.xuat();\n    return 0;\n}\n`
      },
      c: {
        name: `main_${suffix}.c`,
        content: `#include <stdio.h>\n\nint main(void) {\n    printf("Xin chao tu C17!\\n");\n    return 0;\n}\n`
      },
      html: {
        name: `index_${suffix}.html`,
        content: `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Code With You</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }\n    .card { padding: 28px 36px; border-radius: 20px; background: rgba(255,255,255,0.06); text-align: center; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>Xin chào từ HTML5 🚀</h1>\n    <p>Bấm nút Live / Run để xem trước trực tiếp.</p>\n  </div>\n</body>\n</html>\n`
      },
      css: {
        name: `style_${suffix}.css`,
        content: `/* CSS3 – Code With You */\n:root {\n  --primary: #3b82f6;\n  --surface: #111827;\n}\n\nbody {\n  margin: 0;\n  font-family: -apple-system, BlinkMacSystemFont, sans-serif;\n  background: var(--surface);\n  color: #f9fafb;\n}\n`
      }
    };

    const chosen = starterMap[kind];
    await handleCreateTemplateFile(chosen.name, chosen.content);
    setShowHomeScreen(false);
    setMobileTab('editor');
  };

  const handleCreateProjectFromHome = async (projectName: string, template: NewProjectTemplate) => {
    await handleCreateFolder(projectName);

    const projectFiles: Array<{ rel: string; content: string }> =
      template === 'web'
        ? [
            {
              rel: `${projectName}/index.html`,
              content: `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${projectName}</title>\n  <link rel="stylesheet" href="./style.css" />\n</head>\n<body>\n  <main class="hero">\n    <h1>${projectName}</h1>\n    <p>Dự án Web tạo từ Code With You 🚀</p>\n    <button id="btn">Bấm thử</button>\n  </main>\n  <script src="./script.js"></script>\n</body>\n</html>\n`
            },
            {
              rel: `${projectName}/style.css`,
              content: `body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #0b1120;\n  color: #f8fafc;\n  font-family: -apple-system, BlinkMacSystemFont, sans-serif;\n}\n.hero {\n  text-align: center;\n  padding: 32px;\n  border-radius: 24px;\n  background: rgba(59, 130, 246, 0.12);\n}\nbutton {\n  margin-top: 12px;\n  padding: 10px 20px;\n  border: none;\n  border-radius: 12px;\n  background: #3b82f6;\n  color: white;\n  font-weight: 600;\n}\n`
            },
            {
              rel: `${projectName}/script.js`,
              content: `document.getElementById('btn')?.addEventListener('click', () => {\n  console.log('${projectName} hoạt động tốt!');\n  alert('Xin chào từ ${projectName}!');\n});\n`
            }
          ]
        : template === 'cpp-oop'
          ? [
              {
                rel: `${projectName}/Model.h`,
                content: `#pragma once\n#include <iostream>\n#include <string>\n\nclass AppItem {\npublic:\n    std::string title;\n    explicit AppItem(std::string t) : title(std::move(t)) {}\n    void print() const { std::cout << "[Item] " << title << "\\n"; }\n};\n`
              },
              {
                rel: `${projectName}/main.cpp`,
                content: `#include <iostream>\n#include "Model.h"\nusing namespace std;\n\nint main() {\n    AppItem item("${projectName}");\n    item.print();\n    return 0;\n}\n`
              }
            ]
          : template === 'python'
            ? [
                {
                  rel: `${projectName}/main.py`,
                  content: `# Dự án ${projectName}\nprint("Khởi chạy ${projectName} thành công! 🚀")\n`
                }
              ]
            : template === 'javascript'
              ? [
                  {
                    rel: `${projectName}/index.js`,
                    content: `// Dự án ${projectName}\nconsole.log("Khởi chạy ${projectName} thành công!");\n`
                  }
                ]
              : [
                  {
                    rel: `${projectName}/main.cpp`,
                    content: `#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    cout << "Hello ${projectName}!\\n";\n    return 0;\n}\n`
                  }
                ];

    for (const pf of projectFiles) {
      if (mode === 'local') {
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pf.rel, content: pf.content })
        });
      } else {
        await saveIdbFile(pf.rel, pf.content);
      }
    }

    const updated = await loadWorkspaceForMode(mode);
    const entry =
      updated.find((f) => f.path === projectFiles[0].rel) ||
      updated.find((f) => f.path.startsWith(`${projectName}/`));

    if (entry) {
      openFileInActivePane(entry);
    }
    setShowHomeScreen(false);
    setMobileTab('editor');
    showToast(`Đã tạo dự án "${projectName}"`, 'success');
  };

  const handleTogglePin = (targetPath: string) => {
    setPinnedPaths((prev) => {
      const exists = prev.includes(targetPath);
      const next = exists ? prev.filter((p) => p !== targetPath) : [targetPath, ...prev];
      showToast(exists ? `Đã bỏ ghim "${targetPath}"` : `Đã ghim "${targetPath}" lên đầu`, 'info');
      return next;
    });
  };

  const handleRenameEntry = async (oldPath: string, newPath: string) => {
    const cleanOld = oldPath.replace(/^\/+|\/+$/g, '');
    const cleanNew = newPath.replace(/^\/+|\/+$/g, '');
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    flushLiveContent();

    if (mode === 'local') {
      const affected = files.filter(
        (f) => f.path === cleanOld || f.path.startsWith(`${cleanOld}/`)
      );
      for (const f of affected) {
        const nextPath = f.path === cleanOld ? cleanNew : `${cleanNew}${f.path.slice(cleanOld.length)}`;
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: nextPath, content: f.content })
        });
      }
      await fetch('/api/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: cleanOld })
      });
    } else {
      await renameIdbEntry(cleanOld, cleanNew);
    }

    const remapPath = (p: string) =>
      p === cleanOld ? cleanNew : p.startsWith(`${cleanOld}/`) ? `${cleanNew}${p.slice(cleanOld.length)}` : p;

    setOpenTabPaths((prev) => prev.map(remapPath));
    setPrimaryPath((prev) => (prev ? remapPath(prev) : prev));
    setSecondaryPath((prev) => (prev ? remapPath(prev) : prev));
    setPinnedPaths((prev) => prev.map(remapPath));

    await loadWorkspaceForMode(mode);
    showToast(`Đã đổi tên thành "${cleanNew.split('/').pop()}"`, 'success');
  };

  const handleExportProjectZip = (targetPath: string, isFolder: boolean) => {
    flushLiveContent();
    const targetFiles = isFolder
      ? liveFiles.filter((f) => f.path.startsWith(`${targetPath}/`))
      : liveFiles.filter((f) => f.path === targetPath);

    if (targetFiles.length === 0) {
      showToast('Thư mục trống, không có tệp để nén ZIP', 'info');
      return;
    }

    const entries = targetFiles.map((f) => ({
      path: isFolder ? f.path.slice(targetPath.length + 1) : f.name,
      content: f.content
    }));
    const zipBase = targetPath.split('/').pop() || 'project';
    downloadZipArchive(`${zipBase}.zip`, entries);
    showToast(`Đã xuất ${zipBase}.zip (${entries.length} tệp)`, 'success');
  };

  const handleImportCodeFiles = async (fileList: FileList) => {
    flushLiveContent();
    const importedPaths: string[] = [];

    for (const file of Array.from(fileList)) {
      const safeName = file.name.replace(/[\\/:*?"<>|]+/g, '_');
      const isBinary = /\.(png|jpe?g|gif|webp|ico|bmp|woff2?|ttf|otf)$/i.test(safeName);

      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        if (isBinary) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });

      if (mode === 'local') {
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: safeName, content })
        });
      } else {
        await saveIdbFile(safeName, content);
      }
      importedPaths.push(safeName);
    }

    const updated = await loadWorkspaceForMode(mode);
    const firstImported = updated.find((f) => f.path === importedPaths[0]);
    if (firstImported) {
      openFileInActivePane(firstImported);
      setShowHomeScreen(false);
      setMobileTab('editor');
    }
    showToast(`Đã nhập ${importedPaths.length} tệp vào Workspace`, 'success');
  };

  const activeTestKey = activeFile?.path || '__global__';
  const activeTestCases = testCasesByFile[activeTestKey] || [];
  const activeTestResults = testResultsByFile[activeTestKey] || {};

  const handleChangeActiveTestCases = (next: TestCaseItem[]) => {
    setTestCasesByFile((prev) => ({ ...prev, [activeTestKey]: next }));
  };

  const normalizeJudgeOutput = (text: string) =>
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();

  const executeSingleTestCase = async (tc: TestCaseItem): Promise<TestCaseResult> => {
    const fileToRun = activeFile;
    if (!fileToRun) {
      return { id: tc.id, status: 'err', actualOutput: '', stderr: 'Chưa mở tệp mã nguồn.' };
    }
    if (fileToRun.language !== 'cpp' && fileToRun.language !== 'c' && fileToRun.language !== 'python') {
      return {
        id: tc.id,
        status: 'err',
        actualOutput: '',
        stderr: 'Bộ chấm Test Case hỗ trợ C, C++ và Python.'
      };
    }

    flushLiveContent();
    const latestSnap = liveFiles.map((f) => ({
      ...f,
      content: liveContentMapRef.current[f.path] ?? f.content
    }));
    const currentFile = latestSnap.find((f) => f.path === fileToRun.path) || fileToRun;

    setTestResultsByFile((prev) => ({
      ...prev,
      [activeTestKey]: {
        ...(prev[activeTestKey] || {}),
        [tc.id]: { id: tc.id, status: 'running', actualOutput: '' }
      }
    }));

    let stdoutBuf = '';
    let stderrBuf = '';
    let exitCode = 0;
    let elapsedMs = 0;

    await executeWithPiston(currentFile, latestSnap, compilerSettings, tc.input, {
      onChunk: (type, text) => {
        if (type === 'stdout') stdoutBuf += text;
        if (type === 'stderr') stderrBuf += text;
      },
      onFinish: (code, ms) => {
        exitCode = code;
        elapsedMs = ms;
      }
    });

    const normActual = normalizeJudgeOutput(stdoutBuf);
    const normExpected = normalizeJudgeOutput(tc.expectedOutput);
    const hasExpected = normExpected.length > 0;
    const status: TestCaseResult['status'] =
      exitCode !== 0 ? 'err' : !hasExpected || normActual === normExpected ? 'ac' : 'wa';

    const result: TestCaseResult = {
      id: tc.id,
      status,
      actualOutput: stdoutBuf.trimEnd(),
      stderr: stderrBuf.trim() || undefined,
      elapsedMs
    };

    setTestResultsByFile((prev) => ({
      ...prev,
      [activeTestKey]: {
        ...(prev[activeTestKey] || {}),
        [tc.id]: result
      }
    }));
    return result;
  };

  const handleRunSingleTest = async (tc: TestCaseItem) => {
    if (isRunningTests) return;
    hapticMedium();
    setIsRunningTests(true);
    try {
      const res = await executeSingleTestCase(tc);
      if (res.status === 'ac') {
        hapticSuccess();
      } else {
        hapticError();
      }
      showToast(
        res.status === 'ac'
          ? `${tc.name}: AC (${res.elapsedMs}ms)`
          : res.status === 'wa'
            ? `${tc.name}: Wrong Answer`
            : `${tc.name}: Lỗi thực thi`,
        res.status === 'ac' ? 'success' : 'error'
      );
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleRunAllTests = async () => {
    if (isRunningTests || activeTestCases.length === 0) return;
    hapticMedium();
    setIsRunningTests(true);
    let passed = 0;
    try {
      for (const tc of activeTestCases) {
        const res = await executeSingleTestCase(tc);
        if (res.status === 'ac') passed++;
      }
      const allPassed = passed === activeTestCases.length && activeTestCases.length > 0;
      if (allPassed) {
        hapticSuccess();
        setCelebrateKey((k) => k + 1);
      } else {
        hapticWarning();
      }
      showToast(
        allPassed
          ? `All Passed! (${passed}/${activeTestCases.length} AC)`
          : `Hoàn tất chấm bài: ${passed}/${activeTestCases.length} AC`,
        allPassed ? 'success' : 'info'
      );
    } finally {
      setIsRunningTests(false);
    }
  };

  // Tự động lưu mốc gốc (snapshot) lần đầu mở từng tệp để Diff View luôn sẵn sàng
  useEffect(() => {
    if (!activeFile || activeFile.language === 'asset') return;
    setFileSnapshots((prev) => {
      if (prev[activeFile.path] !== undefined) return prev;
      return { ...prev, [activeFile.path]: activeFile.content };
    });
  }, [activeFile?.path]);

  const handleSaveDiffSnapshot = useCallback(
    (file: WorkspaceFile) => {
      const current = liveContentMapRef.current[file.path] ?? file.content;
      setFileSnapshots((prev) => ({ ...prev, [file.path]: current }));
      showToast(`Đã chụp mốc so sánh cho ${file.name}`, 'success');
    },
    [showToast]
  );

  const handleToggleConsoleDock = useCallback(() => {
    hapticSelection();
    setIpadRightTool(null);
    setBottomOpen(true);
    setConsoleDock((prev) => {
      const next = prev === 'bottom' ? 'right' : 'bottom';
      showToast(next === 'right' ? 'Console gắn sang Bên phải' : 'Console gắn xuống Dưới đáy', 'info');
      return next;
    });
  }, [showToast]);

  const handleToggleRightTool = useCallback((tool: Exclude<IpadRightTool, null>) => {
    hapticSelection();
    setShowHomeScreen(false);
    setIpadRightTool((prev) => (prev === tool ? null : tool));
  }, []);

  const handleApplyAiCode = useCallback(
    (nextCode: string, openDiffAfter = false) => {
      if (!activeFile || activeFile.language === 'asset') return;
      const prevContent = liveContentMapRef.current[activeFile.path] ?? activeFile.content;
      setFileSnapshots((prev) => ({ ...prev, [activeFile.path]: prevContent }));
      handleCodeChange(activeFile, nextCode);
      const ed = activeEditorRef.current;
      if (ed && ed.getValue() !== nextCode) {
        const model = ed.getModel();
        if (model) {
          ed.executeEdits('ai-apply', [
            {
              range: model.getFullModelRange(),
              text: nextCode,
              forceMoveMarkers: true
            }
          ]);
        } else {
          ed.setValue(nextCode);
        }
      }
      showToast(`Đã lưu bản gốc & áp dụng vào ${activeFile.name}`, 'success');
      if (openDiffAfter) {
        setDiffOpen(true);
      }
    },
    [activeFile, activeEditorRef, handleCodeChange, showToast]
  );

  const handleInsertAiCode = useCallback(
    (snippet: string) => {
      if (!activeFile || activeFile.language === 'asset') return;
      const ed = activeEditorRef.current;
      if (ed) {
        const sel = ed.getSelection();
        if (sel) {
          ed.executeEdits('ai-insert', [
            { range: sel, text: snippet, forceMoveMarkers: true }
          ]);
          ed.focus();
          showToast('Đã chèn đoạn mã vào vị trí con trỏ', 'success');
          return;
        }
      }
      const prevContent = liveContentMapRef.current[activeFile.path] ?? activeFile.content;
      handleCodeChange(activeFile, `${prevContent}\n${snippet}`);
      showToast(`Đã chèn đoạn mã vào cuối ${activeFile.name}`, 'success');
    },
    [activeFile, activeEditorRef, handleCodeChange, showToast]
  );

  const handleAskAiAboutError = useCallback(() => {
    hapticSelection();
    if (breakpoint === 'mobile') {
      setMobileTab('editor');
      setMobileAiOpen(true);
    } else {
      setIpadRightTool('ai');
    }
    setAiAutoPrompt({
      id: Date.now(),
      prompt:
        'Hãy giải thích chi tiết lỗi biên dịch / runtime vừa xuất hiện trong Console, chỉ rõ dòng bị sai và hướng dẫn cách sửa gọn nhất.',
      includeCode: true,
      includeConsole: true
    });
  }, [breakpoint]);

  const handleSendScratchpadToAi = useCallback(
    (imageDataUrl: string, thumbUrl: string) => {
      hapticSelection();
      const base64Data = imageDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      if (!base64Data) return;
      if (breakpoint === 'mobile') {
        setMobileTab('editor');
        setMobileAiOpen(true);
      } else {
        setIpadRightTool('ai');
      }
      setAiAutoPrompt({
        id: Date.now(),
        prompt: 'Hãy đọc và giải thích ngắn gọn nội dung / hình vẽ tay trên bảng nháp này.',
        includeCode: false,
        includeConsole: false,
        attachedImage: {
          mimeType: 'image/jpeg',
          data: base64Data,
          previewUrl: imageDataUrl,
          thumbUrl,
          resolution: 'low'
        }
      });
      showToast('Đã gửi hình vẽ bảng nháp sang Trợ lý AI', 'info');
    },
    [breakpoint, showToast]
  );

  const handleSendSampleToTests = useCallback(
    (input: string, expectedOutput: string, name?: string) => {
      const nextIdx = activeTestCases.length + 1;
      const newTc: TestCaseItem = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name || `Sample #${nextIdx}`,
        input,
        expectedOutput
      };
      setTestCasesByFile((prev) => ({
        ...prev,
        [activeTestKey]: [...(prev[activeTestKey] || []), newTc]
      }));
      setBottomOpen(true);
      setRequestedConsoleTab({ tab: 'tests', seq: Date.now() });
      showToast(`Đã thêm "${newTc.name}" vào tab Tests`, 'success');
    },
    [activeTestCases.length, activeTestKey, showToast]
  );

  // ===== iPad Virtual Trackpad Handlers =====
  const handleTrackpadMove = useCallback((dx: number, dy: number, select: boolean) => {
    const ed = activeEditorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    const sel = ed.getSelection();
    if (!model || !sel) return;

    const lineCount = model.getLineCount();
    const curLine = sel.positionLineNumber;
    const curCol = sel.positionColumn;

    const nextLine = Math.max(1, Math.min(lineCount, curLine + dy));
    const maxCol = model.getLineMaxColumn(nextLine);
    const nextCol = Math.max(1, Math.min(maxCol, curCol + dx));

    if (select) {
      ed.setSelection({
        selectionStartLineNumber: sel.selectionStartLineNumber,
        selectionStartColumn: sel.selectionStartColumn,
        positionLineNumber: nextLine,
        positionColumn: nextCol
      });
    } else {
      ed.setPosition({ lineNumber: nextLine, column: nextCol });
    }
    ed.revealPosition({ lineNumber: nextLine, column: nextCol });
  }, []);

  const handleTrackpadSelectLine = useCallback(() => {
    const ed = activeEditorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    const pos = ed.getPosition();
    if (!model || !pos) return;
    ed.setSelection({
      startLineNumber: pos.lineNumber,
      startColumn: 1,
      endLineNumber: pos.lineNumber,
      endColumn: model.getLineMaxColumn(pos.lineNumber)
    });
    ed.focus();
  }, []);

  const handleTrackpadSelectBlock = useCallback(() => {
    const ed = activeEditorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    const pos = ed.getPosition();
    if (!model || !pos) return;
    const text = model.getValue();
    const offset = model.getOffsetAt(pos);

    let depth = 0;
    let openIdx = -1;
    for (let i = offset; i >= 0; i--) {
      if (text[i] === '}' && i !== offset) depth++;
      else if (text[i] === '{') {
        if (depth === 0) {
          openIdx = i;
          break;
        }
        depth--;
      }
    }

    if (openIdx !== -1) {
      let closeDepth = 0;
      let closeIdx = -1;
      for (let i = openIdx; i < text.length; i++) {
        if (text[i] === '{') closeDepth++;
        else if (text[i] === '}') {
          closeDepth--;
          if (closeDepth === 0) {
            closeIdx = i + 1;
            break;
          }
        }
      }
      if (closeIdx !== -1) {
        const startPos = model.getPositionAt(openIdx);
        const endPos = model.getPositionAt(closeIdx);
        ed.setSelection({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        });
        ed.revealRangeInCenter({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        });
        ed.focus();
        return;
      }
    }
    handleTrackpadSelectLine();
  }, [handleTrackpadSelectLine]);

  const handleTrackpadJumpEdge = useCallback((edge: 'start' | 'end') => {
    const ed = activeEditorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    const pos = ed.getPosition();
    if (!model || !pos) return;
    const col =
      edge === 'start'
        ? Math.max(1, model.getLineFirstNonWhitespaceColumn(pos.lineNumber) || 1)
        : model.getLineMaxColumn(pos.lineNumber);
    ed.setPosition({ lineNumber: pos.lineNumber, column: col });
    ed.revealPosition({ lineNumber: pos.lineNumber, column: col });
    ed.focus();
  }, []);

  // ===== iPadOS Split View Drag & Drop Files / Code Snippets =====
  const handleWorkspaceDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files') || e.dataTransfer?.types?.includes('text/plain')) {
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragOverWorkspace(true);
    }
  };

  const handleWorkspaceDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files') || e.dataTransfer?.types?.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleWorkspaceDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOverWorkspace(false);
    }
  };

  const handleWorkspaceDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOverWorkspace(false);

    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const assetFiles: File[] = [];
      const codeFiles: File[] = [];
      Array.from(droppedFiles).forEach((f) => {
        if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(f.name)) {
          assetFiles.push(f);
        } else {
          codeFiles.push(f);
        }
      });

      if (codeFiles.length > 0) {
        const dt = new DataTransfer();
        codeFiles.forEach((f) => dt.items.add(f));
        await handleImportCodeFiles(dt.files);
      }
      if (assetFiles.length > 0) {
        const dt = new DataTransfer();
        assetFiles.forEach((f) => dt.items.add(f));
        await handleImportAssets(dt.files);
      }
      return;
    }

    const droppedText = e.dataTransfer?.getData('text/plain');
    if (droppedText && droppedText.trim().length > 0) {
      const trimmed = droppedText.trim();
      const ext = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')
        ? 'html'
        : trimmed.includes('#include') || trimmed.includes('int main')
          ? 'cpp'
          : trimmed.includes('def ') || trimmed.includes('print(')
            ? 'py'
            : 'js';
      const fileName = `dropped_${Math.floor(Math.random() * 900 + 100)}.${ext}`;
      await handleCreateTemplateFile(fileName, droppedText);
      showToast(`Đã tạo tệp ${fileName} từ đoạn code kéo thả`, 'success');
    }
  };

  // Phím tắt bàn phím rời iPad (Magic Keyboard / Bluetooth) & Hold ⌘ Cheat Sheet HUD
  useEffect(() => {
    const clearCmdTimer = () => {
      if (cmdHoldTimerRef.current) {
        window.clearTimeout(cmdHoldTimerRef.current);
        cmdHoldTimerRef.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Nhấn giữ phím ⌘ (hoặc Alt trên Windows) 550ms để hiện bảng phím tắt iPadOS
      if ((e.key === 'Meta' || e.key === 'Alt') && !e.repeat) {
        cmdComboUsedRef.current = false;
        clearCmdTimer();
        cmdHoldTimerRef.current = window.setTimeout(() => {
          if (!cmdComboUsedRef.current && !showHomeScreen && breakpoint !== 'mobile') {
            setShortcutsHudHoldMode(true);
            setShortcutsHudOpen(true);
          }
        }, 550);
        return;
      }

      if (e.metaKey || e.altKey || e.ctrlKey) {
        cmdComboUsedRef.current = true;
        clearCmdTimer();
      }

      if (e.key === 'Escape') {
        if (shortcutsHudOpen) {
          setShortcutsHudOpen(false);
          setShortcutsHudHoldMode(false);
          return;
        }
        if (diffOpen) {
          setDiffOpen(false);
          return;
        }
        if (zenMode && !commandPaletteOpen && !settingsOpen) {
          setZenMode(false);
          showToast('Đã thoát chế độ Tập trung', 'info');
          return;
        }
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      } else if (key === 'b' && !e.shiftKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        setSidebarView((prev) => (prev ? null : 'explorer'));
      } else if (key === 'j' && e.altKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        handleToggleConsoleDock();
      } else if (key === 'j' && !e.shiftKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        setBottomOpen((v) => !v);
      } else if (e.key === '\\') {
        e.preventDefault();
        setShowHomeScreen(false);
        handleToggleSplit();
      } else if (key === 'f' && e.shiftKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        setSidebarView('search');
      } else if (key === 'o' && e.shiftKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        setSidebarView('outline');
      } else if (key === 'd' && e.shiftKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        setDiffOpen((v) => !v);
      } else if (key === 'a' && e.shiftKey) {
        e.preventDefault();
        handleToggleRightTool('scratchpad');
      } else if (key === 'n' && e.shiftKey) {
        e.preventDefault();
        handleToggleRightTool('notes');
      } else if (key === 'i' && e.shiftKey) {
        e.preventDefault();
        setShowHomeScreen(false);
        if (breakpoint === 'mobile') {
          setMobileAiOpen((v) => !v);
        } else {
          handleToggleRightTool('ai');
        }
      } else if (key === 'k' && !e.shiftKey) {
        e.preventDefault();
        setLogs([]);
        setLastElapsedMs(null);
        showToast('Đã xóa Console', 'info');
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setEditorSettings((prev) => {
          const next = Math.min(28, prev.fontSize + 1);
          showToast(`Cỡ chữ Editor: ${next}px`, 'info');
          return { ...prev, fontSize: next };
        });
      } else if (e.key === '-') {
        e.preventDefault();
        setEditorSettings((prev) => {
          const next = Math.max(11, prev.fontSize - 1);
          showToast(`Cỡ chữ Editor: ${next}px`, 'info');
          return { ...prev, fontSize: next };
        });
      } else if (e.key === '0') {
        e.preventDefault();
        setEditorSettings((prev) => ({ ...prev, fontSize: 14 }));
        showToast('Cỡ chữ mặc định: 14px', 'info');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Alt') {
        clearCmdTimer();
        setShortcutsHudOpen((open) => (shortcutsHudHoldMode ? false : open));
        setShortcutsHudHoldMode(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearCmdTimer);
    return () => {
      clearCmdTimer();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearCmdTimer);
    };
  }, [
    handleToggleSplit,
    handleToggleConsoleDock,
    handleToggleRightTool,
    showToast,
    zenMode,
    commandPaletteOpen,
    settingsOpen,
    diffOpen,
    shortcutsHudOpen,
    shortcutsHudHoldMode,
    showHomeScreen,
    breakpoint
  ]);

  const activeBreadcrumbSymbol = useMemo(() => {
    if (!activeFile || activeFile.language === 'asset') return null;
    const live = liveContentMapRef.current[activeFile.path] ?? activeFile.content;
    const syms = extractOutlineSymbols(live, activeFile.language);
    let best: { name: string; line: number } | null = null;
    for (const s of syms) {
      if (s.line <= cursor.line) best = { name: s.name, line: s.line };
    }
    return best;
  }, [activeFile?.path, activeFile?.content, activeFile?.language, cursor.line]);

  // Cử chỉ vuốt cạnh trái để mở Sidebar & vuốt xuống để đóng Terminal Sheet
  const handleEdgeTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch && touch.clientX <= 28) {
      edgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    } else {
      edgeSwipeStartRef.current = null;
    }
  };

  const handleEdgeTouchEnd = (e: React.TouchEvent) => {
    const start = edgeSwipeStartRef.current;
    edgeSwipeStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (dx > 55 && dy < 52) {
      if (breakpoint === 'mobile') {
        setMobileTab('files');
      } else {
        setSidebarView('explorer');
      }
    }
  };

  const handleTerminalSheetDragStart = (e: React.PointerEvent) => {
    sheetDragStartRef.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTerminalSheetDragMove = (e: React.PointerEvent) => {
    if (sheetDragStartRef.current === null) return;
    setSheetDragY(Math.max(0, e.clientY - sheetDragStartRef.current));
  };

  const handleTerminalSheetDragEnd = (closeFn: () => void) => {
    if (sheetDragStartRef.current === null) return;
    const pulled = sheetDragY;
    sheetDragStartRef.current = null;
    setSheetDragY(0);
    if (pulled > 85) {
      closeFn();
    }
  };

  const runningIslandLabel = isRunningTests
    ? 'Đang chấm Test Cases...'
    : `Đang chạy ${activeFile?.name || 'mã nguồn'}...`;

  const renderWallpaperBackdrop = wallpaperStyle ? (
    <div
      aria-hidden="true"
      style={wallpaperStyle}
      className="fixed -inset-1 z-0 pointer-events-none transition-all duration-500"
    />
  ) : null;

  const paletteCommands: PaletteCommand[] = [
    {
      id: 'go-home',
      title: 'Về Trang chủ (Home)',
      subtitle: 'Mở màn hình chào mừng & danh sách dự án',
      icon: <PaletteIcons.Home size={15} className="text-sky-400" />,
      action: () => setShowHomeScreen(true)
    },
    {
      id: 'run-code',
      title: isWebLanguage(activeFile?.language) ? 'Bật Live Server Preview' : 'Chạy mã nguồn (Run)',
      subtitle: 'Biên dịch & thực thi tệp hiện tại',
      shortcut: '⌘Enter',
      icon: <PaletteIcons.Play size={15} className="text-emerald-400" />,
      action: () => {
        setShowHomeScreen(false);
        handleRun();
      }
    },
    {
      id: 'new-file',
      title: 'Tạo tệp mới nhanh',
      subtitle: 'Thêm tệp mới vào Workspace',
      icon: <PaletteIcons.FilePlus size={15} className="text-violet-400" />,
      action: () => {
        setShowHomeScreen(false);
        handleQuickNewFile();
      }
    },
    {
      id: 'toggle-ai-assistant',
      title: 'Mở / Đóng Trợ lý AI Gemini 4',
      subtitle: 'Giải thích lỗi, gợi ý thuật toán & review code',
      shortcut: '⌘⇧I',
      icon: <Sparkles size={15} className="text-purple-400" />,
      action: () => {
        setShowHomeScreen(false);
        if (breakpoint === 'mobile') {
          setMobileAiOpen((v) => !v);
        } else {
          handleToggleRightTool('ai');
        }
      }
    },
    {
      id: 'format-code',
      title: 'Định dạng mã nguồn (Format)',
      subtitle: 'Căn chỉnh code gọn đẹp',
      icon: <PaletteIcons.Wand2 size={15} className="text-amber-400" />,
      action: () => {
        setShowHomeScreen(false);
        handleFormat();
      }
    },
    {
      id: 'toggle-split',
      title: splitOpen ? 'Tắt chế độ Split View' : 'Bật chế độ Split View (2 khung)',
      subtitle: 'Chia đôi màn hình so sánh 2 tệp',
      shortcut: '⌘\\',
      icon: <PaletteIcons.Columns size={15} className="text-sky-400" />,
      action: () => {
        setShowHomeScreen(false);
        handleToggleSplit();
      }
    },
    {
      id: 'toggle-sidebar',
      title: 'Ẩn / Hiện thanh thư mục (Explorer)',
      shortcut: '⌘B',
      icon: <PaletteIcons.PanelLeft size={15} className="text-sky-400" />,
      action: () => {
        setShowHomeScreen(false);
        setSidebarView((prev) => (prev ? null : 'explorer'));
      }
    },
    {
      id: 'search-workspace',
      title: 'Tìm kiếm toàn dự án (Search)',
      shortcut: '⌘⇧F',
      icon: <PaletteIcons.Search size={15} className="text-emerald-400" />,
      action: () => {
        setShowHomeScreen(false);
        setSidebarView('search');
      }
    },
    {
      id: 'toggle-terminal',
      title: 'Ẩn / Hiện Terminal & Test Cases',
      shortcut: '⌘J',
      icon: <PaletteIcons.PanelBottom size={15} className="text-emerald-400" />,
      action: () => {
        setShowHomeScreen(false);
        setBottomOpen((v) => !v);
      }
    },
    {
      id: 'zen-mode',
      title: isFocusMode ? 'Thoát chế độ Tập trung (Zen Mode)' : 'Bật chế độ Tập trung (Zen Mode)',
      icon: <PaletteIcons.Maximize2 size={15} className="text-violet-400" />,
      action: () => {
        setShowHomeScreen(false);
        toggleFocusMode();
      }
    },
    {
      id: 'cycle-theme',
      title: 'Đổi chủ đề màu sắc (Theme)',
      subtitle: `Đang dùng: ${currentThemeObj.name}`,
      icon: <PaletteIcons.Palette size={15} className="text-pink-400" />,
      action: cycleNextTheme
    },
    {
      id: 'clear-console',
      title: 'Xóa lịch sử Console',
      shortcut: '⌘K',
      icon: <PaletteIcons.Trash2 size={15} className="text-rose-400" />,
      action: () => {
        setLogs([]);
        setLastElapsedMs(null);
        showToast('Đã xóa Console', 'info');
      }
    },
    {
      id: 'sync-device-files',
      title: 'Đồng bộ 2 chiều với app Tệp (Files)',
      subtitle: 'Kéo & đẩy tệp với Trên iPad/iPhone của tôi → Code With You',
      icon: <PaletteIcons.PanelLeft size={15} className="text-sky-400" />,
      action: () => {
        void handleSyncDeviceFiles();
      }
    },
    {
      id: 'toggle-offline-cpp',
      title:
        compilerSettings.cppEngine === 'offline-wasm'
          ? 'Chuyển C/C++ về chế độ Tự động (Cloud + Offline)'
          : 'Bật biên dịch C/C++ 100% Offline (LLVM Clang WASM)',
      subtitle: 'Biên dịch C/C++ ngay trên máy không cần Wi-Fi',
      icon: <PaletteIcons.Play size={15} className="text-emerald-400" />,
      action: () => {
        const next = compilerSettings.cppEngine === 'offline-wasm' ? 'auto' : 'offline-wasm';
        void handleUpdateCompiler({ ...compilerSettings, cppEngine: next });
        showToast(
          next === 'offline-wasm'
            ? 'Đã bật C/C++ 100% Offline (LLVM Clang WASM)'
            : 'Đã chuyển C/C++ sang chế độ Tự động (Cloud + Offline)',
          'info'
        );
      }
    },
    {
      id: 'open-settings',
      title: 'Mở Cài đặt Code With You',
      icon: <PaletteIcons.Settings size={15} className="text-zinc-400" />,
      action: () => {
        if (breakpoint === 'mobile' && !showHomeScreen) {
          setMobileTab('settings');
        } else {
          setSettingsOpen(true);
        }
      }
    }
  ];

  const renderCommandPalette = (
    <CommandPalette
      open={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      files={files}
      onSelectFile={(file) => {
        flushLiveContent();
        openFileInActivePane(file);
        setShowHomeScreen(false);
        setMobileTab('editor');
      }}
      commands={paletteCommands}
    />
  );

  /* ===================== HOME / WELCOME SCREEN (IPAD & IPHONE) ===================== */
  if (showHomeScreen) {
    return (
      <>
        {renderWallpaperBackdrop}
        {showSplash && (
          <SplashScreen
            themeMode={currentThemeObj.mode}
            bgHex={currentThemeObj.canvasBg}
            accentColor={activeAccentOverride?.primary || currentThemeObj.accentSwatch}
            onExitStart={() => {
              setSplashPhase('exiting');
            }}
            onFinish={() => {
              setShowSplash(false);
              setSplashPhase('done');
            }}
          />
        )}

        <HomeScreen
          breakpoint={breakpoint}
          tree={tree}
          files={files}
          pinnedPaths={pinnedPaths}
          themeSwatch={activeAccentOverride?.primary || currentThemeObj.accentSwatch}
          onTogglePin={handleTogglePin}
          onCycleTheme={cycleNextTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenProjects={() => {
            setShowHomeScreen(false);
            if (breakpoint === 'mobile') {
              setMobileTab('files');
            } else {
              setSidebarView('explorer');
            }
          }}
          onOpenFile={(file) => {
            flushLiveContent();
            openFileInActivePane(file);
            setLivePreviewOpen(false);
            setShowHomeScreen(false);
            setMobileTab('editor');
          }}
          onRunActive={() => {
            setShowHomeScreen(false);
            setMobileTab('editor');
            if (activeFile) {
              window.setTimeout(() => {
                handleRun();
              }, 80);
            }
          }}
          onQuickStart={handleQuickStartFromHome}
          onCreateProject={handleCreateProjectFromHome}
          onRenameEntry={handleRenameEntry}
          onExportProjectZip={handleExportProjectZip}
          onImportCodeFiles={handleImportCodeFiles}
          onDeleteEntry={handleDeleteEntry}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onReplaySplash={() => {
            setSplashPhase('active');
            setShowSplash(true);
          }}
          splashPhase={splashPhase}
        />

        {renderCommandPalette}

        {settingsOpen && (
          <Suspense fallback={null}>
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
              onChangeUiTheme={handleChangeUiTheme}
              uiDensity={uiDensity}
              onChangeUiDensity={setUiDensity}
              typingSound={typingSound}
              onChangeTypingSound={setTypingSound}
              hapticsEnabled={hapticsEnabled}
              onChangeHapticsEnabled={handleChangeHapticsEnabled}
              onSyncDeviceFiles={handleSyncDeviceFiles}
              isSyncingFiles={isSyncingFiles}
              onPreloadOfflineCpp={handlePreloadOfflineCpp}
              offlineCppState={offlineCppState}
              offlineCppPercent={offlineCppPercent}
              visualPrefs={visualPrefs}
              onUpdateVisualPrefs={handleUpdateVisualPrefs}
              aiSettings={aiSettings}
              onUpdateAiSettings={handleUpdateAiSettings}
            />
          </Suspense>
        )}

        <FloatingToast
          toast={toast}
          isMobile={breakpoint === 'mobile'}
          isRunning={isRunning || isRunningTests}
          runningLabel={runningIslandLabel}
          celebrateKey={celebrateKey}
        />
      </>
    );
  }

  /* ===================== MOBILE VIEW ===================== */
  if (breakpoint === 'mobile') {
    return (
      <>
        {renderWallpaperBackdrop}
        <div
          onTouchStart={handleEdgeTouchStart}
          onTouchEnd={handleEdgeTouchEnd}
          style={{ backgroundColor: 'var(--bg-canvas)' }}
          className={`glass-canvas ${
            isNativeMotionAvailable() ? '' : 'ios-view-push'
          } w-full h-full flex flex-col overflow-hidden theme-scope relative z-10`}
        >
        <header
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-subtle)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))'
          }}
          className="glass-surface w-full shrink-0 relative z-20"
        >
          <div className="h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowHomeScreen(true)}
              style={{ color: 'var(--text-primary)' }}
              className="w-9 h-9 rounded-xl hover:bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 btn-lift"
              title="Về Trang chủ"
            >
              <Home size={18} />
            </button>
            {activeFile && <FileTypeIcon fileName={activeFile.name} size={17} className="shrink-0" />}
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {activeFile?.name || 'Code With You'}
            </span>
            {activeFile?.dirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isRunning ? (
              <button
                type="button"
                onClick={handleKill}
                className="h-9 px-3.5 rounded-xl bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 btn-lift"
              >
                <Square size={11} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRun}
                className="h-9 px-3.5 rounded-xl run-btn font-bold text-xs flex items-center justify-center gap-1.5 btn-lift"
              >
                <Play size={12} fill="currentColor" />
                <span>{isWebLanguage(activeFile?.language) ? 'Live' : 'Run'}</span>
              </button>
            )}

            {aiSettings.showDockButton && (
              <button
                type="button"
                onClick={() => {
                  hapticSelection();
                  setMobileMoreOpen(false);
                  setMobileAiOpen(true);
                }}
                style={{
                  backgroundColor: 'var(--bg-active)',
                  color: 'var(--accent-primary)'
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl btn-lift"
                title="Trợ lý AI Gemini 4"
              >
                <Sparkles size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMoreOpen((v) => !v)}
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              className="w-9 h-9 flex items-center justify-center rounded-xl btn-lift"
              title="Tùy chọn khác"
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
          </div>
        </header>

        {mobileMoreOpen && (
          <div className="mx-2.5 mt-2 ide-card p-3 flex flex-col gap-2.5 text-xs ios-popover-enter relative z-30">
            <div className="flex items-center justify-between gap-2">
              <HeaderTimer align="left" />
              <button
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  setCommandPaletteOpen(true);
                }}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-9 px-3 rounded-xl font-semibold flex items-center gap-1.5 btn-lift"
              >
                <Command size={14} className="text-sky-400" />
                <span>Tìm nhanh</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handleFormat();
                  setMobileMoreOpen(false);
                }}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="py-2 px-2 rounded-xl btn-lift font-medium flex items-center justify-center gap-1"
              >
                <Wand2 size={12} className="text-sky-400" />
                <span>Format</span>
              </button>
              <button
                type="button"
                onClick={cycleNextTheme}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="py-2 px-2 rounded-xl btn-lift font-medium flex items-center justify-center gap-1"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentThemeObj.accentSwatch }}
                />
                <span className="truncate">Theme</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditorSettings((s) => ({ ...s, lineNumbers: s.lineNumbers === 'on' ? 'off' : 'on' }));
                  setMobileMoreOpen(false);
                }}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="py-2 px-2 rounded-xl btn-lift font-medium"
              >
                Dòng: {editorSettings.lineNumbers === 'on' ? 'Bật' : 'Tắt'}
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            paddingLeft: 'max(8px, env(safe-area-inset-left))',
            paddingRight: 'max(8px, env(safe-area-inset-right))',
            paddingBottom: isKeyboardOpen
              ? 'max(8px, env(safe-area-inset-bottom))'
              : 'calc(78px + max(10px, calc(env(safe-area-inset-bottom) - 10px)))'
          }}
          className="flex-1 min-h-0 flex flex-col pt-2 relative"
        >
          <div
            className={`flex-1 min-h-0 flex flex-col ide-card overflow-hidden ${
              mobileTab === 'editor' ? 'flex tab-content-enter' : 'hidden'
            }`}
          >
            {livePreviewOpen ? (
              <Suspense fallback={null}>
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
              </Suspense>
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
                  onSelectionChange={setEditorSelection}
                  onQuickCreateTemplate={handleCreateTemplateFile}
                  onQuickCreateWebProject={handleCreateWebStarterProject}
                />
                <MobileCodingToolbar
                  language={mobileToolbarLang}
                  onInsertToken={handleInsertToken}
                  onUndo={handleEditorUndo}
                  onRedo={handleEditorRedo}
                  onMoveCursor={handleMoveCursor}
                />
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
                onRenameEntry={handleRenameEntry}
                onImportCodeFiles={handleImportCodeFiles}
                onDeleteEntry={handleDeleteEntry}
                onRefresh={() => loadWorkspaceForMode(mode)}
              />
            </div>
          )}

          {mobileTab === 'terminal' && (
            <div
              className="flex-1 min-h-0 flex flex-col justify-end rounded-2xl overflow-hidden ios-backdrop-enter"
              onClick={() => setMobileTab('editor')}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  transform: sheetDragY > 0 ? `translate3d(0, ${sheetDragY}px, 0)` : undefined,
                  animation: sheetDragY > 0 || sheetDragStartRef.current !== null ? 'none' : undefined,
                  transition: sheetDragStartRef.current === null ? 'transform 0.3s var(--ease-ios-spring)' : 'none'
                }}
                className="ide-card overflow-hidden ios-sheet-enter"
              >
                <div
                  onPointerDown={handleTerminalSheetDragStart}
                  onPointerMove={handleTerminalSheetDragMove}
                  onPointerUp={() => handleTerminalSheetDragEnd(() => setMobileTab('editor'))}
                  onPointerCancel={() => handleTerminalSheetDragEnd(() => setMobileTab('editor'))}
                  className="pt-2.5 pb-1.5 flex justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing"
                  title="Vuốt xuống để đóng"
                >
                  <span className="w-10 h-1 rounded-full opacity-40" style={{ backgroundColor: 'var(--text-secondary)' }} />
                </div>
                <BottomPanel
                  mode={mode}
                  logs={logs}
                  diagnostics={allDiagnostics}
                  isRunning={isRunning}
                  stdinPreset={stdinPreset}
                  autoEof={autoEof}
                  testCases={activeTestCases}
                  testResults={activeTestResults}
                  isRunningTests={isRunningTests}
                  onChangeTestCases={handleChangeActiveTestCases}
                  onRunAllTests={handleRunAllTests}
                  onRunSingleTest={handleRunSingleTest}
                  onChangeStdinPreset={setStdinPreset}
                  onChangeAutoEof={setAutoEof}
                  onRunWithInput={handleRun}
                  onSendStdin={handleSendStdin}
                  onSendEof={handleSendEof}
                  isWaitingForInput={isWaitingForInput}
                  hideVirtualKeyboard={Boolean(editorSettings.hardwareKeyboardMode)}
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
                  onAskAiError={aiSettings.showDockButton ? handleAskAiAboutError : undefined}
                  isSheet
                />
              </div>
            </div>
          )}
        </div>

        {/* MOBILE iOS SHEET CHO TRỢ LÝ AI GEMINI 4 */}
        {mobileAiOpen && (
          <div
            onClick={() => setMobileAiOpen(false)}
            style={{
              paddingTop: 'max(28px, env(safe-area-inset-top))'
            }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end ios-backdrop-enter"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-panel)',
                borderTop: '1px solid var(--border-subtle)',
                boxShadow: '0 -18px 48px -10px rgba(0, 0, 0, 0.55)'
              }}
              className="w-full h-[84dvh] max-h-[calc(100dvh-42px)] rounded-t-3xl overflow-hidden flex flex-col ios-sheet-enter"
            >
              <Suspense fallback={null}>
                <AiAssistantPane
                  activeFile={activeFile}
                  activeCode={
                    activeFile ? (liveContentMapRef.current[activeFile.path] ?? activeFile.content) : ''
                  }
                  codeSelection={editorSelection}
                  projectKey={activeFile?.path || 'workspace'}
                  logs={logs}
                  diagnostics={allDiagnostics}
                  settings={aiSettings}
                  onUpdateSettings={handleUpdateAiSettings}
                  onApplyCodeToFile={handleApplyAiCode}
                  onInsertCodeAtCursor={handleInsertAiCode}
                  onOpenDiffViewer={() => {
                    setMobileAiOpen(false);
                    setDiffOpen(true);
                  }}
                  onClose={() => setMobileAiOpen(false)}
                  autoPrompt={aiAutoPrompt}
                  onConsumeAutoPrompt={(id) =>
                    setAiAutoPrompt((cur) => (cur?.id === id ? null : cur))
                  }
                  isSheet
                />
              </Suspense>
            </div>
          </div>
        )}

        {mobileTab === 'settings' && (
          <Suspense fallback={null}>
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
              onChangeUiTheme={handleChangeUiTheme}
              uiDensity={uiDensity}
              onChangeUiDensity={setUiDensity}
              typingSound={typingSound}
              onChangeTypingSound={setTypingSound}
              hapticsEnabled={hapticsEnabled}
              onChangeHapticsEnabled={handleChangeHapticsEnabled}
              onSyncDeviceFiles={handleSyncDeviceFiles}
              isSyncingFiles={isSyncingFiles}
              onPreloadOfflineCpp={handlePreloadOfflineCpp}
              offlineCppState={offlineCppState}
              offlineCppPercent={offlineCppPercent}
              visualPrefs={visualPrefs}
              onUpdateVisualPrefs={handleUpdateVisualPrefs}
              aiSettings={aiSettings}
              onUpdateAiSettings={handleUpdateAiSettings}
            />
          </Suspense>
        )}

        {renderCommandPalette}

        <FloatingToast
          toast={toast}
          isMobile
          isRunning={isRunning || isRunningTests}
          runningLabel={runningIslandLabel}
          celebrateKey={celebrateKey}
        />

        {!isKeyboardOpen && (
          <MobileNav
            activeTab={mobileTab}
            onSelectTab={(t) => setMobileTab(t)}
            onGoHome={() => setShowHomeScreen(true)}
            problemCount={allDiagnostics.length}
          />
        )}
        </div>
      </>
    );
  }

  /* ===================== DESKTOP & IPAD TABLET VIEW ===================== */
  const splitDirection = breakpoint === 'tablet' && width < height ? 'flex-col' : 'flex-row';
  const splitIsVertical = splitDirection === 'flex-col';
  const outerGapClass = zenMode
    ? 'p-4 sm:p-8 gap-0'
    : uiDensity === 'compact'
      ? 'gap-1.5'
      : 'gap-2.5';
  const showRightConsoleDock =
    bottomOpen && consoleDock === 'right' && (breakpoint === 'desktop' || width >= 900);
  const showRightPanel = !zenMode && (ipadRightTool !== null || showRightConsoleDock);
  const projectKey = activeFile?.path || 'workspace';

  return (
    <>
      {renderWallpaperBackdrop}
      <div
        onTouchStart={handleEdgeTouchStart}
        onTouchEnd={handleEdgeTouchEnd}
        onDragEnter={handleWorkspaceDragEnter}
        onDragOver={handleWorkspaceDragOver}
        onDragLeave={handleWorkspaceDragLeave}
        onDrop={handleWorkspaceDrop}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          color: 'var(--text-primary)',
          paddingTop: zenMode ? undefined : 'max(6px, env(safe-area-inset-top))',
          paddingRight: zenMode
            ? undefined
            : uiDensity === 'compact'
              ? 'max(8px, env(safe-area-inset-right))'
              : 'max(12px, env(safe-area-inset-right))',
          paddingBottom: zenMode ? undefined : 'max(6px, calc(env(safe-area-inset-bottom) - 6px))',
          paddingLeft: zenMode
            ? undefined
            : uiDensity === 'compact'
              ? 'max(8px, env(safe-area-inset-left))'
              : 'max(12px, env(safe-area-inset-left))'
        }}
        className={`glass-canvas ${
          isNativeMotionAvailable() ? '' : 'ios-view-push'
        } w-full h-full flex flex-col ${outerGapClass} overflow-hidden select-none relative z-10`}
      >

      {/* AMBIENT MESH ORBS IN CINEMA ZEN MODE */}
      {zenMode && (
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="zen-orb-a absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)' }}
          />
          <div
            className="zen-orb-b absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
          />
        </div>
      )}

      {/* FLOATING GLASS EXIT PILL IN ZEN MODE */}
      {zenMode && (
        <div className="fixed top-3 right-4 z-40 flex items-center gap-1.5 ios-popover-enter">
          <button
            type="button"
            onClick={handleRun}
            className="h-8 px-3 rounded-full run-btn text-xs font-bold flex items-center gap-1.5 shadow-lg btn-lift"
          >
            <Play size={11} fill="currentColor" />
            <span>{isWebLanguage(activeFile?.language) ? 'Go Live' : 'Run'}</span>
          </button>
          <button
            type="button"
            onClick={toggleFocusMode}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)'
            }}
            className="h-8 px-3 rounded-full backdrop-blur-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg btn-lift"
            title="Thoát Zen Mode (Esc)"
          >
            <Minimize2 size={13} style={{ color: 'var(--accent-primary)' }} />
            <span>Thoát Zen</span>
          </button>
        </div>
      )}

      {/* FRAMELESS LIQUID-GLASS TOP CHROME HEADER (GIỐNG ẢNH MẪU) */}
      {!zenMode && (
      <header className="h-11 px-1 flex items-center justify-between gap-3 shrink-0 relative z-30">
        {/* Left: Minimalist App Logo aligned over Left Pill + Split toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowHomeScreen(true)}
            className="w-11 h-9 rounded-full hover:bg-[var(--bg-panel)] flex items-center justify-center transition-colors btn-lift"
            title="Về Trang chủ (Home)"
          >
            <img src="/app-logo.png" alt="Home" className="w-6 h-6 rounded-md object-contain" />
          </button>

          <button
            onClick={handleToggleSplit}
            style={
              splitOpen
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                    color: 'var(--text-primary)'
                  }
                : undefined
            }
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              splitOpen
                ? ''
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
            title="Bật / Tắt chia đôi màn hình Split View (⌘\)"
          >
            <Columns size={15} />
          </button>
        </div>

        {/* Center: Sleek Borderless Tonal Search Pill */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          style={{
            backgroundColor: 'var(--bg-panel)',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--text-secondary)'
          }}
          className="hidden sm:flex flex-1 max-w-md h-9 px-3.5 rounded-full items-center justify-between gap-2 text-xs hover:bg-[var(--bg-panel-alt)] transition-colors min-w-0"
          title="Mở Command Palette & tìm tệp nhanh (⌘P)"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search size={13} className="shrink-0 opacity-70" />
            <span className="truncate font-normal opacity-85" style={{ color: 'var(--text-primary)' }}>
              {activeFile?.path || 'Search files or commands...'}
            </span>
          </div>
          <kbd
            style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-secondary)' }}
            className="px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0"
          >
            {/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? '⌘P' : 'Ctrl+P'}
          </kbd>
        </button>

        {/* Right Controls — Quiet Minimal macOS / iPadOS Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderTimer />

          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setThemePickerOpen((v) => !v)}
              style={{ color: 'var(--text-secondary)' }}
              className="h-8 px-2 rounded-lg hover:bg-[var(--bg-elevated)]/80 hover:text-[var(--text-primary)] flex items-center gap-1.5 text-xs font-medium transition-colors"
              title={`Theme: ${currentThemeObj.name}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentThemeObj.accentSwatch }}
              />
              <Palette size={14} />
            </button>

            {themePickerOpen && (
              <div
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  boxShadow:
                    '0 20px 50px -12px rgba(0, 0, 0, 0.42), 0 0 0 1px color-mix(in srgb, var(--text-primary) 6%, transparent)',
                  color: 'var(--text-primary)'
                }}
                className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-[75vh] overflow-y-auto rounded-2xl p-3.5 z-50 ios-popover-enter"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Chủ đề màu sắc ({UI_THEMES.length})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] uppercase" style={{ color: 'var(--text-secondary)' }}>
                    {currentThemeObj.mode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mb-3.5">
                  {UI_THEMES.map((t) => {
                    const selected = t.id === uiTheme;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          handleChangeUiTheme(t.id);
                          showToast(`Theme: ${t.name}`, 'info');
                        }}
                        style={{ color: 'var(--text-primary)' }}
                        className={`w-full px-2.5 py-2 rounded-xl text-left text-[11px] font-medium flex items-center justify-between gap-1.5 transition-all btn-lift ${
                          selected
                            ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent-primary)]/40'
                            : 'bg-[var(--bg-panel-alt)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-5 h-5 rounded-lg flex items-center justify-center shadow-xs shrink-0 border border-black/10"
                            style={{ backgroundColor: t.bgSwatch }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: t.accentSwatch }}
                            />
                          </span>
                          <span className="truncate">{t.shortName}</span>
                        </div>
                        {selected && <Check size={12} className="shrink-0" style={{ color: t.accentSwatch }} />}
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
                    style={{ color: 'var(--text-primary)' }}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-medium flex items-center justify-center gap-1.5 btn-lift"
                  >
                    {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isFocusMode ? 'Thoát chế độ Tập trung' : 'Chế độ Tập trung (Zen Mode)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleFocusMode}
            className="h-8 w-8 rounded-lg text-xs transition-colors flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75"
            title="Chế độ Tập trung (Zen Mode)"
          >
            <Maximize2 size={14} />
          </button>

          <button
            onClick={() => setBottomOpen((v) => !v)}
            className={`h-8 w-8 rounded-lg text-xs transition-colors flex items-center justify-center ${
              bottomOpen
                ? 'bg-[var(--bg-active)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75'
            }`}
            title="Ẩn / Hiện bảng Console & Tests (⌘J)"
          >
            <PanelBottom size={15} />
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
            title="Cài đặt chi tiết"
          >
            <Settings size={15} />
          </button>

          {isRunning ? (
            <button
              onClick={handleKill}
              className="h-8 px-3.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 ml-0.5 btn-lift"
            >
              <Square size={11} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="h-8 px-3.5 rounded-full run-btn font-bold text-xs flex items-center gap-1.5 ml-0.5 btn-lift"
            >
              <Play size={11.5} fill="currentColor" />
              <span>{isWebLanguage(activeFile?.language) ? 'Go Live' : 'Run'}</span>
            </button>
          )}
        </div>
      </header>
      )}

      {/* MAIN WORKSPACE: LEFT PILL RAIL + ROUNDED EXPLORER + ROUNDED EDITOR + RIGHT PILL RAIL */}
      <div
        className={`flex-1 min-h-0 flex ${
          zenMode ? 'max-w-5xl mx-auto w-full relative z-10' : uiDensity === 'compact' ? 'gap-1.5' : 'gap-2.5'
        } relative z-10`}
      >
        {/* SIGNATURE UNIFIED LEFT FLOATING VERTICAL PILL RAIL */}
        {!zenMode && (
          <LeftActivityPill
            sidebarView={sidebarView}
            diffOpen={diffOpen}
            consoleDock={consoleDock}
            bottomOpen={bottomOpen}
            rightTool={ipadRightTool}
            showAiTool={aiSettings.showDockButton}
            trackpadOpen={trackpadOpen}
            hardwareKeyboardMode={Boolean(editorSettings.hardwareKeyboardMode)}
            shortcutsHudOpen={shortcutsHudOpen}
            onSelectSidebar={(view) => setSidebarView((prev) => (prev === view ? null : view))}
            onToggleDiff={() => setDiffOpen((v) => !v)}
            onToggleRightTool={handleToggleRightTool}
            onToggleConsoleDock={handleToggleConsoleDock}
            onToggleTrackpad={() => setTrackpadOpen((v) => !v)}
            onToggleHardwareKeyboardMode={handleToggleHardwareKeyboardMode}
            onOpenShortcutsHud={() => {
              setShortcutsHudHoldMode(false);
              setShortcutsHudOpen(true);
            }}
          />
        )}

        {/* LEFT EXPLORER / SEARCH / OUTLINE FLOATING CARD — LIQUID-GLASS SPRING EXPAND/COLLAPSE */}
        {breakpoint === 'desktop' && !zenMode && (
          <div
            style={{
              width: sidebarView ? `${sidebarWidth}px` : '0px',
              marginRight: sidebarView ? '0px' : uiDensity === 'compact' ? '-6px' : '-10px',
              transition: isResizingSidebar
                ? 'none'
                : 'width 0.38s cubic-bezier(0.22, 1, 0.36, 1), margin-right 0.38s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
            className={`shrink-0 h-full flex overflow-hidden ${sidebarView ? '' : 'pointer-events-none'}`}
          >
            <aside
              style={{
                width: `${sidebarWidth}px`,
                opacity: sidebarView ? 1 : 0,
                transform: sidebarView
                  ? 'translate3d(0, 0, 0) scale(1)'
                  : 'translate3d(-22px, 0, 0) scale(0.96)',
                filter: sidebarView ? 'blur(0px)' : 'blur(3px)',
                transformOrigin: 'left center',
                transition: isResizingSidebar
                  ? 'none'
                  : 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.26s ease'
              }}
              className="shrink-0 h-full ide-card flex flex-col overflow-hidden"
            >
              <div
                key={renderedSidebarView}
                className="flex-1 min-h-0 flex flex-col overflow-hidden sidebar-view-swap"
              >
                {renderedSidebarView !== 'explorer' && (
                  <div className="px-4 pt-3.5 pb-2 flex items-center justify-between shrink-0">
                    <span
                      style={{ color: 'var(--text-primary)' }}
                      className="text-[15px] font-medium tracking-tight"
                    >
                      {renderedSidebarView === 'search' ? 'Search' : 'Outline'}
                    </span>
                  </div>
                )}

                <div
                  className={`flex-1 min-h-0 overflow-hidden theme-scope ${
                    renderedSidebarView === 'explorer' ? 'explorer-clean' : ''
                  }`}
                >
                  {renderedSidebarView === 'explorer' ? (
                    <ExplorerSidebar
                      tree={tree}
                      files={files}
                      activeFile={activeFile}
                      onSelectFile={openFileInActivePane}
                      onCreateFile={handleCreateFile}
                      onCreateFolder={handleCreateFolder}
                      onRenameEntry={handleRenameEntry}
                      onImportCodeFiles={handleImportCodeFiles}
                      onImportAssets={handleImportAssets}
                      onExportBackup={handleExportBackup}
                      onImportBackup={handleImportBackup}
                      onDeleteEntry={handleDeleteEntry}
                      onRefresh={() => loadWorkspaceForMode(mode)}
                    />
                  ) : renderedSidebarView === 'search' ? (
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
                  ) : (
                    <OutlinePanel
                      file={activeFile}
                      currentLine={cursor.line}
                      onJumpToLine={(line) => {
                        activeEditorRef.current?.revealLineInCenter(line);
                        activeEditorRef.current?.setPosition({ lineNumber: line, column: 1 });
                        activeEditorRef.current?.focus();
                      }}
                    />
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* RESIZABLE SIDEBAR DIVIDER */}
        {sidebarView && breakpoint === 'desktop' && !zenMode && (
          <div
            onPointerDown={startResizeSidebar}
            title="Kéo trái / phải để chỉnh độ rộng Sidebar"
            className="w-1.5 -mx-1 cursor-col-resize touch-none flex items-center justify-center group shrink-0"
          >
            <span className="w-0.5 h-12 rounded-full bg-transparent group-hover:bg-[var(--accent-primary)] transition-colors" />
          </div>
        )}

        {/* RIGHT COLUMN: EDITOR (+ LIVE SERVER PREVIEW) ON TOP + TERMINAL AT BOTTOM */}
        <div className={`flex-1 min-w-0 min-h-0 flex flex-col ${uiDensity === 'compact' ? 'gap-1.5' : 'gap-2.5'}`}>
          {/* EDITOR CARD — BORDERLESS FLOATING PILL TABS (CONCENTRIC APPLE BENTO) */}
          <main className="flex-1 min-w-0 min-h-0 ide-card flex flex-col overflow-hidden">
            <div
              style={{ backgroundColor: 'var(--bg-panel)' }}
              className="h-11 px-2 flex items-center justify-between gap-2 shrink-0"
            >
              <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {openTabs.map((tab) => {
                  const isActive = activeFile?.path === tab.path;
                  return (
                    <div
                      key={tab.path}
                      onClick={() => openFileInActivePane(tab)}
                      style={{
                        backgroundColor: isActive ? 'var(--bg-panel-alt)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                      className={`group relative h-8 px-3 rounded-[10px] text-[12.5px] flex items-center gap-2 cursor-pointer shrink-0 transition-colors ${
                        isActive
                          ? 'font-semibold'
                          : 'font-normal opacity-80 hover:opacity-100 hover:bg-[var(--bg-panel-alt)]/55'
                      }`}
                    >
                      <FileTypeIcon fileName={tab.name} size={14} />
                      <span className="truncate max-w-[160px]">{tab.name}</span>
                      {tab.dirty && (
                        <span
                          style={{ backgroundColor: 'var(--accent-primary)' }}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                        />
                      )}
                      <button
                        onClick={(e) => closeTab(tab.path, e)}
                        className={`p-0.5 rounded-md transition-opacity ${
                          isActive ? 'opacity-65 hover:opacity-100' : 'opacity-0 group-hover:opacity-75 hover:!opacity-100'
                        } hover:bg-[var(--bg-elevated)]`}
                      >
                        <X size={12.5} />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={handleQuickNewFile}
                  style={{ color: 'var(--text-secondary)' }}
                  className="w-7 h-7 rounded-lg hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center shrink-0 ml-0.5"
                  title="Tạo nhanh tệp mới"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {activeBreadcrumbSymbol && (
                  <button
                    type="button"
                    onClick={() => setSidebarView('outline')}
                    style={{
                      backgroundColor: 'var(--bg-panel-alt)',
                      color: 'var(--text-secondary)'
                    }}
                    className="hidden lg:inline-flex h-7 px-2.5 rounded-lg text-[11px] font-mono items-center gap-1 hover:text-[var(--text-primary)] transition-colors mr-0.5"
                    title="Vị trí hàm hiện tại (bấm mở Outline)"
                  >
                    <span>{activeBreadcrumbSymbol.name}</span>
                  </button>
                )}

                {showLiveServerBtn && (
                  <button
                    onClick={handleToggleLiveServer}
                    style={{
                      backgroundColor: livePreviewOpen ? 'var(--bg-active)' : 'transparent',
                      color: livePreviewOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)] transition-colors"
                    title="Bật / Tắt Live Server xem trước web theo thời gian thực"
                  >
                    <Radio
                      size={12}
                      className={livePreviewOpen ? 'animate-pulse' : 'text-emerald-500'}
                    />
                    <span>{livePreviewOpen ? 'Port :5500' : 'Go Live'}</span>
                  </button>
                )}

                <button
                  onClick={handleFormat}
                  style={{ color: 'var(--text-secondary)' }}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)] transition-colors"
                  title="Định dạng mã nguồn"
                >
                  <Wand2 size={13} />
                  <span className="hidden xl:inline">Format</span>
                </button>
              </div>
            </div>

            <div
              ref={splitContainerRef}
              className={`flex-1 min-h-0 min-w-0 flex ${splitDirection}`}
            >
              <div
                onClick={() => setActivePane('primary')}
                style={splitOpen ? { flexBasis: `${splitRatio}%`, flexGrow: 0, flexShrink: 0 } : undefined}
                className={`${splitOpen ? '' : 'flex-1'} min-w-0 min-h-0 flex flex-col relative ${
                  splitOpen && activePane === 'primary' ? 'ring-2 ring-inset ring-[var(--accent-primary)]/40 rounded-b-2xl' : ''
                }`}
              >
                {splitOpen && (
                  <div className="h-8 px-3 bg-[var(--bg-panel-alt)] flex items-center justify-between text-[11px]">
                    <CustomSelect
                      value={primaryPath || ''}
                      onChange={(val) => {
                        flushLiveContent();
                        setPrimaryPath(val);
                      }}
                      size="xs"
                      variant="ghost"
                      align="left"
                      className="max-w-[85%]"
                      options={files.map((f) => ({ value: f.path, label: f.path }))}
                    />
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
                  onSelectionChange={(sel) => {
                    if (activePane === 'primary') setEditorSelection(sel);
                  }}
                  onChangeFontSize={(sz) => setEditorSettings((prev) => ({ ...prev, fontSize: sz }))}
                  onQuickCreateTemplate={handleCreateTemplateFile}
                  onQuickCreateWebProject={handleCreateWebStarterProject}
                />
              </div>

              {livePreviewOpen && !splitOpen && (
                <div
                  style={{ borderColor: 'var(--bg-elevated)' }}
                  className="flex-1 min-w-0 min-h-0 flex flex-col border-t md:border-t-0 md:border-l"
                >
                  <Suspense fallback={null}>
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
                  </Suspense>
                </div>
              )}

              {splitOpen && (
                <>
                  {/* RESIZABLE SPLIT EDITOR HANDLE */}
                  <div
                    onPointerDown={(e) => startResizeSplit(e, splitIsVertical)}
                    title="Kéo để thay đổi tỷ lệ Split Editor"
                    style={{ backgroundColor: 'var(--border-subtle)' }}
                    className={`${
                      splitIsVertical
                        ? 'h-2 w-full cursor-row-resize'
                        : 'w-2 h-full cursor-col-resize'
                    } touch-none flex items-center justify-center group shrink-0 hover:bg-[var(--accent-primary)]/40 transition-colors`}
                  >
                    <span
                      className={`${
                        splitIsVertical ? 'w-10 h-0.5' : 'w-0.5 h-10'
                      } rounded-full bg-[var(--text-secondary)]/40 group-hover:bg-[var(--accent-primary)] transition-colors`}
                    />
                  </div>

                  <div
                    onClick={() => setActivePane('secondary')}
                    className={`flex-1 min-w-0 min-h-0 flex flex-col relative ${
                      activePane === 'secondary' ? 'ring-2 ring-inset ring-[var(--accent-primary)]/40 rounded-b-2xl' : ''
                    }`}
                  >
                    <div className="h-8 px-3 bg-[var(--bg-panel-alt)] flex items-center justify-between text-[11px]">
                      <CustomSelect
                        value={secondaryPath || ''}
                        onChange={(val) => {
                          flushLiveContent();
                          setSecondaryPath(val);
                        }}
                        size="xs"
                        variant="ghost"
                        align="left"
                        className="max-w-[80%]"
                        options={files.map((f) => ({ value: f.path, label: f.path }))}
                      />
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
                      onSelectionChange={(sel) => {
                        if (activePane === 'secondary') setEditorSelection(sel);
                      }}
                      onChangeFontSize={(sz) => setEditorSettings((prev) => ({ ...prev, fontSize: sz }))}
                      onQuickCreateTemplate={handleCreateTemplateFile}
                      onQuickCreateWebProject={handleCreateWebStarterProject}
                    />
                  </div>
                </>
              )}
            </div>

            {(breakpoint === 'tablet' || isTouchDevice) &&
              isKeyboardOpen &&
              !editorSettings.hardwareKeyboardMode && (
              <div className="theme-scope">
                <MobileCodingToolbar
                  language={mobileToolbarLang}
                  onInsertToken={handleInsertToken}
                  onUndo={handleEditorUndo}
                  onRedo={handleEditorRedo}
                  onMoveCursor={handleMoveCursor}
                />
              </div>
            )}
          </main>

          {/* INVISIBLE HOVER-ONLY RESIZE HANDLE IN GAP BETWEEN EDITOR & CONSOLE */}
          {breakpoint === 'desktop' && !zenMode && bottomOpen && consoleDock === 'bottom' && (
            <div
              onPointerDown={startResizeBottom}
              title="Kéo lên / xuống để chỉnh chiều cao Console"
              className="h-1.5 -my-1 cursor-row-resize touch-none flex items-center justify-center group shrink-0 z-10"
            >
              <span className="w-12 h-0.5 rounded-full bg-transparent group-hover:bg-[var(--accent-primary)] transition-colors" />
            </div>
          )}

          {/* BOTTOM TERMINAL / CONSOLE CARD — 2-WAY LIQUID-GLASS SPRING EXPAND/COLLAPSE */}
          {breakpoint === 'desktop' && !zenMode && (
            <div
              style={{
                height: bottomOpen && consoleDock === 'bottom' ? `${bottomHeight}px` : '0px',
                marginTop:
                  bottomOpen && consoleDock === 'bottom'
                    ? '0px'
                    : uiDensity === 'compact'
                      ? '-6px'
                      : '-10px',
                transition: isResizingBottom
                  ? 'none'
                  : 'height 0.38s cubic-bezier(0.22, 1, 0.36, 1), margin-top 0.38s cubic-bezier(0.22, 1, 0.36, 1)'
              }}
              className={`w-full shrink-0 overflow-hidden ${
                bottomOpen && consoleDock === 'bottom' ? '' : 'pointer-events-none'
              }`}
            >
              <section
                style={{
                  height: `${bottomHeight}px`,
                  opacity: bottomOpen && consoleDock === 'bottom' ? 1 : 0,
                  transform:
                    bottomOpen && consoleDock === 'bottom'
                      ? 'translate3d(0, 0, 0) scale(1)'
                      : 'translate3d(0, 20px, 0) scale(0.96)',
                  filter: bottomOpen && consoleDock === 'bottom' ? 'blur(0px)' : 'blur(3px)',
                  transformOrigin: 'center bottom',
                  transition: isResizingBottom
                    ? 'none'
                    : 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.26s ease'
                }}
                className="w-full ide-card flex flex-col overflow-hidden relative"
              >
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <BottomPanel
                    mode={mode}
                    logs={logs}
                    diagnostics={allDiagnostics}
                    isRunning={isRunning}
                    lastElapsedMs={lastElapsedMs}
                    stdinPreset={stdinPreset}
                    autoEof={autoEof}
                    testCases={activeTestCases}
                    testResults={activeTestResults}
                    isRunningTests={isRunningTests}
                    onChangeTestCases={handleChangeActiveTestCases}
                    onRunAllTests={handleRunAllTests}
                    onRunSingleTest={handleRunSingleTest}
                    onChangeStdinPreset={setStdinPreset}
                    onChangeAutoEof={setAutoEof}
                    onRunWithInput={handleRun}
                    onSendStdin={handleSendStdin}
                    onSendEof={handleSendEof}
                    isWaitingForInput={isWaitingForInput}
                    hideVirtualKeyboard={Boolean(editorSettings.hardwareKeyboardMode)}
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
                    dockPosition={consoleDock}
                    onToggleDockPosition={handleToggleConsoleDock}
                    requestedTab={requestedConsoleTab}
                    onAskAiError={aiSettings.showDockButton ? handleAskAiAboutError : undefined}
                  />
                </div>
              </section>
            </div>
          )}
        </div>

        {/* IPAD PRO RIGHT UTILITY PANEL — 2-WAY LIQUID-GLASS SPRING EXPAND/COLLAPSE */}
        {showRightPanel && (
          <div
            onPointerDown={startResizeRightPanel}
            title="Kéo trái / phải để chỉnh độ rộng khung bên phải"
            className="w-1.5 -mx-1 cursor-col-resize touch-none flex items-center justify-center group shrink-0"
          >
            <span className="w-0.5 h-12 rounded-full bg-transparent group-hover:bg-[var(--accent-primary)] transition-colors" />
          </div>
        )}

        {!zenMode && (
          <div
            style={{
              width: showRightPanel
                ? `${Math.min(rightPanelWidth, Math.max(280, width - 320))}px`
                : '0px',
              marginLeft: showRightPanel ? '0px' : uiDensity === 'compact' ? '-6px' : '-10px',
              transition: isResizingRightPanel
                ? 'none'
                : 'width 0.38s cubic-bezier(0.22, 1, 0.36, 1), margin-left 0.38s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
            className={`shrink-0 h-full flex justify-end overflow-hidden ${
              showRightPanel ? '' : 'pointer-events-none'
            }`}
          >
            <aside
              style={{
                width: `${Math.min(rightPanelWidth, Math.max(280, width - 320))}px`,
                opacity: showRightPanel ? 1 : 0,
                transform: showRightPanel
                  ? 'translate3d(0, 0, 0) scale(1)'
                  : 'translate3d(24px, 0, 0) scale(0.96)',
                filter: showRightPanel ? 'blur(0px)' : 'blur(3px)',
                transformOrigin: 'right center',
                transition: isResizingRightPanel
                  ? 'none'
                  : 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.26s ease'
              }}
              className="shrink-0 h-full ide-card flex flex-col overflow-hidden"
            >
              <div
                key={renderedRightKind}
                className="flex-1 min-h-0 flex flex-col overflow-hidden right-panel-swap"
              >
                {renderedRightKind === 'scratchpad' ? (
                  scratchpadMounted ? (
                    <Suspense fallback={null}>
                      <PencilScratchpad
                        projectKey={projectKey}
                        onClose={() => setIpadRightTool(null)}
                        onExportToast={(msg) => showToast(msg, 'success')}
                        onAskAiWithSketch={
                          aiSettings.showDockButton ? handleSendScratchpadToAi : undefined
                        }
                      />
                    </Suspense>
                  ) : null
                ) : renderedRightKind === 'notes' ? (
                  notesMounted ? (
                    <Suspense fallback={null}>
                      <ProblemNotesPane
                        projectKey={projectKey}
                        onSendSampleToTests={handleSendSampleToTests}
                        onClose={() => setIpadRightTool(null)}
                      />
                    </Suspense>
                  ) : null
                ) : renderedRightKind === 'ai' ? (
                  aiMounted ? (
                    <Suspense fallback={null}>
                      <AiAssistantPane
                        activeFile={activeFile}
                        activeCode={
                          activeFile
                            ? (liveContentMapRef.current[activeFile.path] ?? activeFile.content)
                            : ''
                        }
                        codeSelection={editorSelection}
                        projectKey={projectKey}
                        logs={logs}
                        diagnostics={allDiagnostics}
                        settings={aiSettings}
                        onUpdateSettings={handleUpdateAiSettings}
                        onApplyCodeToFile={handleApplyAiCode}
                        onInsertCodeAtCursor={handleInsertAiCode}
                        onOpenDiffViewer={() => setDiffOpen(true)}
                        onClose={() => setIpadRightTool(null)}
                        autoPrompt={aiAutoPrompt}
                        onConsumeAutoPrompt={(id) =>
                          setAiAutoPrompt((cur) => (cur?.id === id ? null : cur))
                        }
                      />
                    </Suspense>
                  ) : null
                ) : (
                  <BottomPanel
                    mode={mode}
                    logs={logs}
                    diagnostics={allDiagnostics}
                    isRunning={isRunning}
                    lastElapsedMs={lastElapsedMs}
                    stdinPreset={stdinPreset}
                    autoEof={autoEof}
                    testCases={activeTestCases}
                    testResults={activeTestResults}
                    isRunningTests={isRunningTests}
                    onChangeTestCases={handleChangeActiveTestCases}
                    onRunAllTests={handleRunAllTests}
                    onRunSingleTest={handleRunSingleTest}
                    onChangeStdinPreset={setStdinPreset}
                    onChangeAutoEof={setAutoEof}
                    onRunWithInput={handleRun}
                    onSendStdin={handleSendStdin}
                    onSendEof={handleSendEof}
                    isWaitingForInput={isWaitingForInput}
                    hideVirtualKeyboard={Boolean(editorSettings.hardwareKeyboardMode)}
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
                    dockPosition={consoleDock}
                    onToggleDockPosition={handleToggleConsoleDock}
                    requestedTab={requestedConsoleTab}
                    onAskAiError={aiSettings.showDockButton ? handleAskAiAboutError : undefined}
                  />
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* QUIET FRAMELESS STATUS BAR */}
      {!zenMode && (
        <div className="shrink-0 relative z-10 rounded-xl overflow-hidden opacity-90">
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
            onOpenShortcutsHud={() => {
              setShortcutsHudHoldMode(false);
              setShortcutsHudOpen(true);
            }}
          />
        </div>
      )}

      {/* TABLET OVERLAY DRAWER — ĐẶT NGOÀI STACKING CONTEXT (z-50 + SAFE AREA CHỐNG ĐÈ HEADER/NOTCH) */}
      {tabletDrawerMounted && breakpoint === 'tablet' && (
        <div
          style={{
            opacity: tabletDrawerVisible ? 1 : 0,
            transition: 'opacity 0.28s var(--ease-ios-out)',
            paddingTop: 'max(12px, env(safe-area-inset-top))',
            paddingRight: 'max(12px, env(safe-area-inset-right))',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))'
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex"
          onClick={() => setSidebarView(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              opacity: tabletDrawerVisible ? 1 : 0,
              transform: tabletDrawerVisible
                ? 'translate3d(0, 0, 0) scale(1)'
                : 'translate3d(-104%, 0, 0) scale(0.96)',
              filter: tabletDrawerVisible ? 'blur(0px)' : 'blur(3px)',
              transition:
                'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.26s ease'
            }}
            className="h-full w-80 max-w-[85vw] ide-card flex flex-col overflow-hidden"
          >
            <div
              key={renderedSidebarView}
              className="flex-1 min-h-0 flex flex-col overflow-hidden sidebar-view-swap"
            >
              {renderedSidebarView !== 'explorer' && (
                <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between shrink-0">
                  <span
                    style={{ color: 'var(--text-primary)' }}
                    className="text-[15px] font-semibold tracking-tight"
                  >
                    {renderedSidebarView === 'search' ? 'Search' : 'Outline'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSidebarView(null)}
                    style={{ color: 'var(--text-secondary)' }}
                    className="w-7 h-7 rounded-lg hover:bg-[var(--bg-elevated)] flex items-center justify-center"
                    title="Đóng"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              <div
                className={`flex-1 min-h-0 overflow-hidden theme-scope ${
                  renderedSidebarView === 'explorer' ? 'explorer-clean' : ''
                }`}
              >
                {renderedSidebarView === 'explorer' ? (
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
                    onRenameEntry={handleRenameEntry}
                    onImportCodeFiles={handleImportCodeFiles}
                    onImportAssets={handleImportAssets}
                    onExportBackup={handleExportBackup}
                    onImportBackup={handleImportBackup}
                    onDeleteEntry={handleDeleteEntry}
                    onRefresh={() => loadWorkspaceForMode(mode)}
                    onCloseMobile={() => setSidebarView(null)}
                    isOverlay
                  />
                ) : renderedSidebarView === 'search' ? (
                  <SearchSidebar
                    files={files}
                    onJump={(f, line, col) => {
                      openFileInActivePane(f);
                      setSidebarView(null);
                      setTimeout(() => {
                        activeEditorRef.current?.revealLineInCenter(line);
                        activeEditorRef.current?.setPosition({ lineNumber: line, column: col });
                        activeEditorRef.current?.focus();
                      }, 40);
                    }}
                  />
                ) : (
                  <OutlinePanel
                    file={activeFile}
                    currentLine={cursor.line}
                    onJumpToLine={(line) => {
                      setSidebarView(null);
                      setTimeout(() => {
                        activeEditorRef.current?.revealLineInCenter(line);
                        activeEditorRef.current?.setPosition({ lineNumber: line, column: 1 });
                        activeEditorRef.current?.focus();
                      }, 40);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLET CONSOLE SHEET — ĐẶT NGOÀI STACKING CONTEXT (z-50 + SAFE AREA KHÔNG BỊ STATUS BAR & NOTCH CHE) */}
      {bottomOpen && breakpoint === 'tablet' && !showRightConsoleDock && (
        <div
          style={{
            paddingTop: 'max(12px, env(safe-area-inset-top))',
            paddingRight: 'max(12px, env(safe-area-inset-right))',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))'
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col justify-end ios-backdrop-enter"
          onClick={() => setBottomOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: sheetDragY > 0 ? `translate3d(0, ${sheetDragY}px, 0)` : undefined,
              animation: sheetDragY > 0 || sheetDragStartRef.current !== null ? 'none' : undefined,
              transition: sheetDragStartRef.current === null ? 'transform 0.3s var(--ease-ios-spring)' : 'none'
            }}
            className="w-full max-h-full ide-card overflow-hidden theme-scope ios-sheet-enter flex flex-col"
          >
            <div
              onPointerDown={handleTerminalSheetDragStart}
              onPointerMove={handleTerminalSheetDragMove}
              onPointerUp={() => handleTerminalSheetDragEnd(() => setBottomOpen(false))}
              onPointerCancel={() => handleTerminalSheetDragEnd(() => setBottomOpen(false))}
              className="pt-2.5 pb-1.5 flex justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing"
              title="Vuốt xuống để đóng"
            >
              <span className="w-10 h-1 rounded-full opacity-40" style={{ backgroundColor: 'var(--text-secondary)' }} />
            </div>
            <BottomPanel
              mode={mode}
              logs={logs}
              diagnostics={allDiagnostics}
              isRunning={isRunning}
              stdinPreset={stdinPreset}
              autoEof={autoEof}
              testCases={activeTestCases}
              testResults={activeTestResults}
              isRunningTests={isRunningTests}
              onChangeTestCases={handleChangeActiveTestCases}
              onRunAllTests={handleRunAllTests}
              onRunSingleTest={handleRunSingleTest}
              onChangeStdinPreset={setStdinPreset}
              onChangeAutoEof={setAutoEof}
              onRunWithInput={handleRun}
              onSendStdin={handleSendStdin}
              onSendEof={handleSendEof}
              isWaitingForInput={isWaitingForInput}
              hideVirtualKeyboard={Boolean(editorSettings.hardwareKeyboardMode)}
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
              requestedTab={requestedConsoleTab}
              isSheet
            />
          </div>
        </div>
      )}

      {/* IPAD VIRTUAL TRACKPAD OVERLAY */}
      {trackpadMounted && (
        <Suspense fallback={null}>
          <VirtualTrackpad
            open={trackpadOpen}
            onMoveCursor={handleTrackpadMove}
            onSelectLine={handleTrackpadSelectLine}
            onSelectBlock={handleTrackpadSelectBlock}
            onJumpLineEdge={handleTrackpadJumpEdge}
            onClose={() => setTrackpadOpen(false)}
          />
        </Suspense>
      )}

      {/* SIDE-BY-SIDE DIFF VIEWER MODAL */}
      {diffMounted && (
        <Suspense fallback={null}>
          <DiffViewerModal
            open={diffOpen}
            files={liveFiles}
            activeFile={activeFile}
            snapshots={fileSnapshots}
            monacoTheme={currentThemeObj.monacoTheme}
            fontSize={editorSettings.fontSize}
            onSaveSnapshot={handleSaveDiffSnapshot}
            onClose={() => setDiffOpen(false)}
          />
        </Suspense>
      )}

      {/* MAGIC KEYBOARD HOLD-⌘ SHORTCUTS HUD */}
      {shortcutsHudMounted && (
        <Suspense fallback={null}>
          <KeyboardShortcutsHud
            open={shortcutsHudOpen}
            isHoldMode={shortcutsHudHoldMode}
            onClose={() => {
              setShortcutsHudOpen(false);
              setShortcutsHudHoldMode(false);
            }}
          />
        </Suspense>
      )}

      {/* IPADOS SPLIT VIEW DRAG & DROP OVERLAY */}
      <DropZoneOverlay visible={isDragOverWorkspace} />

      {settingsOpen && (
        <Suspense fallback={null}>
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
            onChangeUiTheme={handleChangeUiTheme}
            uiDensity={uiDensity}
            onChangeUiDensity={setUiDensity}
            typingSound={typingSound}
            onChangeTypingSound={setTypingSound}
            hapticsEnabled={hapticsEnabled}
            onChangeHapticsEnabled={handleChangeHapticsEnabled}
            onSyncDeviceFiles={handleSyncDeviceFiles}
            isSyncingFiles={isSyncingFiles}
            onPreloadOfflineCpp={handlePreloadOfflineCpp}
            offlineCppState={offlineCppState}
            offlineCppPercent={offlineCppPercent}
            visualPrefs={visualPrefs}
            onUpdateVisualPrefs={handleUpdateVisualPrefs}
            aiSettings={aiSettings}
            onUpdateAiSettings={handleUpdateAiSettings}
          />
        </Suspense>
      )}

      {renderCommandPalette}

      <FloatingToast
        toast={toast}
        isRunning={isRunning || isRunningTests}
        runningLabel={runningIslandLabel}
        celebrateKey={celebrateKey}
      />
      </div>
    </>
  );
}