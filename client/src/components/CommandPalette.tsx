import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Home,
  Play,
  Wand2,
  Columns,
  PanelLeft,
  PanelBottom,
  Maximize2,
  Palette,
  FilePlus,
  Settings,
  Trash2,
  CornerDownLeft,
  X,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { SupportedLanguage, WorkspaceFile } from '../types/ide';
import { FileTypeIcon } from './FileTypeIcon';

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  onSelectFile: (file: WorkspaceFile) => void;
  commands: PaletteCommand[];
}

type SpotlightScope = 'all' | 'files' | 'commands';

type SpotlightItem =
  | {
      kind: 'file';
      id: string;
      title: string;
      dirPath: string;
      langLabel: string;
      sizeLabel: string;
      timeLabel: string;
      lineCount: number;
      file: WorkspaceFile;
    }
  | {
      kind: 'command';
      id: string;
      title: string;
      subtitle?: string;
      shortcut?: string;
      command: PaletteCommand;
    };

/* ==================== HELPERS ==================== */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(1, bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatRelativeTimeVi(timestamp?: number): string {
  if (!timestamp) return 'Gần đây';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
}

function getLangLabel(lang?: SupportedLanguage): string {
  switch (lang) {
    case 'cpp':
      return 'C++';
    case 'c':
      return 'C';
    case 'python':
      return 'Python';
    case 'javascript':
      return 'JavaScript';
    case 'html':
      return 'HTML';
    case 'css':
      return 'CSS';
    case 'json':
      return 'JSON';
    case 'markdown':
      return 'Markdown';
    default:
      return 'Văn bản';
  }
}

function formatShortcutTokens(shortcut: string, isApple: boolean): string[] {
  if (!shortcut) return [];
  if (isApple) {
    const parts: string[] = [];
    let rest = shortcut;
    for (const sym of ['⌃', '⌥', '⇧', '⌘']) {
      if (rest.includes(sym)) {
        parts.push(sym);
        rest = rest.replace(sym, '');
      }
    }
    const cleanRest = rest.replace(/^\+|\+$/g, '').trim();
    if (cleanRest) parts.push(cleanRest);
    return parts.length > 0 ? parts : [shortcut];
  }

  const parts: string[] = [];
  let rest = shortcut;
  if (rest.includes('⌘')) {
    parts.push('Ctrl');
    rest = rest.replace('⌘', '');
  }
  if (rest.includes('⌃')) {
    parts.push('Ctrl');
    rest = rest.replace('⌃', '');
  }
  if (rest.includes('⌥')) {
    parts.push('Alt');
    rest = rest.replace('⌥', '');
  }
  if (rest.includes('⇧')) {
    parts.push('Shift');
    rest = rest.replace('⇧', '');
  }
  const cleanRest = rest.replace(/^\+|\+$/g, '').trim();
  if (cleanRest) parts.push(cleanRest);
  return parts.length > 0 ? parts : [shortcut];
}

function highlightQuery(text: string, needle: string): React.ReactNode {
  if (!needle) return text;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span
        className="font-semibold"
        style={{
          color: 'var(--accent-primary)',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          textDecorationColor: 'color-mix(in srgb, var(--accent-primary) 45%, transparent)'
        }}
      >
        {text.slice(idx, idx + needle.length)}
      </span>
      {text.slice(idx + needle.length)}
    </>
  );
}

