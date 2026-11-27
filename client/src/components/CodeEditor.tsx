import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { emmetHTML, emmetCSS } from 'emmet-monaco-es';
import {
  FilePlus2,
  Sparkles,
  Play,
  Save,
  Terminal,
  Globe,
  Copy,
  Check,
  Image as ImageIcon,
  FolderPlus
} from 'lucide-react';
import { EditorSettings, SupportedLanguage, WorkspaceFile } from '../types/ide';

export interface EditorCodeSelection {
  filePath: string;
  fileName: string;
  text: string;
  startLine: number;
  endLine: number;
}

interface CodeEditorProps {
  file: WorkspaceFile | null;
  settings: EditorSettings;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  editorRef?: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  typingSound?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onRun: () => void;
  onFocusEditor?: () => void;
  onCursorChange?: (line: number, column: number) => void;
  onSelectionChange?: (selection: EditorCodeSelection | null) => void;
  onChangeFontSize?: (nextSize: number) => void;
  onQuickCreateTemplate?: (fileName: string, content: string) => void;
  onQuickCreateWebProject?: () => void;
}

const HTML_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

let extensionsInitialized = false;

function ensureMonacoWebAndCppSupport() {
  if (extensionsInitialized) return;
  extensionsInitialized = true;

  try {
    emmetHTML(monaco, ['html']);
    emmetCSS(monaco, ['css']);
  } catch {
    // Bỏ qua nếu đã đăng ký
  }

  try {
    const tsLang = (monaco.languages as unknown as {
      typescript?: typeof monaco.languages.typescript;
    }).typescript;
    if (tsLang?.javascriptDefaults) {
      tsLang.javascriptDefaults.setCompilerOptions({
        target: tsLang.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: false
      });
      tsLang.javascriptDefaults.setEagerModelSync(true);
    }
  } catch {
    // Bỏ qua nếu worker chưa sẵn sàng
  }
}

function mapToMonacoLanguage(lang: SupportedLanguage): string {
  switch (lang) {
    case 'c':
      return 'c';
    case 'python':
      return 'python';
    case 'markdown':
      return 'markdown';
    case 'plaintext':
      return 'plaintext';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'javascript':
      return 'javascript';
    case 'json':
      return 'json';
    default:
      return 'cpp';
  }
}

let sharedAudioCtx: AudioContext | null = null;

