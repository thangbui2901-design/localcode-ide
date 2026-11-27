import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings,
  Plus,
  MoreHorizontal,
  Home,
  Folder,
  Play,
  Palette,
  Search,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  X,
  Layers,
  Code2,
  Pin,
  PinOff,
  Pencil,
  FileArchive,
  FileUp,
  LayoutGrid,
  List,
  ChevronDown,
  ArrowUpRight,
  FolderPlus
} from 'lucide-react';
import { DeviceBreakpoint, FileNode, SupportedLanguage, WorkspaceFile } from '../types/ide';
import { FileTypeIcon } from './FileTypeIcon';
import { isNativeMotionAvailable } from '../utils/nativeMotion';

export type QuickStartKind =
  | 'python'
  | 'javascript'
  | 'cpp'
  | 'html'
  | 'css'
  | 'cpp-oop'
  | 'web-starter'
  | 'c';

export type NewProjectTemplate = 'web' | 'cpp' | 'cpp-oop' | 'python' | 'javascript';

type ProjectFilter = 'all' | 'folders' | 'cpp' | 'python' | 'web';

interface HomeScreenProps {
  breakpoint: DeviceBreakpoint;
  tree: FileNode[];
  files: WorkspaceFile[];
  pinnedPaths: string[];
  themeSwatch: string;
  onTogglePin: (path: string) => void;
  onCycleTheme: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  onOpenProjects: () => void;
  onOpenFile: (file: WorkspaceFile) => void;
  onRunActive: () => void;
  onQuickStart: (kind: QuickStartKind) => void;
  onCreateProject: (projectName: string, template: NewProjectTemplate) => Promise<void> | void;
  onRenameEntry: (oldPath: string, newPath: string) => Promise<void> | void;
  onExportProjectZip: (path: string, isFolder: boolean) => void;
  onImportCodeFiles: (fileList: FileList) => Promise<void> | void;
  onDeleteEntry: (relPath: string) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onReplaySplash?: () => void;
  splashPhase?: 'active' | 'exiting' | 'done';
}

interface GalleryProjectItem {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  isPinned: boolean;
  updatedAt: number;
  fileCount: number;
  sizeLabel: string;
  timeLabel: string;
  langCategory: 'cpp' | 'python' | 'web' | 'other';
  langBadge: string;
  langTint: string;
  previewLines: string[];
  previewSummary: string;
  folderFiles: WorkspaceFile[];
  entryFile: WorkspaceFile | null;
}

/* ==================== CRISP MINI LANGUAGE SVG BADGES ==================== */

const PythonBadge: React.FC<{ size?: string }> = ({ size = 'w-4 h-4' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0`}>
    <path
      fill="#3776AB"
      d="M23.8 5c-9.1 0-8.5 3.9-8.5 3.9v4.1h8.7v1.3H12c-3.9 0-7 2.4-7 6.9s2.7 7.1 6.6 7.1h3.9v-4.2c0-3.5 3-6.4 6.6-6.4h8.6c2.8 0 5-2.3 5-5.1V9.5C35.7 6.4 31.3 5 23.8 5zm-4.5 3.1a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z"
    />
    <path
      fill="#FFD43B"
      d="M24.2 43c9.1 0 8.5-3.9 8.5-3.9V35H24v-1.3h12c3.9 0 7-2.4 7-6.9s-2.7-7.1-6.6-7.1h-3.9v4.2c0 3.5-3 6.4-6.6 6.4h-8.6c-2.8 0-5 2.3-5 5.1v3.1C12.3 41.6 16.7 43 24.2 43zm4.5-3.1a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0-3.4z"
    />
  </svg>
);

const JsBadge: React.FC<{ size?: string }> = ({ size = 'w-4 h-4' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0`}>
    <rect x="6" y="6" width="36" height="36" rx="8" fill="#F7DF1E" />
    <text
      x="26"
      y="35"
      textAnchor="middle"
      fontFamily="Inter, system-ui, sans-serif"
      fontWeight="800"
      fontSize="18"
      fill="#1A1A1A"
    >
      JS
    </text>
  </svg>
);

const CppBadge: React.FC<{ size?: string }> = ({ size = 'w-4 h-4' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0`}>
    <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill="#00599C" />
    <polygon points="24,4 42,14 42,34 24,24" fill="#004482" />
    <polygon points="24,24 42,34 24,44 6,34" fill="#004D8F" opacity="0.65" />
    <circle
      cx="22.5"
      cy="24"
      r="9.5"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="4.2"
      strokeDasharray="45 18"
      strokeDashoffset="-9"
    />
    <path
      d="M32 21.5h5M34.5 19v5M38.5 21.5h5M41 19v5"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
  </svg>
);

const HtmlBadge: React.FC<{ size?: string }> = ({ size = 'w-4 h-4' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0`}>
    <path fill="#E34F26" d="M8 6h32l-3 33-13 4-13-4L8 6z" />
    <path fill="#EF652A" d="M24 9v31l10.5-3.1L37 9H24z" />
    <path
      fill="#FFFFFF"
      d="M15.5 14.5h17l-.5 4.2H19.8l.4 4.3h11.3l-1 10.6-6.5 1.9-6.5-1.9-.4-4.9h4.1l.2 2.4 2.6.7 2.6-.7.3-3.9H16.5l-1-12.7z"
    />
  </svg>
);