const PREVIEW_TOKEN_RE =
  /(\/\/.*$|\/\*.*?\*\/|<!--.*?-->|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<\/?[a-zA-Z][\w-]*|>|#include\b|#define\b|\b(?:int|long|double|float|char|bool|void|auto|const|struct|class|return|for|while|if|else|switch|using|namespace|std|def|import|from|as|elif|try|except|async|await|function|let|var|export|default|new|true|false|null|nullptr|printf|scanf|cin|cout|print|console)\b|-?\b\d+(?:\.\d+)?\b)/g;

function renderPreviewCodeLine(line: string): React.ReactNode {
  const trimmed = line.trimStart();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('<!--') ||
    trimmed.startsWith('# ')
  ) {
    return (
      <span className="italic opacity-45" style={{ color: 'var(--text-secondary)' }}>
        {line}
      </span>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  PREVIEW_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = PREVIEW_TOKEN_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('//') || token.startsWith('/*') || token.startsWith('<!--')) {
      parts.push(
        <span key={k++} className="italic opacity-45" style={{ color: 'var(--text-secondary)' }}>
          {token}
        </span>
      );
    } else if (token.startsWith('"') || token.startsWith("'")) {
      parts.push(
        <span key={k++} style={{ color: '#10b981' }}>
          {token}
        </span>
      );
    } else if (/^-?\d/.test(token)) {
      parts.push(
        <span key={k++} style={{ color: '#f59e0b' }}>
          {token}
        </span>
      );
    } else {
      parts.push(
        <span key={k++} style={{ color: 'var(--accent-primary)' }}>
          {token}
        </span>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts.length > 0 ? parts : line;
}

function getPreviewLines(file: WorkspaceFile, maxLines = 12): string[] {
  if (file.language === 'asset' || file.content.startsWith('data:')) return [];
  const raw = file.content.replace(/\r/g, '').split('\n');
  return raw.slice(0, maxLines).map((l) => {
    const clean = l.replace(/\t/g, '  ');
    return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
  });
}

/* ==================== BORDERLESS MACOS SEQUOIA & IPADOS SPOTLIGHT ==================== */

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  files,
  onSelectFile,
  commands
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SpotlightScope>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const [openSessionKey, setOpenSessionKey] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());
  const closeTimerRef = useRef<number | null>(null);

  const isApplePlatform =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setClosing(false);
      setQuery('');
      setScope('all');
      setSelectedIndex(0);
      setOpenSessionKey((k) => k + 1);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  const handleAnimatedClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      onClose();
    }, 205);
  }, [closing, onClose]);

  const { fileItems, commandItems, allItems, needle, effectiveScope } = useMemo(() => {
    const raw = query.trim();
    const typedCommandMode = raw.startsWith('>');
    const cleanNeedle = (typedCommandMode ? raw.slice(1) : raw).trim().toLowerCase();
    const activeScope: SpotlightScope = typedCommandMode ? 'commands' : scope;

    const matchedFiles: Extract<SpotlightItem, { kind: 'file' }>[] =
      activeScope === 'commands'
        ? []
        : files
            .filter(
              (f) =>
                !cleanNeedle ||
                f.name.toLowerCase().includes(cleanNeedle) ||
                f.path.toLowerCase().includes(cleanNeedle)
            )
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 14)
            .map((file) => {
              const slashIdx = file.path.lastIndexOf('/');
              const dirPath = slashIdx > 0 ? file.path.slice(0, slashIdx) : '';
              const bytes = new Blob([file.content]).size;
              const lineCount = file.content ? file.content.replace(/\r/g, '').split('\n').length : 0;
              return {
                kind: 'file',
                id: `file:${file.path}`,
                title: file.name,
                dirPath,
                langLabel: getLangLabel(file.language),
                sizeLabel: formatBytes(bytes),
                timeLabel: formatRelativeTimeVi(file.updatedAt),
                lineCount,
                file
              };
            });

    const matchedCommands: Extract<SpotlightItem, { kind: 'command' }>[] =
      activeScope === 'files'
        ? []
        : commands
            .filter(
              (cmd) =>
                !cleanNeedle ||
                cmd.title.toLowerCase().includes(cleanNeedle) ||
                (cmd.subtitle || '').toLowerCase().includes(cleanNeedle)
            )
            .map((command) => ({
              kind: 'command',
              id: `cmd:${command.id}`,
              title: command.title,
              subtitle: command.subtitle,
              shortcut: command.shortcut,
              command
            }));

    return {
      fileItems: matchedFiles,
      commandItems: matchedCommands,
      allItems: [...matchedFiles, ...matchedCommands] as SpotlightItem[],
      needle: cleanNeedle,
      effectiveScope: activeScope
    };
  }, [query, scope, files, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, scope, allItems.length]);

  useEffect(() => {
    if (!open) return;
    const node = rowRefs.current.get(selectedIndex);
    if (node) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, open]);

  if (!open) return null;

  const activeItem = allItems[selectedIndex] || null;
  const shouldCascadeRows = !query && scope === 'all';

  const executeItem = (idx: number) => {
    const chosen = allItems[idx];
    if (!chosen) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosing(false);
    onClose();
    if (chosen.kind === 'file') {
      onSelectFile(chosen.file);
    } else {
      chosen.command.action();
    }
  };

  const cycleScope = () => {
    setScope((prev) => (prev === 'all' ? 'files' : prev === 'files' ? 'commands' : 'all'));
  };

  const renderRow = (item: SpotlightItem, idx: number) => {
    const active = idx === selectedIndex;
    const shortcutTokens =
      item.kind === 'command' && item.shortcut
        ? formatShortcutTokens(item.shortcut, isApplePlatform)
        : [];

    return (
      <button
        key={`${item.id}-${openSessionKey}`}
        ref={(el) => {
          rowRefs.current.set(idx, el);
        }}
        type="button"
        onMouseEnter={() => setSelectedIndex(idx)}
        onClick={() => executeItem(idx)}
        style={{
          backgroundColor: active
            ? 'color-mix(in srgb, var(--accent-primary) 18%, var(--bg-panel-alt))'
            : 'transparent',
          color: 'var(--text-primary)',
          animationDelay: shouldCascadeRows && idx < 8 ? `${95 + idx * 24}ms` : undefined
        }}
        className={`${
          shouldCascadeRows && idx < 8 ? 'spotlight-row-enter' : ''
        } w-full px-2.5 py-2 rounded-[12px] flex items-center justify-between gap-2.5 text-left transition-colors`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            style={{
              backgroundColor: active
                ? 'color-mix(in srgb, var(--bg-panel) 90%, transparent)'
                : 'var(--bg-panel-alt)'
            }}
            className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0 transition-colors"
          >
            {item.kind === 'file' ? (
              <FileTypeIcon fileName={item.title} size={16} />
            ) : (
              item.command.icon
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-tight truncate">
              {highlightQuery(item.title, needle)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {item.kind === 'file' && (
            <span
              className="text-[10.5px] font-medium opacity-55 pr-0.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.langLabel}
            </span>
          )}

          {shortcutTokens.length > 0 && (
            <div className="flex items-center gap-0.5">
              {shortcutTokens.map((tok, i) => (
                <kbd
                  key={i}
                  style={{
                    backgroundColor: active
                      ? 'color-mix(in srgb, var(--bg-panel) 82%, transparent)'
                      : 'var(--bg-panel-alt)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}
                  className="min-w-[20px] h-5 px-1.5 rounded-[6px] text-[10px] font-mono inline-flex items-center justify-center"
                >
                  {tok}
                </kbd>
              ))}
            </div>
          )}

          {active && (
            <CornerDownLeft
              size={12.5}
              style={{ color: 'var(--accent-primary)' }}
              className="ml-0.5 shrink-0"
            />
          )}
        </div>
      </button>
    );
  };

  return (
    <div
      onClick={handleAnimatedClose}
      className={`${
        closing ? 'spotlight-backdrop-out' : 'spotlight-backdrop-in'
      } fixed inset-0 z-50 bg-black/48 backdrop-blur-[10px] flex items-start justify-center pt-[8vh] sm:pt-[11vh] px-3 select-none`}
    >
      {/* DYNAMIC ISLAND LIQUID-GLASS SPOTLIGHT WRAPPER */}
      <div
        key={openSessionKey}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[710px]"
      >
        {/* LAYER 1: MORPHING DEPTH SHADOW & PRISM GLOW (ĐỒNG BỘ NHỊP NỞ TỪ VIÊN THUỐC) */}
        <div
          aria-hidden="true"
          style={{
            boxShadow:
              '0 38px 98px -18px rgba(0, 0, 0, 0.62), 0 12px 30px -10px rgba(0, 0, 0, 0.34), 0 0 64px -22px var(--accent-glow)'
          }}
          className={`${
            closing ? 'spotlight-glow-out' : 'spotlight-glow-in'
          } pointer-events-none absolute inset-0 rounded-[24px] z-0`}
        />

        {/* LAYER 2: 100% BORDERLESS LIQUID GLASS SHELL UNFURLING FROM PILL */}
        <div
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-panel) 88%, transparent)',
            backdropFilter: 'blur(40px) saturate(185%)',
            WebkitBackdropFilter: 'blur(40px) saturate(185%)',
            color: 'var(--text-primary)'
          }}
          className={`${
            closing ? 'spotlight-shell-out' : 'spotlight-shell-in'
          } relative z-10 w-full rounded-[24px] overflow-hidden flex flex-col max-h-[76vh]`}
        >
          {/* SUBTLE LIQUID-GLASS PRISM SHIMMER SWEEP ON OPEN */}
          <div
            aria-hidden="true"
            className="spotlight-shimmer-sweep pointer-events-none absolute top-0 left-0 right-0 h-[2px] z-20"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-primary) 70%, #ffffff) 48%, color-mix(in srgb, #a855f7 45%, #ffffff) 62%, transparent 100%)'
            }}
          />

          {/* LUMINOUS PRISM HALO BLOOM INSIDE TOP OF SPOTLIGHT */}
          <div
            aria-hidden="true"
            className="spotlight-prism-bloom pointer-events-none absolute -top-24 left-1/2 w-[420px] h-[160px] rounded-full blur-3xl z-0"
            style={{
              background:
                'radial-gradient(closest-side, color-mix(in srgb, var(--accent-primary) 22%, transparent), transparent 72%)'
            }}
          />

          {/* BORDERLESS OVERSIZED SPOTLIGHT SEARCH BAR */}
          <div className="relative z-10 px-4 sm:px-5 pt-3.5 pb-3 flex items-center gap-3 shrink-0">
            <Search
              size={20}
              strokeWidth={2.1}
              style={{ color: query ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
              className="spotlight-icon-pop shrink-0 transition-colors"
            />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleAnimatedClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (allItems.length ? (prev + 1) % allItems.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  allItems.length ? (prev - 1 + allItems.length) % allItems.length : 0
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                executeItem(selectedIndex);
              } else if (e.key === 'Tab') {
                e.preventDefault();
                cycleScope();
              }
            }}
            placeholder={
              effectiveScope === 'commands'
                ? 'Tìm lệnh nhanh...'
                : effectiveScope === 'files'
                  ? 'Tìm tệp trong dự án...'
                  : 'Tìm kiếm Spotlight — tệp hoặc gõ > chạy lệnh'
            }
            style={{ color: 'var(--text-primary)' }}
            className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-[18px] font-normal tracking-[-0.015em] outline-none placeholder:opacity-45"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{
                backgroundColor: 'var(--bg-panel-alt)',
                color: 'var(--text-secondary)'
              }}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] transition-colors shrink-0"
              title="Xóa từ khóa"
            >
              <X size={11.5} strokeWidth={2.5} />
            </button>
          )}

          {/* BORDERLESS APPLE SEQUOIA SCOPE SWITCHER */}
          <div className="ios-segment-track hidden sm:flex items-center p-0.5 rounded-full shrink-0">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'files', label: 'Tệp' },
                { id: 'commands', label: 'Lệnh' }
              ] as Array<{ id: SpotlightScope; label: string }>
            ).map((tab) => {
              const active = effectiveScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (query.trim().startsWith('>') && tab.id !== 'commands') {
                      setQuery(query.replace(/^>\s*/, ''));
                    }
                    setScope(tab.id);
                    inputRef.current?.focus();
                  }}
                  style={active ? undefined : { color: 'var(--text-secondary)' }}
                  className={`${
                    active ? 'ios-segment-active font-semibold' : 'font-medium hover:text-[var(--text-primary)]'
                  } h-6 px-2.5 rounded-full text-[11px] transition-all`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* BORDERLESS SPOTLIGHT SPLIT BODY: GROUPED LIST + FLOATING QUICK LOOK */}
        <div className="relative z-10 flex-1 min-h-0 flex gap-2 px-2 pb-2 overflow-hidden">
          {/* LEFT COLUMN: GROUPED RESULTS (ZERO SCROLLBAR, ZERO DIVIDERS) */}
          <div className="w-full sm:w-[55%] max-h-[404px] overflow-y-auto no-scrollbar px-1 py-1 space-y-3">
            {allItems.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-1.5">
                <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  Không có kết quả cho &ldquo;{query}&rdquo;
                </div>
                <div className="text-[11.5px] opacity-60" style={{ color: 'var(--text-secondary)' }}>
                  Thử tên tệp khác hoặc gõ <code className="font-mono">&gt;</code> để xem toàn bộ lệnh
                </div>
              </div>
            ) : (
              <>
                {fileItems.length > 0 && (
                  <div className="space-y-0.5">
                    <div
                      className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.07em] opacity-50"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Tệp trong dự án
                    </div>
                    {fileItems.map((item, idx) => renderRow(item, idx))}
                  </div>
                )}

                {commandItems.length > 0 && (
                  <div className="space-y-0.5">
                    <div
                      className="px-2.5 pt-0.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.07em] opacity-50"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Lệnh nhanh
                    </div>
                    {commandItems.map((item, idx) => renderRow(item, fileItems.length + idx))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT COLUMN: BORDERLESS FLOATING QUICK LOOK INSPECTOR */}
          <div
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 44%, var(--bg-panel-alt))'
            }}
            className="spotlight-inspector-enter hidden sm:flex sm:w-[45%] rounded-[18px] flex-col p-4 overflow-hidden"
          >
            {!activeItem ? (
              <div
                className="flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-45"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Search size={24} strokeWidth={1.5} />
                <span className="text-[12px]">Chọn một mục để xem nhanh</span>
              </div>
            ) : activeItem.kind === 'file' ? (
              <div
                key={activeItem.id}
                className="spotlight-preview-swap flex-1 min-h-0 flex flex-col gap-3"
              >
                {/* File Inspector Header */}
                <div className="flex items-center gap-3 shrink-0">
                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
                  >
                    <FileTypeIcon fileName={activeItem.title} size={23} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold tracking-tight truncate">
                      {activeItem.title}
                    </div>
                    <div
                      className="text-[11px] truncate mt-0.5 opacity-75"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {activeItem.langLabel} · {activeItem.sizeLabel}
                    </div>
                  </div>
                </div>

                {/* Live Quick Look Code Preview (100% Borderless) */}
                <div
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 76%, var(--bg-panel))'
                  }}
                  className="flex-1 min-h-[164px] rounded-[13px] p-3 relative overflow-hidden font-mono text-[10.5px] leading-[1.6]"
                >
                  {getPreviewLines(activeItem.file, 12).length > 0 ? (
                    <div className="space-y-[1px]">
                      {getPreviewLines(activeItem.file, 12).map((line, i) => (
                        <div key={i} className="flex items-baseline gap-2 min-w-0 whitespace-pre">
                          <span
                            className="w-3.5 text-right text-[9px] opacity-30 shrink-0"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {i + 1}
                          </span>
                          <span className="truncate opacity-85">
                            {renderPreviewCodeLine(line)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="h-full flex items-center justify-center text-[11px] opacity-55"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Tệp trống
                    </div>
                  )}

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                    style={{
                      background:
                        'linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--bg-canvas) 78%, var(--bg-panel)) 100%)'
                    }}
                  />
                </div>

                {/* Compact File Metadata Footer */}
                <div className="flex items-center justify-between text-[11px] shrink-0">
                  <span style={{ color: 'var(--text-secondary)' }} className="opacity-70 truncate">
                    {activeItem.lineCount} dòng · {activeItem.timeLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => executeItem(selectedIndex)}
                    style={{ color: 'var(--accent-primary)' }}
                    className="font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
                  >
                    <span>Mở tệp</span>
                    <CornerDownLeft size={11.5} />
                  </button>
                </div>
              </div>
            ) : (
              /* Command Inspector Card (100% Borderless) */
              <div
                key={activeItem.id}
                className="spotlight-preview-swap flex-1 flex flex-col items-center justify-center text-center gap-3 px-2"
              >
                <div
                  style={{
                    background:
                      'radial-gradient(64px circle at 50% 25%, color-mix(in srgb, var(--accent-primary) 18%, transparent), transparent 76%), var(--bg-panel)'
                  }}
                  className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                >
                  <div className="scale-[1.35]">{activeItem.command.icon}</div>
                </div>

                <div className="space-y-1 max-w-[230px]">
                  <div className="text-[14.5px] font-semibold tracking-tight leading-snug">
                    {activeItem.title}
                  </div>
                  {activeItem.subtitle && (
                    <p
                      className="text-[11.5px] leading-relaxed opacity-70"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {activeItem.subtitle}
                    </p>
                  )}
                </div>

                {activeItem.shortcut && (
                  <div className="flex items-center gap-1 pt-0.5">
                    {formatShortcutTokens(activeItem.shortcut, isApplePlatform).map((tok, i) => (
                      <kbd
                        key={i}
                        style={{
                          backgroundColor: 'var(--bg-panel)',
                          color: 'var(--text-primary)'
                        }}
                        className="min-w-[24px] h-6 px-2 rounded-[7px] text-[11px] font-mono inline-flex items-center justify-center"
                      >
                        {tok}
                      </kbd>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => executeItem(selectedIndex)}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    boxShadow: '0 10px 22px -10px var(--accent-glow)'
                  }}
                  className="mt-2 h-8 px-4 rounded-full text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all"
                >
                  <span>Chạy lệnh</span>
                  <CornerDownLeft size={12.5} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BORDERLESS WHISPER-QUIET FOOTER BAR */}
        <div
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-panel-alt) 32%, transparent)',
            color: 'var(--text-secondary)'
          }}
          className="relative z-10 h-9 px-4 flex items-center justify-between text-[10.5px] shrink-0"
        >
          <div className="flex items-center gap-3.5 opacity-70">
            <span className="inline-flex items-center gap-1">
              <kbd
                style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                className="w-4 h-4 rounded-[5px] inline-flex items-center justify-center"
              >
                <ArrowUp size={9.5} />
              </kbd>
              <kbd
                style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                className="w-4 h-4 rounded-[5px] inline-flex items-center justify-center"
              >
                <ArrowDown size={9.5} />
              </kbd>
              <span>Chọn</span>
            </span>

            <span className="inline-flex items-center gap-1">
              <kbd
                style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                className="px-1.5 h-4 rounded-[5px] font-mono inline-flex items-center justify-center text-[9.5px]"
              >
                ↵
              </kbd>
              <span>Mở</span>
            </span>

            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd
                style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                className="px-1.5 h-4 rounded-[5px] font-mono inline-flex items-center justify-center text-[9.5px]"
              >
                Tab
              </kbd>
              <span>Đổi mục</span>
            </span>
          </div>

          <div className="flex items-center gap-2 opacity-60">
            <span className="hidden sm:inline">{allItems.length} kết quả</span>
            <kbd
              style={{ backgroundColor: 'var(--bg-panel-alt)' }}
              className="px-1.5 h-4 rounded-[5px] font-mono inline-flex items-center justify-center text-[9.5px]"
            >
              ESC
            </kbd>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export const PaletteIcons = {
  Home,
  Play,
  Wand2,
  Columns,
  PanelLeft,
  PanelBottom,
  Maximize2,
  Palette,
  FilePlus,
  Settings,
  Trash2,
  Search
};