function playSoftKeyClick() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }

    const now = sharedAudioCtx.currentTime;
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + Math.random() * 90, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.028);
  } catch {
    // Bỏ qua nếu trình duyệt chặn audio trước tương tác
  }
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  settings,
  breakpoint,
  editorRef,
  typingSound = true,
  onChange,
  onSave,
  onRun,
  onFocusEditor,
  onCursorChange,
  onSelectionChange,
  onChangeFontSize,
  onQuickCreateTemplate,
  onQuickCreateWebProject
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const suppressChangeRef = useRef(false);
  const isAutoClosingTagRef = useRef(false);
  const [copiedSnippet, setCopiedSnippet] = useState<'html' | 'css' | null>(null);
  const [zoomHudSize, setZoomHudSize] = useState<number | null>(null);
  const pinchRef = useRef<{ startDist: number; startSize: number } | null>(null);
  const zoomHudTimerRef = useRef<number | null>(null);

  const triggerZoomHud = (nextSize: number) => {
    setZoomHudSize(nextSize);
    if (zoomHudTimerRef.current) window.clearTimeout(zoomHudTimerRef.current);
    zoomHudTimerRef.current = window.setTimeout(() => setZoomHudSize(null), 750);
  };

  const handleTouchStartPinch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && onChangeFontSize) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        startDist: Math.hypot(dx, dy),
        startSize: settings.fontSize
      };
    }
  };

  const handleTouchMovePinch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !pinchRef.current || !onChangeFontSize) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / Math.max(20, pinchRef.current.startDist);
    const nextSize = Math.max(11, Math.min(28, Math.round(pinchRef.current.startSize * ratio)));
    if (nextSize !== settings.fontSize) {
      onChangeFontSize(nextSize);
      triggerZoomHud(nextSize);
    }
  };

  const handleTouchEndPinch = () => {
    pinchRef.current = null;
  };

  const applyVirtualKeyboardPolicy = (suppressSoftKeyboard: boolean, dismissIfFocused = false) => {
    const dom = instanceRef.current?.getDomNode();
    if (!dom) return;
    const textareas = dom.querySelectorAll<HTMLTextAreaElement>('textarea.inputarea, textarea');
    textareas.forEach((ta) => {
      if (suppressSoftKeyboard) {
        ta.setAttribute('inputmode', 'none');
        ta.inputMode = 'none';
        ta.setAttribute('virtualkeyboardpolicy', 'manual');
        if (dismissIfFocused && document.activeElement === ta) {
          ta.blur();
          window.requestAnimationFrame(() => {
            ta.focus({ preventScroll: true });
          });
        }
      } else {
        ta.removeAttribute('inputmode');
        ta.removeAttribute('virtualkeyboardpolicy');
      }
    });
  };

  // Tự động đồng bộ chế độ Bàn phím rời (ẩn phím ảo iPad) lên textarea ẩn của Monaco
  useEffect(() => {
    const hide = Boolean(settings.hardwareKeyboardMode);
    applyVirtualKeyboardPolicy(hide, hide);
  }, [settings.hardwareKeyboardMode, file?.path]);

  // Chạm bằng chuột / trackpad rời trên iPad tự động giữ ẩn bàn phím ảo;
  // chạm ngón tay chỉ bật bàn phím ảo khi KHÔNG bật chế độ Bàn phím rời
  const handleEditorPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    const hide = Boolean(settings.hardwareKeyboardMode) || e.pointerType === 'mouse';
    applyVirtualKeyboardPolicy(hide, false);
  };

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  const onFocusRef = useRef(onFocusEditor);
  onFocusRef.current = onFocusEditor;

  const onCursorRef = useRef(onCursorChange);
  onCursorRef.current = onCursorChange;

  const onSelectionRef = useRef(onSelectionChange);
  onSelectionRef.current = onSelectionChange;

  const fileMetaRef = useRef<{ path: string; name: string } | null>(null);
  fileMetaRef.current = file ? { path: file.path, name: file.name } : null;

  const typingSoundRef = useRef(typingSound);
  typingSoundRef.current = typingSound;

  const isAssetFile = Boolean(file && (file.language === 'asset' || file.content.startsWith('data:')));
  const isCodeFile = Boolean(file && !isAssetFile);

  useEffect(() => {
    if (!isCodeFile || !file || !containerRef.current) return;

    ensureMonacoWebAndCppSupport();

    const editor = monaco.editor.create(containerRef.current, {
      value: file.content,
      language: mapToMonacoLanguage(file.language),
      theme: settings.theme || 'vs-dark-modern',
      fontSize: settings.fontSize,
      lineHeight: Math.round(settings.fontSize * 1.62),
      letterSpacing: 0.15,
      fontFamily: settings.fontFamily,
      fontLigatures: true,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: breakpoint === 'desktop' && settings.minimap },
      lineNumbers: settings.lineNumbers,
      lineNumbersMinChars: 3,
      glyphMargin: false,
      roundedSelection: true,
      renderLineHighlight: 'all',
      guides: {
        indentation: true,
        highlightActiveIndentation: true,
        bracketPairs: false
      },
      automaticLayout: true,
      fixedOverflowWidgets: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        verticalSliderSize: 5,
        horizontalSliderSize: 5,
        useShadows: false,
        alwaysConsumeMouseWheel: false
      },
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 14, bottom: 20 },
      quickSuggestions: settings.quickSuggestions
        ? { other: 'on', comments: 'off', strings: 'on' }
        : false,
      quickSuggestionsDelay: 40,
      suggestOnTriggerCharacters: settings.suggestOnTriggerCharacters,
      acceptSuggestionOnEnter: 'on',
      acceptSuggestionOnCommitCharacter: true,
      tabCompletion: 'on',
      wordBasedSuggestions: 'currentDocument',
      snippetSuggestions: 'inline',
      parameterHints: { enabled: true, cycle: true },
      suggest: {
        preview: true,
        filterGraceful: true,
        snippetsPreventQuickSuggestions: false,
        showIcons: true,
        showStatusBar: true,
        showKeywords: true,
        showSnippets: true,
        showFunctions: true,
        showMethods: true,
        showClasses: true,
        showVariables: true,
        showProperties: true
      },
      linkedEditing: true,
      colorDecorators: true,
      defaultColorDecorators: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnType: true,
      bracketPairColorization: { enabled: true }
    });

    instanceRef.current = editor;
    if (editorRef) editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current();
    });
    editor.addCommand(monaco.KeyCode.F5, () => {
      onRunRef.current();
    });

    const changeSub = editor.onDidChangeModelContent((e) => {
      if (suppressChangeRef.current) return;

      // Tự động đóng thẻ HTML khi vừa gõ dấu '>' (ví dụ: <div> -> <div></div>)
      if (
        !isAutoClosingTagRef.current &&
        e.changes.length === 1 &&
        e.changes[0].text === '>'
      ) {
        const model = editor.getModel();
        const pos = editor.getPosition();
        if (model && model.getLanguageId() === 'html' && pos) {
          const startLine = Math.max(1, pos.lineNumber - 8);
          const textBefore = model.getValueInRange({
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column
          });

          if (!/\/\s*>$/.test(textBefore)) {
            const openTagMatch = textBefore.match(/<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^<>]*)?>$/);
            if (openTagMatch) {
              const tagName = openTagMatch[1];
              if (!HTML_VOID_TAGS.has(tagName.toLowerCase())) {
                const lineAfter = model.getValueInRange({
                  startLineNumber: pos.lineNumber,
                  startColumn: pos.column,
                  endLineNumber: pos.lineNumber,
                  endColumn: model.getLineMaxColumn(pos.lineNumber)
                });
                if (!lineAfter.trimStart().toLowerCase().startsWith(`</${tagName.toLowerCase()}>`)) {
                  isAutoClosingTagRef.current = true;
                  try {
                    editor.executeEdits('html-auto-close-tag', [
                      {
                        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                        text: `</${tagName}>`,
                        forceMoveMarkers: false
                      }
                    ]);
                    editor.setPosition(pos);
                  } finally {
                    isAutoClosingTagRef.current = false;
                  }
                }
              }
            }
          }
        }
      }

      if (typingSoundRef.current && !isAutoClosingTagRef.current) {
        playSoftKeyClick();
      }
      onChangeRef.current(editor.getValue());
    });

    const cursorSub = editor.onDidChangeCursorPosition((e) => {
      onCursorRef.current?.(e.position.lineNumber, e.position.column);
    });

    let selectionTimer: number | null = null;
    let lastSelectionKey = '';
    const selectionSub = editor.onDidChangeCursorSelection((e) => {
      if (!onSelectionRef.current) return;
      const sel = e.selection;
      const isEmpty = sel.isEmpty();
      const key = isEmpty
        ? ''
        : `${sel.startLineNumber}:${sel.startColumn}-${sel.endLineNumber}:${sel.endColumn}`;
      if (key === lastSelectionKey) return;
      lastSelectionKey = key;

      if (selectionTimer) window.clearTimeout(selectionTimer);
      selectionTimer = window.setTimeout(() => {
        const cb = onSelectionRef.current;
        if (!cb) return;
        const model = editor.getModel();
        const meta = fileMetaRef.current;
        if (isEmpty || !model || !meta) {
          cb(null);
          return;
        }
        const selectedText = model.getValueInRange(sel);
        if (!selectedText.trim()) {
          cb(null);
          return;
        }
        cb({
          filePath: meta.path,
          fileName: meta.name,
          text: selectedText.slice(0, 8000),
          startLine: sel.startLineNumber,
          endLine: sel.endLineNumber
        });
      }, 120);
    });

    const focusSub = editor.onDidFocusEditorWidget(() => {
      onFocusRef.current?.();
    });

    return () => {
      if (selectionTimer) window.clearTimeout(selectionTimer);
      changeSub.dispose();
      cursorSub.dispose();
      selectionSub.dispose();
      focusSub.dispose();
      editor.dispose();
      instanceRef.current = null;
      if (editorRef) editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCodeFile]);

  useEffect(() => {
    const editor = instanceRef.current;
    if (!editor || !file || isAssetFile) return;

    const model = editor.getModel();
    const targetLang = mapToMonacoLanguage(file.language);
    if (model && model.getLanguageId() !== targetLang) {
      monaco.editor.setModelLanguage(model, targetLang);
    }

    if (editor.getValue() !== file.content) {
      suppressChangeRef.current = true;
      const pos = editor.getPosition();
      editor.setValue(file.content);
      if (pos) editor.setPosition(pos);
      suppressChangeRef.current = false;
    }
  }, [file?.path, file?.content, file?.language, isAssetFile]);

  useEffect(() => {
    const editor = instanceRef.current;
    if (!editor) return;

    editor.updateOptions({
      fontSize: settings.fontSize,
      lineHeight: Math.round(settings.fontSize * 1.62),
      fontFamily: settings.fontFamily,
      fontLigatures: true,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: breakpoint === 'desktop' && settings.minimap },
      lineNumbers: settings.lineNumbers,
      colorDecorators: true,
      defaultColorDecorators: true,
      quickSuggestions: settings.quickSuggestions
        ? { other: 'on', comments: 'off', strings: 'on' }
        : false,
      suggestOnTriggerCharacters: settings.suggestOnTriggerCharacters
    });
  }, [settings, breakpoint]);

  if (file && isAssetFile) {
    const isImage = file.content.startsWith('data:image/');
    const htmlTag = `<img src="./${file.path}" alt="${file.name}" />`;
    const cssUrl = `url("./${file.path}")`;
    const sizeKb = Math.max(1, Math.round((file.content.length * 0.75) / 1024));

    const copyText = (text: string, kind: 'html' | 'css') => {
      navigator.clipboard?.writeText(text);
      setCopiedSnippet(kind);
      window.setTimeout(() => setCopiedSnippet(null), 1500);
    };

    return (
      <div
        style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
        className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      >
        <div
          style={{ backgroundColor: 'var(--bg-panel-alt)', boxShadow: 'var(--shadow-card)' }}
          className="w-full max-w-md rounded-3xl p-5 space-y-4 tab-content-enter"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl accent-btn flex items-center justify-center shrink-0">
                <ImageIcon size={17} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{file.name}</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Tài nguyên cục bộ • ~{sizeKb} KB
                </p>
              </div>
            </div>
          </div>

          {isImage && (
            <div
              style={{ backgroundColor: 'var(--bg-elevated)' }}
              className="rounded-2xl p-4 flex items-center justify-center max-h-60 overflow-hidden"
            >
              <img
                src={file.content}
                alt={file.name}
                className="max-h-52 max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          )}

          <div className="space-y-2 text-xs">
            <div
              style={{ backgroundColor: 'var(--bg-elevated)' }}
              className="p-2.5 rounded-xl flex items-center justify-between gap-2"
            >
              <code className="font-mono text-[11px] truncate">{htmlTag}</code>
              <button
                type="button"
                onClick={() => copyText(htmlTag, 'html')}
                className="px-2.5 py-1 rounded-lg accent-btn text-[11px] font-semibold flex items-center gap-1 shrink-0 btn-lift"
              >
                {copiedSnippet === 'html' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSnippet === 'html' ? 'Đã chép' : 'HTML'}</span>
              </button>
            </div>

            <div
              style={{ backgroundColor: 'var(--bg-elevated)' }}
              className="p-2.5 rounded-xl flex items-center justify-between gap-2"
            >
              <code className="font-mono text-[11px] truncate">{cssUrl}</code>
              <button
                type="button"
                onClick={() => copyText(cssUrl, 'css')}
                style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 btn-lift"
              >
                {copiedSnippet === 'css' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSnippet === 'css' ? 'Đã chép' : 'CSS'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div
        style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
        className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 select-none overflow-y-auto"
      >
        <div
          style={{
            backgroundColor: 'var(--bg-panel-alt)',
            boxShadow: 'var(--shadow-card)'
          }}
          className="w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-5 tab-content-enter"
        >
          <div className="flex flex-col items-center text-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl accent-btn flex items-center justify-center shadow-md">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Chưa có tệp nào đang mở
              </h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Chọn tệp ở thanh bên trái hoặc khởi tạo nhanh mẫu C++, OOP hoặc Web Project
              </p>
            </div>
          </div>

          {onQuickCreateTemplate && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onQuickCreateTemplate(
                    `main_${Date.now().toString().slice(-3)}.cpp`,
                    `#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    cout << "Hello Code IDE!\\n";\n    return 0;\n}\n`
                  )
                }
                className="h-10 px-3 rounded-2xl accent-btn text-xs font-semibold flex items-center justify-center gap-1.5 btn-lift"
              >
                <FilePlus2 size={14} />
                <span>C++ Mẫu</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onQuickCreateTemplate(
                    `oop_${Date.now().toString().slice(-3)}.cpp`,
                    `#include <iostream>\n#include <string>\nusing namespace std;\n\nclass SinhVien {\nprivate:\n    string maSV;\n    string hoTen;\npublic:\n    void nhap() {\n        getline(cin, maSV);\n        getline(cin, hoTen);\n    }\n    void xuat() const {\n        cout << maSV << " - " << hoTen << "\\n";\n    }\n};\n\nint main() {\n    SinhVien sv;\n    sv.nhap();\n    sv.xuat();\n    return 0;\n}\n`
                  )
                }
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-10 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 btn-lift"
              >
                <FilePlus2 size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>Class OOP</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onQuickCreateTemplate(
                    `index_${Date.now().toString().slice(-3)}.html`,
                    `<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Live Server Demo</title>\n</head>\n<body>\n  <h1>Xin chào Live Server!</h1>\n  <script>\n    console.log("Web đã chạy!");\n  </script>\n</body>\n</html>\n`
                  )
                }
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-10 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 btn-lift"
              >
                <Globe size={14} className="text-emerald-500" />
                <span>HTML Đơn Lẻ</span>
              </button>

              {onQuickCreateWebProject && (
                <button
                  type="button"
                  onClick={onQuickCreateWebProject}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="h-10 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 btn-lift"
                >
                  <FolderPlus size={14} className="text-sky-400" />
                  <span>Web Starter (3 tệp)</span>
                </button>
              )}
            </div>
          )}

          <div
            style={{ backgroundColor: 'var(--bg-elevated)' }}
            className="p-3.5 rounded-2xl space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Play size={13} style={{ color: 'var(--accent-primary)' }} />
                <span>Chạy code / Bật Live Server</span>
              </span>
              <kbd
                style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                className="px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold"
              >
                Ctrl + Enter / F5
              </kbd>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Save size={13} style={{ color: 'var(--accent-primary)' }} />
                <span>Lưu tệp hiện tại</span>
              </span>
              <kbd
                style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                className="px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold"
              >
                Ctrl + S
              </kbd>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Terminal size={13} style={{ color: 'var(--accent-primary)' }} />
                <span>Gõ tắt Emmet HTML/CSS</span>
              </span>
              <kbd
                style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                className="px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold"
              >
                ! hoặc .box*3 + Tab
              </kbd>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onPointerDownCapture={handleEditorPointerDownCapture}
      onTouchStart={handleTouchStartPinch}
      onTouchMove={handleTouchMovePinch}
      onTouchEnd={handleTouchEndPinch}
      onTouchCancel={handleTouchEndPinch}
      className="flex-1 min-h-0 min-w-0 w-full h-full relative"
    >
      <div ref={containerRef} className="w-full h-full" />
      {zoomHudSize !== null && (
        <div
          style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)'
          }}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-4 py-2 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center gap-2 ios-popover-enter"
        >
          <span className="text-xs font-bold opacity-60">Aa</span>
          <span className="font-mono text-base font-extrabold" style={{ color: 'var(--accent-primary)' }}>
            {zoomHudSize}px
          </span>
        </div>
      )}
    </div>
  );
};