const CssBadge: React.FC<{ size?: string }> = ({ size = 'w-4 h-4' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0`}>
    <path fill="#1572B6" d="M8 6h32l-3 33-13 4-13-4L8 6z" />
    <path fill="#33A9DC" d="M24 9v31l10.5-3.1L37 9H24z" />
    <path
      fill="#FFFFFF"
      d="M15.5 14.5h17l-.4 4.2H20.1l.3 3.9h11.2l-1 11-6.6 1.9-6.6-1.9-.4-4.7h4.1l.2 2.3 2.7.7 2.7-.7.3-4.3H16.6l-1.1-12.4z"
    />
  </svg>
);

const BlueFolderIcon: React.FC<{ size?: string }> = ({ size = 'w-6 h-5' }) => (
  <svg viewBox="0 0 36 30" className={`${size} shrink-0`}>
    <defs>
      <linearGradient id="galleryFolderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <path
      d="M3 6.5C3 4.567 4.567 3 6.5 3h7.2c1.1 0 2.13.52 2.79 1.4l1.42 1.9c.38.5.97.8 1.6.8H29.5C31.433 7.1 33 8.667 33 10.6V23.5c0 1.933-1.567 3.5-3.5 3.5h-23C4.567 27 3 25.433 3 23.5v-17Z"
      fill="url(#galleryFolderGrad)"
    />
    <path
      d="M3 11.5h30v12c0 1.933-1.567 3.5-3.5 3.5h-23C4.567 27 3 25.433 3 23.5v-12Z"
      fill="#93C5FD"
      opacity="0.22"
    />
  </svg>
);

/* ==================== HELPERS & MINI SYNTAX TINTING ==================== */

function getGreetingVi(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

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
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} tuần trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
}

function getLangCategory(lang?: SupportedLanguage): 'cpp' | 'python' | 'web' | 'other' {
  if (lang === 'cpp' || lang === 'c') return 'cpp';
  if (lang === 'python') return 'python';
  if (lang === 'html' || lang === 'css' || lang === 'javascript' || lang === 'json') return 'web';
  return 'other';
}

function getLangBadgeLabel(lang?: SupportedLanguage): string {
  switch (lang) {
    case 'cpp':
      return 'C++';
    case 'c':
      return 'C';
    case 'python':
      return 'Python';
    case 'javascript':
      return 'JS';
    case 'html':
      return 'HTML';
    case 'css':
      return 'CSS';
    case 'json':
      return 'JSON';
    case 'markdown':
      return 'MD';
    default:
      return 'TXT';
  }
}

function getLangAccentTint(lang?: SupportedLanguage, isFolder?: boolean): string {
  if (isFolder) return '#3b82f6';
  switch (lang) {
    case 'html':
      return '#ea580c';
    case 'css':
      return '#0ea5e9';
    case 'javascript':
      return '#eab308';
    case 'cpp':
    case 'c':
      return '#3b82f6';
    case 'python':
      return '#10b981';
    case 'json':
      return '#8b5cf6';
    default:
      return '#64748b';
  }
}

const SKIP_HEAD_LINE_RE = /^(?:<!DOCTYPE\b|<\/?html\b|<\/?head\b|<meta\b|<link\b|#pragma\b)/i;

function extractDocumentWindowLines(file: WorkspaceFile | null, maxLines = 7): string[] {
  if (!file || file.language === 'asset' || file.content.startsWith('data:')) return [];
  const raw = file.content.replace(/\r/g, '').split('\n');
  const nonEmpty = raw.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  // Bỏ qua phần khai báo đầu lặp lại của HTML để cửa sổ preview nhìn sinh động hơn
  let startIdx = 0;
  if (file.language === 'html') {
    const firstInteresting = nonEmpty.findIndex((l) => !SKIP_HEAD_LINE_RE.test(l.trim()));
    if (firstInteresting >= 0) startIdx = firstInteresting;
  }

  const slice = nonEmpty.slice(startIdx, startIdx + maxLines);
  const indents = slice.map((l) => l.match(/^\s*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

  return slice.map((l) => {
    const dedented = l.slice(minIndent).replace(/\t/g, '  ');
    return dedented.length > 46 ? `${dedented.slice(0, 46)}…` : dedented;
  });
}

function extractCompactSummaryLine(file: WorkspaceFile | null): string {
  if (!file || file.language === 'asset' || file.content.startsWith('data:')) return '';
  const lines = file.content
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
  const meaningful = lines.find(
    (l) =>
      !/^(?:#include\b|using\s+namespace\b|<!DOCTYPE\b|<\/?(?:html|head|body)\b|<meta\b|<link\b|[{}();]+$)/i.test(
        l
      )
  );
  return (meaningful || lines[0] || '').slice(0, 68);
}

const MINI_TOKEN_RE =
  /(\/\/.*$|\/\*.*?\*\/|<!--.*?-->|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<\/?[a-zA-Z][\w-]*|>|#include\b|#define\b|\b(?:int|long|double|float|char|bool|void|auto|const|struct|class|return|for|while|if|else|switch|using|namespace|std|def|import|from|as|elif|try|except|async|await|function|let|var|export|default|new|true|false|null|nullptr|printf|scanf|cin|cout|print|console)\b|-?\b\d+(?:\.\d+)?\b)/g;

function renderTintedCodeLine(line: string): React.ReactNode {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('<!--') || trimmed.startsWith('# ')) {
    return (
      <span className="italic opacity-45" style={{ color: 'var(--text-secondary)' }}>
        {line}
      </span>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  MINI_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = MINI_TOKEN_RE.exec(line)) !== null) {
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

function collectFolderFiles(node: FileNode): WorkspaceFile[] {
  const result: WorkspaceFile[] = [];
  if (node.type === 'file' && node.file) result.push(node.file);
  if (node.children) {
    for (const child of node.children) result.push(...collectFolderFiles(child));
  }
  return result;
}

function handleSpotlightMove(e: React.PointerEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  e.currentTarget.style.setProperty('--spot-opacity', '1');
}

function handleSpotlightLeave(e: React.PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--spot-opacity', '0');
}

/* ==================== PLAYGROUNDS / CRAFT VISUAL CODE CARD ==================== */

interface GalleryCardProps {
  item: GalleryProjectItem;
  isLatest: boolean;
  index: number;
  surfaceShadow: string;
  splashPhase: 'active' | 'exiting' | 'done';
  allowStagger: boolean;
  onOpen: () => void;
  onOpenActionSheet: () => void;
}

const GalleryCard: React.FC<GalleryCardProps> = ({
  item,
  isLatest,
  index,
  surfaceShadow,
  splashPhase,
  allowStagger,
  onOpen,
  onOpenActionSheet
}) => {
  const isSplashReveal = splashPhase !== 'done';
  const revealDelay = isSplashReveal ? `${155 + Math.min(index, 7) * 55}ms` : undefined;
  return (
    <div
      onPointerMove={handleSpotlightMove}
      onPointerLeave={handleSpotlightLeave}
      onClick={onOpen}
      style={{
        backgroundColor: 'var(--bg-panel)',
        boxShadow: surfaceShadow,
        transitionDelay: revealDelay,
        animationDelay: allowStagger ? `${70 + Math.min(index, 10) * 32}ms` : undefined
      }}
      className={`${
        isSplashReveal
          ? 'home-gallery-card'
          : allowStagger
            ? 'home-stagger transition-all duration-300'
            : 'transition-all duration-300'
      } group spotlight-card rounded-[22px] overflow-hidden flex flex-col cursor-pointer hover:-translate-y-1 active:scale-[0.985]`}
    >
      {/* MINI CODE / DOCUMENT PREVIEW WINDOW (SWIFT PLAYGROUNDS × CRAFT STYLE) */}
      <div
        style={{
          background: `radial-gradient(150px circle at 92% 10%, color-mix(in srgb, ${item.langTint} 13%, transparent), transparent 72%), color-mix(in srgb, var(--bg-canvas) 62%, var(--bg-panel-alt))`,
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 4.5%, transparent)'
        }}
        className="m-2.5 mb-0 h-[126px] sm:h-[146px] rounded-[15px] overflow-hidden relative flex flex-col select-none"
      >
        {/* Subtle Miniature Window Header */}
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 opacity-30">
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ backgroundColor: 'var(--text-secondary)' }}
            />
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ backgroundColor: 'var(--text-secondary)' }}
            />
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ backgroundColor: 'var(--text-secondary)' }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {item.isPinned && (
              <Pin size={10} className="text-amber-400 fill-amber-400/80 shrink-0" />
            )}
            <span
              className="text-[9.5px] font-semibold uppercase tracking-[0.06em] opacity-55"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.isFolder ? `${item.fileCount} tệp` : item.langBadge}
            </span>
          </div>
        </div>

        {/* Miniature Document Body */}
        {item.isFolder ? (
          <div className="px-3 pb-3 pt-1 flex-1 flex flex-col gap-1.5 overflow-hidden">
            {item.folderFiles.slice(0, 4).map((f) => (
              <div
                key={f.path}
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg-panel) 65%, transparent)'
                }}
                className="px-2 py-1 rounded-lg flex items-center gap-2 min-w-0"
              >
                <FileTypeIcon fileName={f.name} size={12} />
                <span
                  className="text-[10px] font-mono truncate opacity-80"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {f.name}
                </span>
              </div>
            ))}
            {item.folderFiles.length === 0 && (
              <div
                className="flex-1 flex items-center justify-center text-[10.5px] opacity-45"
                style={{ color: 'var(--text-secondary)' }}
              >
                Thư mục trống
              </div>
            )}
          </div>
        ) : item.previewLines.length > 0 ? (
          <div className="px-3 pb-3 pt-0.5 flex-1 overflow-hidden font-mono text-[10px] leading-[1.62] space-y-[1px]">
            {item.previewLines.map((line, i) => (
              <div key={i} className="flex items-baseline gap-2 min-w-0 whitespace-pre overflow-hidden">
                <span
                  className="w-3 text-right text-[8.5px] opacity-30 shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {i + 1}
                </span>
                <span
                  className="truncate opacity-85"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {renderTintedCodeLine(line)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 opacity-40">
            <FileTypeIcon fileName={item.name} size={24} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Tệp trống
            </span>
          </div>
        )}

        {/* Silky Bottom Paper Fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--bg-canvas) 62%, var(--bg-panel-alt)) 100%)'
          }}
        />
      </div>

      {/* CLEAN GALLERY CAPTION BAR */}
      <div className="px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {item.isFolder ? (
            <BlueFolderIcon size="w-5 h-4" />
          ) : (
            <FileTypeIcon fileName={item.name} size={19} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-[13.5px] font-semibold tracking-[-0.01em] truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.name}
              </span>
              {isLatest && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                  title="Vừa chỉnh sửa gần nhất"
                />
              )}
            </div>
            <div
              className="text-[11px] truncate mt-0.5 opacity-75"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.timeLabel} · {item.sizeLabel}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionSheet();
          }}
          style={{ color: 'var(--text-secondary)' }}
          className="w-7 h-7 rounded-full sm:opacity-35 sm:group-hover:opacity-100 flex items-center justify-center hover:bg-[var(--bg-panel-alt)] hover:text-[var(--text-primary)] transition-all shrink-0"
          title="Tùy chọn"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
    </div>
  );
};

/* ==================== SWIPEABLE LIST ROW (OPTIONAL LIST VIEW) ==================== */

const SWIPE_ACTION_WIDTH = 156;

interface ProjectListRowProps {
  item: GalleryProjectItem;
  isLatest: boolean;
  index: number;
  isSwiped: boolean;
  onSetSwiped: (id: string | null) => void;
  onOpen: () => void;
  onOpenActionSheet: () => void;
  onPin: () => void;
  onExportZip: () => void;
  onDelete: () => void;
}

const ProjectListRow: React.FC<ProjectListRowProps> = ({
  item,
  isLatest,
  index,
  isSwiped,
  onSetSwiped,
  onOpen,
  onOpenActionSheet,
  onPin,
  onExportZip,
  onDelete
}) => {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const startRef = useRef<{ x: number; y: number; base: number; locked: 'h' | 'v' | null } | null>(
    null
  );
  const didSwipeRef = useRef(false);

  const currentX = dragOffset !== null ? dragOffset : isSwiped ? -SWIPE_ACTION_WIDTH : 0;
  const showSwipeTray = currentX < -2;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    didSwipeRef.current = false;
    startRef.current = {
      x: t.clientX,
      y: t.clientY,
      base: isSwiped ? -SWIPE_ACTION_WIDTH : 0,
      locked: null
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const st = startRef.current;
    const t = e.touches[0];
    if (!st || !t) return;
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;

    if (!st.locked) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        st.locked = 'h';
      } else if (Math.abs(dy) > 10) {
        st.locked = 'v';
        return;
      } else {
        return;
      }
    }

    if (st.locked !== 'h') return;
    didSwipeRef.current = true;
    const nextX = Math.max(-SWIPE_ACTION_WIDTH - 12, Math.min(0, st.base + dx));
    setDragOffset(nextX);
  };

  const onTouchEnd = () => {
    const st = startRef.current;
    startRef.current = null;
    if (!st || st.locked !== 'h') {
      setDragOffset(null);
      return;
    }
    const finalX = dragOffset ?? currentX;
    setDragOffset(null);
    if (finalX < -SWIPE_ACTION_WIDTH * 0.42) {
      onSetSwiped(item.id);
    } else {
      onSetSwiped(null);
    }
  };

  return (
    <div
      style={{ animationDelay: `${70 + Math.min(index, 8) * 30}ms` }}
      className="home-stagger relative overflow-hidden rounded-[14px]"
    >
      {showSwipeTray && (
        <div
          style={{ width: `${SWIPE_ACTION_WIDTH}px` }}
          className="absolute inset-y-0 right-0 flex items-stretch select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onSetSwiped(null);
              onPin();
            }}
            className="flex-1 bg-amber-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold"
          >
            {item.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            <span>{item.isPinned ? 'Bỏ ghim' : 'Ghim'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSetSwiped(null);
              onExportZip();
            }}
            className="flex-1 bg-emerald-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold"
          >
            <FileArchive size={13} />
            <span>ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSetSwiped(null);
              onDelete();
            }}
            className="flex-1 bg-rose-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold"
          >
            <Trash2 size={13} />
            <span>Xóa</span>
          </button>
        </div>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          if (isSwiped) {
            onSetSwiped(null);
            return;
          }
          onOpen();
        }}
        style={{
          backgroundColor: showSwipeTray ? 'var(--bg-panel)' : undefined,
          transform: `translate3d(${currentX}px, 0, 0)`,
          transition: dragOffset === null ? 'transform 0.34s var(--ease-ios-spring)' : 'none'
        }}
        className="group relative z-10 px-3.5 py-2.5 rounded-[14px] flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-panel-alt)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
          >
            {item.isFolder ? (
              <BlueFolderIcon size="w-5 h-4" />
            ) : (
              <FileTypeIcon fileName={item.name} size={19} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-[13.5px] font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.name}
              </span>
              {item.isPinned && (
                <Pin size={10.5} className="text-amber-400 shrink-0 fill-amber-400/75" />
              )}
              {isLatest && !item.isPinned && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                />
              )}
            </div>
            <p
              style={{ color: 'var(--text-secondary)' }}
              className="font-mono text-[11px] opacity-65 truncate mt-0.5"
            >
              {item.previewSummary ||
                (item.isFolder ? `${item.fileCount} tệp trong dự án` : 'Tệp trống')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {item.timeLabel}
            </div>
            <div
              className="text-[10px] font-mono opacity-60"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.isFolder ? `${item.fileCount} tệp` : item.langBadge} · {item.sizeLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenActionSheet();
            }}
            style={{ color: 'var(--text-secondary)' }}
            className="w-7 h-7 rounded-full sm:opacity-40 sm:group-hover:opacity-100 flex items-center justify-center hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all shrink-0"
            title="Tùy chọn"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==================== MAIN PLAYGROUNDS × CRAFT GALLERY HOME SCREEN ==================== */

export const HomeScreen: React.FC<HomeScreenProps> = ({
  breakpoint: _breakpoint,
  tree,
  files,
  pinnedPaths,
  themeSwatch: _themeSwatch,
  onTogglePin,
  onCycleTheme,
  onOpenSettings,
  onOpenCommandPalette,
  onOpenProjects,
  onOpenFile,
  onRunActive,
  onQuickStart,
  onCreateProject,
  onRenameEntry,
  onExportProjectZip,
  onImportCodeFiles,
  onDeleteEntry,
  onExportBackup,
  onImportBackup,
  onReplaySplash,
  splashPhase = 'done'
}) => {
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<GalleryProjectItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState<NewProjectTemplate>('web');
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<GalleryProjectItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const createMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const pinnedSet = useMemo(() => new Set(pinnedPaths), [pinnedPaths]);

  useEffect(() => {
    if (!createMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreateMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [createMenuOpen]);

  const galleryItems = useMemo<GalleryProjectItem[]>(() => {
    const items: GalleryProjectItem[] = [];

    for (const node of tree) {
      if (node.type === 'folder') {
        const innerFiles = collectFolderFiles(node);
        const totalBytes = innerFiles.reduce((acc, f) => acc + new Blob([f.content]).size, 0);
        const latestTs = innerFiles.reduce(
          (maxTs, f) => Math.max(maxTs, f.updatedAt || 0),
          node.updatedAt || 0
        );
        const preferred =
          innerFiles.find((f) => /^(index\.html|main\.cpp|main\.py|app\.js)$/i.test(f.name)) ||
          innerFiles[0] ||
          null;
        items.push({
          id: `folder:${node.path}`,
          name: node.name,
          path: node.path,
          isFolder: true,
          isPinned: pinnedSet.has(node.path),
          updatedAt: latestTs,
          fileCount: innerFiles.length,
          sizeLabel: formatBytes(totalBytes),
          timeLabel: formatRelativeTimeVi(latestTs),
          langCategory: getLangCategory(preferred?.language),
          langBadge: preferred ? getLangBadgeLabel(preferred.language) : 'Thư mục',
          langTint: getLangAccentTint(preferred?.language, true),
          previewLines: extractDocumentWindowLines(preferred, 6),
          previewSummary: extractCompactSummaryLine(preferred),
          folderFiles: innerFiles,
          entryFile: preferred
        });
      } else if (node.file) {
        const bytes = new Blob([node.file.content]).size;
        const ts = node.file.updatedAt || node.updatedAt || 0;
        items.push({
          id: `file:${node.path}`,
          name: node.name,
          path: node.path,
          isFolder: false,
          isPinned: pinnedSet.has(node.path),
          updatedAt: ts,
          fileCount: 1,
          sizeLabel: formatBytes(bytes),
          timeLabel: formatRelativeTimeVi(ts),
          langCategory: getLangCategory(node.file.language),
          langBadge: getLangBadgeLabel(node.file.language),
          langTint: getLangAccentTint(node.file.language, false),
          previewLines: extractDocumentWindowLines(node.file, 7),
          previewSummary: extractCompactSummaryLine(node.file),
          folderFiles: [],
          entryFile: node.file
        });
      }
    }

    items.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
      return Number(b.isFolder) - Number(a.isFolder);
    });
    return items;
  }, [tree, pinnedSet]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return galleryItems.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (filter === 'folders') return item.isFolder;
      if (filter === 'cpp') return item.langCategory === 'cpp';
      if (filter === 'python') return item.langCategory === 'python';
      if (filter === 'web') return item.langCategory === 'web';
      return true;
    });
  }, [galleryItems, searchQuery, filter]);

  const totalSizeBytes = useMemo(
    () => files.reduce((sum, f) => sum + new Blob([f.content]).size, 0),
    [files]
  );

  const latestItem = useMemo<GalleryProjectItem | null>(() => {
    if (galleryItems.length === 0) return null;
    return galleryItems.reduce((best, cur) => (cur.updatedAt > best.updatedAt ? cur : best));
  }, [galleryItems]);

  const latestEditable = latestItem?.entryFile || files[0] || null;

  const handleSubmitCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newProjectName.trim().replace(/[\\/:*?"<>|]+/g, '-');
    const finalName = cleaned || `Project_${Date.now().toString().slice(-3)}`;
    setCreating(true);
    try {
      await onCreateProject(finalName, newProjectTemplate);
      setCreateModalOpen(false);
      setNewProjectName('');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const trimmed = renameValue.trim().replace(/[\\/:*?"<>|]+/g, '');
    const target = renameTarget;
    setRenameTarget(null);
    setRenameValue('');
    if (!trimmed || trimmed === target.name) return;
    const parts = target.path.split('/');
    parts[parts.length - 1] = trimmed;
    await onRenameEntry(target.path, parts.join('/'));
  };

  const quickTemplates: Array<{
    kind: QuickStartKind;
    label: string;
    sub: string;
    badge: React.ReactNode;
  }> = [
    { kind: 'cpp', label: 'C++', sub: 'GCC 14.2', badge: <CppBadge size="w-4 h-4" /> },
    { kind: 'python', label: 'Python', sub: 'Pyodide', badge: <PythonBadge size="w-4 h-4" /> },
    { kind: 'html', label: 'HTML5', sub: 'Live Preview', badge: <HtmlBadge size="w-4 h-4" /> },
    { kind: 'javascript', label: 'JavaScript', sub: 'ES2024', badge: <JsBadge size="w-4 h-4" /> },
    { kind: 'css', label: 'CSS3', sub: 'Stylesheet', badge: <CssBadge size="w-4 h-4" /> },
    {
      kind: 'web-starter',
      label: 'Web Starter',
      sub: 'HTML+CSS+JS',
      badge: <Layers size={15} className="text-sky-500 shrink-0" />
    },
    {
      kind: 'c',
      label: 'C17',
      sub: 'Standard C',
      badge: <Code2 size={15} className="text-emerald-500 shrink-0" />
    }
  ];

  // Chỉ chạy ios-view-pop khi quay lại Home từ Editor (KHÔNG chạy sau Welcome Screen -> 0 giật!)
  const mountedWithSplashRef = useRef(splashPhase !== 'done');
  if (splashPhase === 'active') {
    mountedWithSplashRef.current = true;
  }
  const allowPopAnimation =
    !mountedWithSplashRef.current && splashPhase === 'done' && !isNativeMotionAvailable();

  const hasFolders = useMemo(() => galleryItems.some((p) => p.isFolder), [galleryItems]);

  const filterOptions: Array<{ id: ProjectFilter; label: string }> = useMemo(
    () => [
      { id: 'all', label: 'Tất cả' },
      ...(hasFolders ? [{ id: 'folders' as const, label: 'Thư mục' }] : []),
      { id: 'cpp', label: 'C / C++' },
      { id: 'python', label: 'Python' },
      { id: 'web', label: 'Web' }
    ],
    [hasFolders]
  );

  const surfaceShadow =
    'var(--shadow-card), inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 5.5%, transparent)';

  return (
    <div
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
      className={`glass-canvas ${
        allowPopAnimation ? 'ios-view-pop' : ''
      } ${
        splashPhase === 'active'
          ? 'home-reveal-waiting'
          : splashPhase === 'exiting'
            ? 'home-reveal-exiting'
            : ''
      } w-full h-full flex flex-col overflow-hidden select-none relative z-10`}
      onClick={() => {
        if (swipedRowId) setSwipedRowId(null);
      }}
    >
      {/* HIDDEN SHARED CODE FILE IMPORTER */}
      <input
        ref={importInputRef}
        type="file"
        multiple
        accept=".cpp,.cc,.cxx,.c,.h,.hpp,.py,.html,.htm,.css,.js,.mjs,.json,.md,.txt"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportCodeFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* DELICATE TOP GALLERY AMBIENT AURA */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(760px circle at 50% -6%, color-mix(in srgb, var(--accent-primary) 7.5%, transparent), transparent 62%)'
        }}
      />

      {/* CLEAN APPLE DOCUMENT GALLERY HEADER */}
      <header
        style={{
          backgroundColor: 'transparent',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'max(20px, env(safe-area-inset-left))',
          paddingRight: 'max(20px, env(safe-area-inset-right))'
        }}
        className="home-reveal-header w-full shrink-0 relative z-30"
      >
        <div className="max-w-[1120px] mx-auto h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onReplaySplash}
            className="flex items-center gap-2.5 min-w-0 group shrink-0"
            title="Xem lại hoạt họa mở đầu"
          >
            <img
              data-home-logo="true"
              src="/app-logo.png"
              alt="Code With You"
              className="home-reveal-logo w-7 h-7 rounded-lg object-contain shrink-0 group-active:scale-90 transition-transform"
            />
            <span
              className="home-reveal-header-chrome text-[15px] font-bold tracking-[-0.02em] truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              Code With You
            </span>
          </button>

          {/* RIGHT UTILITY ICONS */}
          <div className="home-reveal-header-chrome flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              style={{ color: 'var(--text-secondary)' }}
              className="w-8 h-8 rounded-full hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              title="Mở bảng lệnh & tìm nhanh"
            >
              <Search size={16} />
            </button>

            <button
              type="button"
              onClick={onCycleTheme}
              style={{ color: 'var(--text-secondary)' }}
              className="h-8 px-2.5 rounded-full hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
              title="Đổi nhanh chủ đề màu"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              />
              <Palette size={15} />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              style={{ color: 'var(--text-secondary)' }}
              className="w-8 h-8 rounded-full hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              title="Cài đặt"
            >
              <Settings size={15.5} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN SPACIOUS PLAYGROUNDS × CRAFT DOCUMENT GALLERY */}
      <main
        style={{
          paddingLeft: 'max(20px, env(safe-area-inset-left))',
          paddingRight: 'max(20px, env(safe-area-inset-right))',
          paddingBottom: 'calc(84px + max(10px, env(safe-area-inset-bottom)))'
        }}
        className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar"
      >
        <div className="max-w-[1120px] mx-auto pt-4 sm:pt-7 space-y-6">
          {/* ===== SECTION 1: SERENE EDITORIAL HEADER + 2 SCULPTED ACTIONS ===== */}
          <section
            style={{ transitionDelay: splashPhase !== 'done' ? '85ms' : undefined }}
            className="home-reveal-item flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-20"
          >
            <div className="min-w-0">
              <h1
                className="text-[28px] sm:text-[34px] font-bold tracking-[-0.03em] leading-[1.12] truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {getGreetingVi()}
              </h1>
              <p
                className="text-[12.5px] mt-1.5 flex items-center gap-1.5 truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>{files.length} tệp</span>
                <span className="opacity-40">·</span>
                <span>{formatBytes(totalSizeBytes)}</span>
                <span className="opacity-40">·</span>
                <span className="opacity-80">Lưu cục bộ</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {latestEditable && (
                <button
                  type="button"
                  onClick={() => onOpenFile(latestEditable)}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    boxShadow: '0 8px 20px -8px var(--accent-glow)'
                  }}
                  className="flex-1 sm:flex-none h-10 px-4 rounded-full text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95 transition-all max-w-[230px]"
                >
                  <span className="truncate">
                    Tiếp tục{latestItem ? ` · ${latestItem.name}` : ''}
                  </span>
                  <ArrowUpRight size={15} className="shrink-0 opacity-90" />
                </button>
              )}

              {/* CRAFT-STYLE "+ TẠO MỚI" POPOVER TRIGGER (NO PILL SOUP!) */}
              <div ref={createMenuRef} className="relative flex-1 sm:flex-none">
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen((prev) => !prev)}
                  style={{
                    backgroundColor: 'var(--bg-panel)',
                    color: 'var(--text-primary)',
                    boxShadow: surfaceShadow
                  }}
                  className="w-full sm:w-auto h-10 px-4 rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--bg-panel-alt)] active:scale-95 transition-all"
                >
                  <Plus size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>Tạo mới</span>
                  <ChevronDown
                    size={14}
                    style={{ color: 'var(--text-secondary)' }}
                    className={`transition-transform duration-200 ${
                      createMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* BORDERLESS FLOATING APPLE CREATION POPOVER */}
                {createMenuOpen && (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-panel)',
                      color: 'var(--text-primary)',
                      boxShadow:
                        '0 22px 54px -14px rgba(0,0,0,0.45), inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 7%, transparent)'
                    }}
                    className="absolute right-0 mt-2 w-[276px] rounded-[20px] p-2 z-50 backdrop-blur-2xl ios-modal-enter origin-top-right"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        setCreateModalOpen(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-[13px] flex items-center gap-3 text-left hover:bg-[var(--bg-panel-alt)] transition-colors"
                    >
                      <div
                        style={{
                          backgroundColor:
                            'color-mix(in srgb, var(--accent-primary) 14%, var(--bg-panel-alt))',
                          color: 'var(--accent-primary)'
                        }}
                        className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                      >
                        <FolderPlus size={15.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">Dự án mới...</div>
                        <div
                          className="text-[11px] truncate"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Thư mục nhiều tệp có mẫu sẵn
                        </div>
                      </div>
                    </button>

                    <div
                      className="my-1.5 mx-2 h-px"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--text-primary) 6%, transparent)'
                      }}
                    />

                    <div
                      className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] opacity-60"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Tạo nhanh tệp đơn
                    </div>

                    <div className="grid grid-cols-2 gap-1 px-0.5">
                      {quickTemplates.map((tpl) => (
                        <button
                          key={tpl.kind}
                          type="button"
                          onClick={() => {
                            setCreateMenuOpen(false);
                            onQuickStart(tpl.kind);
                          }}
                          className="px-2.5 py-2 rounded-[11px] flex items-center gap-2 text-left hover:bg-[var(--bg-panel-alt)] active:scale-[0.97] transition-all"
                        >
                          {tpl.badge}
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold leading-tight truncate">
                              {tpl.label}
                            </div>
                            <div
                              className="text-[9.5px] opacity-65 leading-tight truncate"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {tpl.sub}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div
                      className="my-1.5 mx-2 h-px"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--text-primary) 6%, transparent)'
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        importInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-[12px] flex items-center gap-2.5 text-[12.5px] font-medium hover:bg-[var(--bg-panel-alt)] transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <FileUp size={14.5} />
                      <span style={{ color: 'var(--text-primary)' }}>Nhập tệp từ máy...</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ===== SECTION 2: QUIET FILTER STRIP + PLAYGROUNDS CARD GALLERY ===== */}
          <section
            style={{ transitionDelay: splashPhase !== 'done' ? '145ms' : undefined }}
            className="home-reveal-item space-y-4"
          >
            {/* Ultra-Clean Gallery Control Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {filterOptions.map((opt) => {
                  const active = filter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilter(opt.id)}
                      style={{
                        backgroundColor: active ? 'var(--bg-panel)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: active ? surfaceShadow : undefined
                      }}
                      className={`h-8 px-3.5 rounded-full text-[12px] transition-all shrink-0 ${
                        active ? 'font-semibold' : 'font-medium hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div
                  style={{
                    backgroundColor: 'var(--bg-panel)',
                    boxShadow:
                      'inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 5.5%, transparent)'
                  }}
                  className="w-40 sm:w-52 h-8 px-3 rounded-full flex items-center gap-2 transition-shadow focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/35"
                >
                  <Search
                    size={13}
                    style={{ color: 'var(--text-secondary)' }}
                    className="shrink-0 opacity-65"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc tệp..."
                    style={{ color: 'var(--text-primary)' }}
                    className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:opacity-55"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ color: 'var(--text-secondary)' }}
                      className="hover:text-[var(--text-primary)]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Subtle Grid / List View Switcher */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-panel)',
                    boxShadow:
                      'inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 5.5%, transparent)'
                  }}
                  className="p-0.5 rounded-full flex items-center gap-0.5 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    style={{
                      backgroundColor: viewMode === 'grid' ? 'var(--bg-panel-alt)' : 'transparent',
                      color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    title="Thư viện thẻ (Gallery)"
                  >
                    <LayoutGrid size={13.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    style={{
                      backgroundColor: viewMode === 'list' ? 'var(--bg-panel-alt)' : 'transparent',
                      color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    title="Danh sách gọn (List)"
                  >
                    <List size={13.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* SYMMETRIC VISUAL GALLERY GRID OR CLEAN LIST */}
            {filteredItems.length === 0 ? (
              galleryItems.length === 0 ? (
                /* Empty Workspace: 4 Playgrounds Starter Cards */
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-5">
                  {(
                    [
                      {
                        kind: 'cpp',
                        title: 'C++ Thuật toán',
                        desc: 'GCC 14.2 + STL',
                        tint: '#3b82f6',
                        badge: <CppBadge size="w-7 h-7" />
                      },
                      {
                        kind: 'python',
                        title: 'Python 3',
                        desc: 'Pyodide Offline',
                        tint: '#10b981',
                        badge: <PythonBadge size="w-7 h-7" />
                      },
                      {
                        kind: 'web-starter',
                        title: 'Web Starter',
                        desc: 'Live Preview',
                        tint: '#ea580c',
                        badge: <HtmlBadge size="w-7 h-7" />
                      },
                      {
                        kind: 'javascript',
                        title: 'JavaScript',
                        desc: 'ES2024 Console',
                        tint: '#eab308',
                        badge: <JsBadge size="w-7 h-7" />
                      }
                    ] as const
                  ).map((starter) => (
                    <button
                      key={starter.kind}
                      type="button"
                      onClick={() => onQuickStart(starter.kind)}
                      style={{
                        background: `radial-gradient(150px circle at 90% 10%, color-mix(in srgb, ${starter.tint} 12%, transparent), transparent 72%), var(--bg-panel)`,
                        boxShadow: surfaceShadow
                      }}
                      className="rounded-[22px] p-5 text-left flex flex-col justify-between gap-6 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300"
                    >
                      <div
                        style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                        className="w-12 h-12 rounded-[15px] flex items-center justify-center"
                      >
                        {starter.badge}
                      </div>
                      <div>
                        <div className="text-[14.5px] font-bold">{starter.title}</div>
                        <div
                          className="text-[11.5px] mt-0.5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {starter.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--bg-panel)',
                    boxShadow: surfaceShadow
                  }}
                  className="rounded-[22px] py-14 px-6 text-center space-y-3"
                >
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {searchQuery
                      ? `Không tìm thấy tệp nào khớp "${searchQuery}"`
                      : 'Chưa có tệp nào trong nhóm này.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilter('all');
                    }}
                    style={{
                      backgroundColor: 'var(--bg-panel-alt)',
                      color: 'var(--text-primary)'
                    }}
                    className="h-8 px-4 rounded-full text-[12px] font-semibold hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Hiển thị tất cả
                  </button>
                </div>
              )
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
                {filteredItems.map((item, idx) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    isLatest={latestItem?.id === item.id}
                    index={idx}
                    surfaceShadow={surfaceShadow}
                    splashPhase={splashPhase}
                    allowStagger={allowPopAnimation}
                    onOpen={() => {
                      if (item.entryFile) onOpenFile(item.entryFile);
                      else onOpenProjects();
                    }}
                    onOpenActionSheet={() => setActionTarget(item)}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  boxShadow: surfaceShadow
                }}
                className="rounded-[22px] p-2 space-y-0.5 overflow-hidden"
              >
                {filteredItems.map((item, idx) => (
                  <ProjectListRow
                    key={item.id}
                    item={item}
                    isLatest={latestItem?.id === item.id}
                    index={idx}
                    isSwiped={swipedRowId === item.id}
                    onSetSwiped={setSwipedRowId}
                    onOpen={() => {
                      setSwipedRowId(null);
                      if (item.entryFile) onOpenFile(item.entryFile);
                      else onOpenProjects();
                    }}
                    onOpenActionSheet={() => {
                      setSwipedRowId(null);
                      setActionTarget(item);
                    }}
                    onPin={() => onTogglePin(item.path)}
                    onExportZip={() => onExportProjectZip(item.path, item.isFolder)}
                    onDelete={() => onDeleteEntry(item.path)}
                  />
                ))}
              </div>
            )}

            {/* WHISPER-QUIET FOOTER UTILITIES */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 pt-2 px-1 text-[11.5px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100 hover:text-[var(--text-primary)] transition-all"
              >
                <FileUp size={12.5} />
                <span>Nhập tệp từ máy</span>
              </button>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100 hover:text-[var(--text-primary)] transition-all"
                >
                  <Download size={12.5} />
                  <span>Sao lưu</span>
                </button>
                <label className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100 hover:text-[var(--text-primary)] transition-all cursor-pointer">
                  <Upload size={12.5} />
                  <span>Khôi phục</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportBackup(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* SLEEK ICON-ONLY FLOATING DOCK BAR */}
      <nav
        aria-label="Điều hướng nhanh"
        style={{
          paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom) - 6px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))'
        }}
        className="home-reveal-nav fixed inset-x-0 bottom-0 select-none pt-1 z-30 pointer-events-none"
      >
        <div className="apple-liquid-dock pointer-events-auto relative w-fit mx-auto rounded-full p-1.5 overflow-hidden">
          {/* Ánh khúc xạ kính lỏng mảnh ở mép trên & quầng màu dịu phía sau icon */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-0 h-[1px] opacity-80"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-primary) 45%, #ffffff) 50%, transparent 100%)'
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 left-2 w-16 h-12 rounded-full blur-xl opacity-55"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 34%, transparent)'
            }}
          />

          <div className="relative z-10 flex items-center gap-1">
            <button
              type="button"
              aria-label="Trang chủ"
              title="Trang chủ"
              style={{ color: 'var(--accent-primary)' }}
              className="apple-liquid-dock-active relative z-10 w-11 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
            >
              <Home size={18} strokeWidth={2.2} className="ios-nav-icon-active" />
            </button>

            <button
              type="button"
              aria-label="Dự án"
              title="Dự án"
              onClick={onOpenProjects}
              style={{ color: 'var(--text-secondary)' }}
              className="relative z-10 w-11 h-9 rounded-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
            >
              <Folder size={18} strokeWidth={1.85} />
            </button>

            <button
              type="button"
              aria-label="Chạy mã nguồn"
              title="Chạy mã nguồn"
              onClick={onRunActive}
              style={{ color: 'var(--text-secondary)' }}
              className="relative z-10 w-11 h-9 rounded-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
            >
              <Play size={18} strokeWidth={1.85} />
            </button>

            <button
              type="button"
              aria-label="Cài đặt & Thêm"
              title="Cài đặt & Thêm"
              onClick={onOpenSettings}
              style={{ color: 'var(--text-secondary)' }}
              className="relative z-10 w-11 h-9 rounded-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] hover:text-[var(--text-primary)] active:scale-95 transition-all"
            >
              <MoreHorizontal size={18} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </nav>

      {/* BORDERLESS APPLE ACTION SHEET FOR PROJECT OPTIONS */}
      {actionTarget && (
        <div
          onClick={() => setActionTarget(null)}
          style={{
            paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))'
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center pt-3 ios-backdrop-enter"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow:
                '0 24px 60px -16px rgba(0,0,0,0.45), inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 7%, transparent)'
            }}
            className="w-full max-w-sm rounded-[24px] overflow-hidden ios-modal-enter"
          >
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
              <span
                className="w-9 h-1 rounded-full opacity-30"
                style={{ backgroundColor: 'var(--text-secondary)' }}
              />
            </div>

            <div
              style={{
                borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)'
              }}
              className="px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                  className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
                >
                  {actionTarget.isFolder ? (
                    <BlueFolderIcon size="w-5 h-4" />
                  ) : (
                    <FileTypeIcon fileName={actionTarget.name} size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate">{actionTarget.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {actionTarget.timeLabel} · {actionTarget.sizeLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-secondary)' }}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-2 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  if (t.entryFile) onOpenFile(t.entryFile);
                  else onOpenProjects();
                }}
                className="w-full px-3.5 py-2.5 rounded-[14px] text-[13.5px] font-medium flex items-center gap-3 hover:bg-[var(--bg-panel-alt)] transition-colors"
              >
                <ExternalLink size={15.5} style={{ color: 'var(--accent-primary)' }} />
                <span>Mở trong trình soạn thảo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  onTogglePin(t.path);
                }}
                className="w-full px-3.5 py-2.5 rounded-[14px] text-[13.5px] font-medium flex items-center gap-3 hover:bg-[var(--bg-panel-alt)] transition-colors"
              >
                {actionTarget.isPinned ? (
                  <PinOff size={15.5} className="text-amber-400" />
                ) : (
                  <Pin size={15.5} className="text-amber-400" />
                )}
                <span>{actionTarget.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu danh sách'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  setRenameTarget(t);
                  setRenameValue(t.name);
                }}
                className="w-full px-3.5 py-2.5 rounded-[14px] text-[13.5px] font-medium flex items-center gap-3 hover:bg-[var(--bg-panel-alt)] transition-colors"
              >
                <Pencil size={15.5} className="text-violet-400" />
                <span>Đổi tên</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  onExportProjectZip(t.path, t.isFolder);
                }}
                className="w-full px-3.5 py-2.5 rounded-[14px] text-[13.5px] font-medium flex items-center gap-3 hover:bg-[var(--bg-panel-alt)] transition-colors"
              >
                <FileArchive size={15.5} className="text-emerald-400" />
                <span>Xuất tệp .ZIP</span>
              </button>

              <div
                className="pt-1 mt-1"
                style={{
                  borderTop: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const t = actionTarget;
                    setActionTarget(null);
                    onDeleteEntry(t.path);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-[14px] text-[13.5px] font-semibold flex items-center gap-3 text-rose-400 hover:bg-rose-500/12 transition-colors"
                >
                  <Trash2 size={15.5} />
                  <span>Xóa {actionTarget.isFolder ? 'dự án' : 'tệp'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BORDERLESS CREATE NEW PROJECT MODAL */}
      {createModalOpen && (
        <div
          onClick={() => setCreateModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 ios-backdrop-enter"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitCreateProject}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow:
                '0 24px 60px -16px rgba(0,0,0,0.45), inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 7%, transparent)'
            }}
            className="w-full max-w-md rounded-[24px] p-5 space-y-4 ios-modal-enter"
          >
            <div className="sm:hidden flex justify-center -mt-2 mb-1">
              <span
                className="w-10 h-1 rounded-full opacity-30"
                style={{ backgroundColor: 'var(--text-secondary)' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold tracking-tight">Tạo dự án mới</h3>
                <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Khởi tạo thư mục và mã nguồn mẫu sẵn sàng chạy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-secondary)' }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11.5px] font-semibold block"
                style={{ color: 'var(--text-secondary)' }}
              >
                Tên dự án
              </label>
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="VD: WebPortfolio, BaiTapDSA..."
                style={{
                  backgroundColor: 'var(--bg-panel-alt)',
                  color: 'var(--text-primary)'
                }}
                className="w-full h-10 px-3.5 rounded-[14px] text-[13.5px] outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/45 transition-shadow"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11.5px] font-semibold block"
                style={{ color: 'var(--text-secondary)' }}
              >
                Mẫu khởi tạo
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'web',
                      title: 'Web Live',
                      desc: 'HTML · CSS · JS',
                      icon: <HtmlBadge size="w-4 h-4" />
                    },
                    {
                      id: 'cpp',
                      title: 'C++ Thuật toán',
                      desc: 'GCC 14.2 + STL',
                      icon: <CppBadge size="w-4 h-4" />
                    },
                    {
                      id: 'cpp-oop',
                      title: 'C++ OOP',
                      desc: 'Nhiều tệp + Header',
                      icon: <CppBadge size="w-4 h-4" />
                    },
                    {
                      id: 'python',
                      title: 'Python 3',
                      desc: 'Pyodide Offline',
                      icon: <PythonBadge size="w-4 h-4" />
                    },
                    {
                      id: 'javascript',
                      title: 'JavaScript',
                      desc: 'ES2024 Console',
                      icon: <JsBadge size="w-4 h-4" />
                    }
                  ] as Array<{
                    id: NewProjectTemplate;
                    title: string;
                    desc: string;
                    icon: React.ReactNode;
                  }>
                ).map((tpl) => {
                  const selected = newProjectTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setNewProjectTemplate(tpl.id)}
                      style={{
                        backgroundColor: selected
                          ? 'color-mix(in srgb, var(--accent-primary) 13%, var(--bg-panel-alt))'
                          : 'var(--bg-panel-alt)',
                        boxShadow: selected
                          ? 'inset 0 0 0 1.5px var(--accent-primary)'
                          : 'inset 0 0 0 1.5px transparent'
                      }}
                      className="p-3 rounded-[15px] text-left flex items-center gap-2.5 transition-all active:scale-[0.98]"
                    >
                      {tpl.icon}
                      <div className="min-w-0">
                        <div
                          className="text-[12.5px] font-semibold truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {tpl.title}
                        </div>
                        <div
                          className="text-[10.5px] truncate"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {tpl.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              style={{
                backgroundColor: 'var(--accent-primary)',
                boxShadow: '0 8px 22px -8px var(--accent-glow)'
              }}
              className="w-full h-10 rounded-[14px] text-white text-[13.5px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {creating ? 'Đang khởi tạo...' : 'Tạo & Mở ngay'}
            </button>
          </form>
        </div>
      )}

      {/* BORDERLESS RENAME MODAL */}
      {renameTarget && (
        <div
          onClick={() => setRenameTarget(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 ios-backdrop-enter"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitRename}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow:
                '0 24px 60px -16px rgba(0,0,0,0.45), inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 7%, transparent)'
            }}
            className="w-full max-w-sm rounded-[24px] p-5 space-y-4 ios-modal-enter"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15.5px] font-bold tracking-tight">
                Đổi tên {renameTarget.isFolder ? 'dự án' : 'tệp'}
              </h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-secondary)' }}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-panel-alt)',
                color: 'var(--text-primary)'
              }}
              className="w-full h-10 px-3.5 rounded-[14px] text-[13.5px] outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/45 transition-shadow"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{ backgroundColor: 'var(--bg-panel-alt)', color: 'var(--text-secondary)' }}
                className="flex-1 h-10 rounded-[14px] text-[13px] font-semibold hover:text-[var(--text-primary)] transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                className="flex-1 h-10 rounded-[14px] text-white text-[13px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Lưu tên mới
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
