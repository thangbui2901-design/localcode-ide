import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import {
  GitCompare,
  ArrowLeftRight,
  Columns,
  AlignJustify,
  X,
  Camera
} from 'lucide-react';
import { SupportedLanguage, WorkspaceFile } from '../../types/ide';
import { CustomSelect } from '../CustomSelect';

interface DiffViewerModalProps {
  open: boolean;
  files: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  snapshots: Record<string, string>;
  monacoTheme: string;
  fontSize: number;
  onSaveSnapshot: (file: WorkspaceFile) => void;
  onClose: () => void;
}

function mapLang(lang?: SupportedLanguage): string {
  switch (lang) {
    case 'c':
      return 'c';
    case 'python':
      return 'python';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'javascript':
      return 'javascript';
    case 'json':
      return 'json';
    case 'markdown':
      return 'markdown';
    default:
      return 'cpp';
  }
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  open,
  files,
  activeFile,
  snapshots,
  monacoTheme,
  fontSize,
  onSaveSnapshot,
  onClose
}) => {
  const editableFiles = useMemo(() => files.filter((f) => f.language !== 'asset'), [files]);

  const [leftSource, setLeftSource] = useState<string>('__snapshot__');
  const [rightPath, setRightPath] = useState<string>('');
  const [sideBySide, setSideBySide] = useState<boolean>(true);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 280);
    return () => window.clearTimeout(t);
  }, [open]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const modelsRef = useRef<{
    original: monaco.editor.ITextModel | null;
    modified: monaco.editor.ITextModel | null;
  }>({ original: null, modified: null });

  // Sync default selections when opening
  useEffect(() => {
    if (!open) return;
    const current = activeFile && activeFile.language !== 'asset' ? activeFile : editableFiles[0];
    if (!current) return;
    setRightPath(current.path);
    const other = editableFiles.find((f) => f.path !== current.path);
    if (snapshots[current.path] !== undefined) {
      setLeftSource('__snapshot__');
    } else if (other) {
      setLeftSource(other.path);
    } else {
      setLeftSource('__snapshot__');
    }
  }, [open, activeFile?.path]);

  const rightFile = useMemo(
    () => editableFiles.find((f) => f.path === rightPath) || activeFile || editableFiles[0] || null,
    [editableFiles, rightPath, activeFile]
  );

  const leftContent = useMemo(() => {
    if (leftSource === '__snapshot__') {
      if (rightFile && snapshots[rightFile.path] !== undefined) {
        return snapshots[rightFile.path];
      }
      return rightFile?.content || '';
    }
    return editableFiles.find((f) => f.path === leftSource)?.content || '';
  }, [leftSource, rightFile, snapshots, editableFiles]);

  const rightContent = rightFile?.content || '';
  const lang = mapLang(rightFile?.language);

  useEffect(() => {
    if (!mounted || !hostRef.current) return;

    const diffEditor = monaco.editor.createDiffEditor(hostRef.current, {
      theme: monacoTheme,
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: sideBySide,
      renderOverviewRuler: false,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      fontSize,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      smoothScrolling: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        verticalSliderSize: 5,
        horizontalSliderSize: 5,
        useShadows: false,
        alwaysConsumeMouseWheel: false
      },
      padding: { top: 12, bottom: 12 }
    });
    diffEditorRef.current = diffEditor;

    const origModel = monaco.editor.createModel(leftContent, lang);
    const modModel = monaco.editor.createModel(rightContent, lang);
    modelsRef.current = { original: origModel, modified: modModel };
    diffEditor.setModel({ original: origModel, modified: modModel });

    return () => {
      diffEditor.setModel(null);
      origModel.dispose();
      modModel.dispose();
      diffEditor.dispose();
      diffEditorRef.current = null;
      modelsRef.current = { original: null, modified: null };
    };
  }, [mounted]);

  // Update models & options live without remounting
  useEffect(() => {
    const diffEditor = diffEditorRef.current;
    if (!diffEditor || !mounted) return;

    diffEditor.updateOptions({
      renderSideBySide: sideBySide,
      fontSize
    });
    monaco.editor.setTheme(monacoTheme);

    const prevOrig = modelsRef.current.original;
    const prevMod = modelsRef.current.modified;

    const nextOrig = monaco.editor.createModel(leftContent, lang);
    const nextMod = monaco.editor.createModel(rightContent, lang);
    modelsRef.current = { original: nextOrig, modified: nextMod };
    diffEditor.setModel({ original: nextOrig, modified: nextMod });

    prevOrig?.dispose();
    prevMod?.dispose();
  }, [leftContent, rightContent, lang, sideBySide, monacoTheme, fontSize, mounted]);

  if (!mounted) return null;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.26s var(--ease-ios-out)',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(12px, env(safe-area-inset-left))'
      }}
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center ${
        visible ? '' : 'pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          color: 'var(--text-primary)',
          opacity: visible ? 1 : 0,
          transform: visible
            ? 'translate3d(0, 0, 0) scale(1)'
            : 'translate3d(0, 20px, 0) scale(0.94)',
          filter: visible ? 'blur(0px)' : 'blur(3px)',
          transition:
            'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, filter 0.24s ease'
        }}
        className="w-full max-w-6xl h-[86vh] rounded-3xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--bg-panel-alt)',
            borderBottom: '1px solid var(--border-subtle)'
          }}
          className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0"
        >
          <div className="flex items-center gap-2">
            <GitCompare size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-bold">So sánh mã nguồn (Diff View)</span>
          </div>

          {/* File Pickers */}
          <div className="flex items-center gap-2 flex-1 justify-center min-w-[260px]">
            <CustomSelect
              value={leftSource}
              onChange={(val) => setLeftSource(val)}
              align="left"
              maxMenuWidth={280}
              className="max-w-[210px]"
              options={[
                {
                  value: '__snapshot__',
                  label: `Bản gốc đã chụp (${rightFile?.name || 'file'})`
                },
                ...editableFiles.map((f) => ({ value: f.path, label: f.path }))
              ]}
            />

            <button
              type="button"
              onClick={() => {
                if (leftSource !== '__snapshot__' && rightFile) {
                  const prevLeft = leftSource;
                  setLeftSource(rightFile.path);
                  setRightPath(prevLeft);
                }
              }}
              disabled={leftSource === '__snapshot__'}
              className="w-8 h-8 rounded-xl bg-[var(--bg-panel-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-35 flex items-center justify-center shrink-0 transition-colors"
              title="Đổi chỗ Trái ↔ Phải"
            >
              <ArrowLeftRight size={13} />
            </button>

            <CustomSelect
              value={rightFile?.path || ''}
              onChange={(val) => setRightPath(val)}
              align="left"
              maxMenuWidth={280}
              className="max-w-[210px]"
              options={editableFiles.map((f) => ({ value: f.path, label: f.path }))}
            />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {rightFile && (
              <button
                type="button"
                onClick={() => onSaveSnapshot(rightFile)}
                className="h-8 px-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-medium flex items-center gap-1.5"
                title="Chụp trạng thái hiện tại làm mốc so sánh"
              >
                <Camera size={13} style={{ color: 'var(--accent-primary)' }} />
                <span className="hidden md:inline">Chụp mốc</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSideBySide((v) => !v)}
              className="h-8 px-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-medium flex items-center gap-1.5"
              title="Chuyển chế độ Song song / Gộp dòng"
            >
              {sideBySide ? <Columns size={13} /> : <AlignJustify size={13} />}
              <span className="hidden md:inline">{sideBySide ? 'Song song' : 'Gộp dòng'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Monaco Diff Host */}
        <div ref={hostRef} className="flex-1 min-h-0 w-full" />
      </div>
    </div>
  );
};
