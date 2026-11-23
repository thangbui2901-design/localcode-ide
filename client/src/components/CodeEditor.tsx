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
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: false
    });
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  } catch {
    // Bỏ qua nếu worker chưa sẵn sàng
  }

  monaco.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const snippets: Array<{ label: string; insertText: string; detail: string }> = [
        {
          label: 'cppmain',
          detail: 'Khung chương trình C++ chuẩn',
          insertText: [
            '#include <iostream>',
            'using namespace std;',
            '',
            'int main() {',
            '    ios::sync_with_stdio(false);',
            '    cin.tie(nullptr);',
            '    ${1}',
            '    return 0;',
            '}'
          ].join('\n')
        },
        {
          label: 'bits',
          detail: '#include <bits/stdc++.h>',
          insertText: '#include <bits/stdc++.h>\nusing namespace std;\n'
        },
        {
          label: 'fori',
          detail: 'Vòng lặp for (int i = 0; i < n; ++i)',
          insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3}\n}'
        },
        {
          label: 'cout',
          detail: 'In ra màn hình với cout',
          insertText: 'cout << ${1} << "\\n";'
        },
        {
          label: 'cin',
          detail: 'Nhập dữ liệu với cin',
          insertText: 'cin >> ${1};'
        }
      ];

      return {
        suggestions: snippets.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: s.detail,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range
        }))
      };
    }
  });
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
  onQuickCreateTemplate,
  onQuickCreateWebProject
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const suppressChangeRef = useRef(false);
  const isAutoClosingTagRef = useRef(false);
  const [copiedSnippet, setCopiedSnippet] = useState<'html' | 'css' | null>(null);

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
      fontFamily: settings.fontFamily,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: breakpoint === 'desktop' && settings.minimap },
      lineNumbers: settings.lineNumbers,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 12, bottom: 16 },
      quickSuggestions: settings.quickSuggestions
        ? { other: 'on', comments: 'off', strings: 'on' }
        : false,
      suggestOnTriggerCharacters: settings.suggestOnTriggerCharacters,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      snippetSuggestions: 'top',
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

    const focusSub = editor.onDidFocusEditorWidget(() => {
      onFocusRef.current?.();
    });

    return () => {
      changeSub.dispose();
      cursorSub.dispose();
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
      fontFamily: settings.fontFamily,
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

  return <div ref={containerRef} className="flex-1 min-h-0 min-w-0 w-full h-full" />;
};