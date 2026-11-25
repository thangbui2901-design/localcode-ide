import React, { useMemo, useRef, useState } from 'react';
import {
  Menu,
  Settings,
  FolderOpen,
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
  Sparkles,
  Layers,
  Code2,
  Pin,
  PinOff,
  Pencil,
  FileArchive,
  FileUp,
  LayoutGrid,
  List,
  ChevronRight,
  Clock
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

interface RecentProjectItem {
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
  previewLine: string;
  entryFile: WorkspaceFile | null;
}

/* ==================== CRISP OFFICIAL-STYLE SVG BADGES ==================== */

const PythonBadge: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0 drop-shadow-xs`}>
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

const JsBadge: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0 drop-shadow-xs`}>
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

const CppBadge: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0 drop-shadow-xs`}>
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

const HtmlBadge: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0 drop-shadow-xs`}>
    <path fill="#E34F26" d="M8 6h32l-3 33-13 4-13-4L8 6z" />
    <path fill="#EF652A" d="M24 9v31l10.5-3.1L37 9H24z" />
    <path
      fill="#FFFFFF"
      d="M15.5 14.5h17l-.5 4.2H19.8l.4 4.3h11.3l-1 10.6-6.5 1.9-6.5-1.9-.4-4.9h4.1l.2 2.4 2.6.7 2.6-.7.3-3.9H16.5l-1-12.7z"
    />
  </svg>
);

const CssBadge: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" className={`${size} shrink-0 drop-shadow-xs`}>
    <path fill="#1572B6" d="M8 6h32l-3 33-13 4-13-4L8 6z" />
    <path fill="#33A9DC" d="M24 9v31l10.5-3.1L37 9H24z" />
    <path
      fill="#FFFFFF"
      d="M15.5 14.5h17l-.4 4.2H20.1l.3 3.9h11.2l-1 11-6.6 1.9-6.6-1.9-.4-4.7h4.1l.2 2.3 2.7.7 2.7-.7.3-4.3H16.6l-1.1-12.4z"
    />
  </svg>
);

const BlueFolderIcon: React.FC = () => (
  <svg viewBox="0 0 36 30" className="w-8 h-7 shrink-0">
    <defs>
      <linearGradient id="proFolderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <path
      d="M3 6.5C3 4.567 4.567 3 6.5 3h7.2c1.1 0 2.13.52 2.79 1.4l1.42 1.9c.38.5.97.8 1.6.8H29.5C31.433 7.1 33 8.667 33 10.6V23.5c0 1.933-1.567 3.5-3.5 3.5h-23C4.567 27 3 25.433 3 23.5v-17Z"
      fill="url(#proFolderGrad)"
    />
    <path
      d="M3 11.5h30v12c0 1.933-1.567 3.5-3.5 3.5h-23C4.567 27 3 25.433 3 23.5v-12Z"
      fill="#93C5FD"
      opacity="0.22"
    />
  </svg>
);

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
      return 'File';
  }
}

function extractPreviewLine(file: WorkspaceFile | null): string {
  if (!file || file.language === 'asset' || file.content.startsWith('data:')) return '';
  const firstMeaningful = file.content
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('#!'));
  return firstMeaningful ? firstMeaningful.slice(0, 64) : '';
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

/* ==================== CLEAN SWIPEABLE LIST ROW (ZERO EDGE BLEED!) ==================== */

const SWIPE_ACTION_WIDTH = 162;

interface ProjectListRowProps {
  item: RecentProjectItem;
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
  // CHỈ render khay nút màu khi thực sự đang vuốt -> 100% KHÔNG lộ viền đỏ ở cạnh bo tròn!
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
      style={{ animationDelay: `${140 + Math.min(index, 6) * 40}ms` }}
      className="home-stagger relative overflow-hidden first:rounded-t-2xl last:rounded-b-2xl"
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
            className="flex-1 bg-amber-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
          >
            {item.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            <span>{item.isPinned ? 'Bỏ ghim' : 'Ghim'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSetSwiped(null);
              onExportZip();
            }}
            className="flex-1 bg-emerald-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
          >
            <FileArchive size={14} />
            <span>ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSetSwiped(null);
              onDelete();
            }}
            className="flex-1 bg-rose-500 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
          >
            <Trash2 size={14} />
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
          backgroundColor: 'var(--bg-panel)',
          transform: `translate3d(${currentX}px, 0, 0)`,
          transition: dragOffset === null ? 'transform 0.34s var(--ease-ios-spring)' : 'none'
        }}
        className="relative z-10 px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-elevated)]/60 transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          >
            {item.isFolder ? <BlueFolderIcon /> : <FileTypeIcon fileName={item.name} size={22} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {item.name}
              </span>
              {item.isPinned && (
                <Pin size={11} className="text-amber-400 shrink-0 fill-amber-400/75" />
              )}
              <span
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                className="hidden sm:inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
              >
                {item.isFolder ? `${item.fileCount} tệp` : item.langBadge}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              <span>{item.timeLabel}</span>
              <span>•</span>
              <span>{item.sizeLabel}</span>
              {item.previewLine && (
                <>
                  <span className="hidden md:inline">•</span>
                  <code className="hidden md:inline font-mono text-[10px] opacity-70 truncate">
                    {item.previewLine}
                  </code>
                </>
              )}
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
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors shrink-0 btn-lift"
          title="Tùy chọn dự án"
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
    </div>
  );
};

/* ==================== MAIN PRO HOME SCREEN ==================== */

export const HomeScreen: React.FC<HomeScreenProps> = ({
  breakpoint,
  tree,
  files,
  pinnedPaths,
  themeSwatch,
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    breakpoint === 'desktop' ? 'grid' : 'list'
  );
  const [showMoreTemplates, setShowMoreTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<RecentProjectItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState<NewProjectTemplate>('web');
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RecentProjectItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const isWide = breakpoint !== 'mobile';
  const pinnedSet = useMemo(() => new Set(pinnedPaths), [pinnedPaths]);

  const recentProjects = useMemo<RecentProjectItem[]>(() => {
    const items: RecentProjectItem[] = [];

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
          langBadge: preferred ? getLangBadgeLabel(preferred.language) : 'Folder',
          previewLine: extractPreviewLine(preferred),
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
          previewLine: extractPreviewLine(node.file),
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

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return recentProjects.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (filter === 'folders') return item.isFolder;
      if (filter === 'cpp') return item.langCategory === 'cpp';
      if (filter === 'python') return item.langCategory === 'python';
      if (filter === 'web') return item.langCategory === 'web';
      return true;
    });
  }, [recentProjects, searchQuery, filter]);

  const totalSizeBytes = useMemo(
    () => files.reduce((sum, f) => sum + new Blob([f.content]).size, 0),
    [files]
  );

  const latestEditable = recentProjects[0]?.entryFile || files[0] || null;

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
    engine: string;
    badge: React.ReactNode;
  }> = [
    { kind: 'python', label: 'Python 3', engine: 'Pyodide WASM', badge: <PythonBadge /> },
    { kind: 'javascript', label: 'JavaScript', engine: 'ES2024', badge: <JsBadge /> },
    { kind: 'cpp', label: 'C++', engine: 'GCC 14.2', badge: <CppBadge /> },
    { kind: 'html', label: 'HTML5', engine: 'Live Preview', badge: <HtmlBadge /> },
    { kind: 'css', label: 'CSS3', engine: 'Hot Reload', badge: <CssBadge /> }
  ];

  // Chỉ chạy ios-view-pop khi HomeScreen được mở lại từ Editor (KHÔNG chạy sau khi Welcome Screen kết thúc -> 0 giật!)
  const mountedWithSplashRef = useRef(splashPhase !== 'done');
  if (splashPhase === 'active') {
    mountedWithSplashRef.current = true;
  }
  const allowPopAnimation =
    !mountedWithSplashRef.current && splashPhase === 'done' && !isNativeMotionAvailable();

  const filterOptions: Array<{ id: ProjectFilter; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'folders', label: 'Thư mục' },
    { id: 'cpp', label: 'C / C++' },
    { id: 'python', label: 'Python' },
    { id: 'web', label: 'Web' }
  ];

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
      {/* PRO STUDIO TOP HEADER — FULL-BLEED EDGE-TO-EDGE (KHÔNG LẸM 2 BÊN KHI XOAY NGANG) */}
      <header
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))'
        }}
        className="glass-surface home-reveal-header w-full shrink-0 relative z-20"
      >
        <div className="h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenProjects}
            style={{ color: 'var(--text-primary)' }}
            className="home-reveal-header-chrome w-9 h-9 rounded-xl hover:bg-[var(--bg-panel)] flex items-center justify-center shrink-0 btn-lift"
            title="Mở Workspace Explorer"
          >
            <Menu size={20} />
          </button>

          <button
            type="button"
            onClick={onReplaySplash}
            className="flex items-center gap-2.5 min-w-0 group"
            title="Bấm để xem lại hoạt họa logo"
          >
            <img
              data-home-logo="true"
              src="/app-logo.png"
              alt="Code With You"
              className="home-reveal-logo w-7 h-7 rounded-lg object-contain shrink-0 group-active:scale-90 transition-transform"
            />
            <span
              className="home-reveal-header-chrome text-[15px] font-bold tracking-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              Code With You
            </span>
          </button>
        </div>

        <div className="home-reveal-header-chrome flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-secondary)'
            }}
            className="hidden sm:flex h-9 px-3 rounded-xl hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] items-center gap-2 text-xs font-medium btn-lift"
            title="Tìm nhanh & Command Palette (Cmd+P)"
          >
            <Search size={14} className="opacity-80" />
            <span className="hidden md:inline text-xs">Tìm nhanh</span>
            <kbd
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              className="hidden md:inline-block px-1.5 py-0.5 rounded-md font-mono text-[10px]"
            >
              ⌘P
            </kbd>
          </button>

          <button
            type="button"
            onClick={onCycleTheme}
            style={{ color: 'var(--text-primary)' }}
            className="hidden sm:flex h-9 px-2.5 rounded-xl hover:bg-[var(--bg-panel)] items-center gap-1.5 text-xs font-medium btn-lift"
            title="Đổi nhanh chủ đề màu"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />
            <Palette size={15} />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            style={{ color: 'var(--text-primary)' }}
            className="w-9 h-9 rounded-xl hover:bg-[var(--bg-panel)] flex items-center justify-center btn-lift"
            title="Cài đặt"
          >
            <Settings size={19} />
          </button>
        </div>
        </div>
      </header>

      {/* MAIN SCROLLABLE PRO LAUNCHPAD — FULL-HEIGHT TRÀN ĐÁY MÀN HÌNH, CUỘN MƯỢT DƯỚI THANH BAR NỔI */}
      <main
        style={{
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))',
          paddingBottom: 'calc(96px + max(10px, env(safe-area-inset-bottom)))'
        }}
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-5 sm:pt-7"
      >
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-7">
          {/* ===== SECTION 1: CLEAN EDITORIAL HERO HEADER ===== */}
          <section
            style={{ transitionDelay: splashPhase !== 'done' ? '30ms' : undefined }}
            className="home-reveal-item flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-1"
          >
            {/* Left Minimal Greeting + Useful Stats */}
            <div className="min-w-0">
              <h1
                className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {getGreetingVi()}
              </h1>
              <p
                className="text-xs sm:text-[13px] mt-1 flex items-center gap-1.5 truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="shrink-0">{files.length} tệp</span>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">{formatBytes(totalSizeBytes)}</span>
                {latestEditable && (
                  <>
                    <span className="opacity-40 shrink-0">·</span>
                    <span className="truncate">Gần nhất: {latestEditable.name}</span>
                  </>
                )}
              </p>
            </div>

            {/* Right Clean Primary Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (latestEditable) onOpenFile(latestEditable);
                  else onOpenProjects();
                }}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  boxShadow: '0 8px 20px -8px var(--accent-glow)'
                }}
                className="flex-1 sm:flex-none h-10 px-4 rounded-xl text-white text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all btn-lift"
              >
                <FolderOpen size={15} />
                <span>{latestEditable ? 'Tiếp tục code' : 'Mở dự án'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-card)'
                }}
                className="flex-1 sm:flex-none h-10 px-3.5 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--bg-elevated)] transition-colors btn-lift"
              >
                <Plus size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Dự án mới</span>
              </button>

              <label
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-card)'
                }}
                className="h-10 px-3 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer btn-lift"
                title="Nhập tệp code lẻ từ iPad Files / PC"
              >
                <FileUp size={15} style={{ color: 'var(--text-secondary)' }} />
                <span className="hidden md:inline">Mở tệp</span>
                <input
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
              </label>
            </div>
          </section>

          {/* ===== SECTION 2: PRO QUICK START TEMPLATES ===== */}
          <section
            style={{ transitionDelay: splashPhase !== 'done' ? '80ms' : undefined }}
            className="home-reveal-item space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Khởi tạo nhanh
              </h2>
              <button
                type="button"
                onClick={() => setShowMoreTemplates((v) => !v)}
                className="text-xs font-semibold flex items-center gap-0.5 text-sky-400 hover:text-sky-300 transition-colors"
              >
                <span>{showMoreTemplates ? 'Thu gọn' : 'Mẫu nâng cao'}</span>
                <ChevronRight
                  size={14}
                  className={`transition-transform duration-300 ${showMoreTemplates ? 'rotate-90' : ''}`}
                />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {quickTemplates.map((tpl, idx) => (
                <button
                  key={tpl.kind}
                  type="button"
                  onPointerMove={handleSpotlightMove}
                  onPointerLeave={handleSpotlightLeave}
                  onClick={() => onQuickStart(tpl.kind)}
                  style={{
                    backgroundColor: 'var(--bg-panel)',
                    boxShadow: 'var(--shadow-card)',
                    transitionDelay: splashPhase !== 'done' ? `${90 + idx * 28}ms` : undefined
                  }}
                  className="home-reveal-item spotlight-card glass-surface rounded-2xl p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left hover:bg-[var(--bg-elevated)] btn-lift"
                >
                  {tpl.badge}
                  <div className="min-w-0">
                    <div
                      className="text-[11px] sm:text-xs font-bold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {tpl.label}
                    </div>
                    <div
                      className="hidden md:block text-[10px] truncate mt-0.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {tpl.engine}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {showMoreTemplates && (
              <div className="grid grid-cols-3 gap-2.5 pt-0.5 tab-content-enter">
                <button
                  type="button"
                  onClick={() => onQuickStart('web-starter')}
                  style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                  className="glass-surface h-11 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--bg-elevated)] btn-lift"
                >
                  <Layers size={14} className="text-sky-400 shrink-0" />
                  <span className="truncate">Web Starter (3 tệp)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickStart('cpp-oop')}
                  style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                  className="glass-surface h-11 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--bg-elevated)] btn-lift"
                >
                  <Sparkles size={14} className="text-violet-400 shrink-0" />
                  <span className="truncate">C++ Class OOP</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickStart('c')}
                  style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                  className="glass-surface h-11 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--bg-elevated)] btn-lift"
                >
                  <Code2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">GCC C17 Chuẩn</span>
                </button>
              </div>
            )}
          </section>

          {/* ===== SECTION 3: RECENT PROJECTS WORKSPACE BROWSER ===== */}
          <section
            style={{ transitionDelay: splashPhase !== 'done' ? '140ms' : undefined }}
            className="home-reveal-item space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <h2 className="text-sm font-bold tracking-tight shrink-0 mr-1" style={{ color: 'var(--text-primary)' }}>
                  Dự án gần đây
                </h2>
                <div className="flex items-center gap-1 shrink-0">
                  {filterOptions.map((opt) => {
                    const active = filter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilter(opt.id)}
                        style={{
                          backgroundColor: active ? 'var(--bg-active)' : 'var(--bg-panel)',
                          color: active ? 'var(--accent-primary)' : 'var(--text-secondary)'
                        }}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Compact Inline Search */}
                <div
                  style={{ backgroundColor: 'var(--bg-panel)' }}
                  className="flex-1 sm:w-52 h-8 px-3 rounded-xl flex items-center gap-2"
                >
                  <Search size={13} style={{ color: 'var(--text-secondary)' }} className="shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc nhanh..."
                    style={{ color: 'var(--text-primary)' }}
                    className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:opacity-60"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Grid / List View Switcher (iPad / Desktop) */}
                {isWide && (
                  <div
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    className="p-0.5 rounded-xl flex items-center gap-0.5 shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      style={{
                        backgroundColor: viewMode === 'grid' ? 'var(--bg-elevated)' : 'transparent',
                        color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      title="Dạng lưới (Grid)"
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      style={{
                        backgroundColor: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent',
                        color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      title="Dạng danh sách (List)"
                    >
                      <List size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PROJECT LIST OR PRO CARD GRID */}
            {filteredProjects.length === 0 ? (
              <div
                style={{ backgroundColor: 'var(--bg-panel)' }}
                className="glass-surface rounded-2xl py-10 px-4 text-center space-y-2"
              >
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {searchQuery
                    ? `Không tìm thấy mục nào khớp "${searchQuery}"`
                    : 'Chưa có tệp nào trong nhóm này. Chọn một ngôn ngữ ở trên để tạo mới!'}
                </p>
              </div>
            ) : isWide && viewMode === 'grid' ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProjects.map((item, idx) => (
                  <div
                    key={item.id}
                    onPointerMove={handleSpotlightMove}
                    onPointerLeave={handleSpotlightLeave}
                    onClick={() => {
                      if (item.entryFile) onOpenFile(item.entryFile);
                      else onOpenProjects();
                    }}
                    style={{
                      backgroundColor: 'var(--bg-panel)',
                      boxShadow: 'var(--shadow-card)',
                      animationDelay: `${140 + Math.min(idx, 8) * 38}ms`
                    }}
                    className="home-stagger spotlight-card glass-surface rounded-2xl p-4 flex flex-col justify-between gap-3 cursor-pointer hover:bg-[var(--bg-elevated)]/70 transition-all btn-lift"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        >
                          {item.isFolder ? (
                            <BlueFolderIcon />
                          ) : (
                            <FileTypeIcon fileName={item.name} size={22} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="text-sm font-bold truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {item.name}
                            </span>
                            {item.isPinned && (
                              <Pin size={11} className="text-amber-400 shrink-0 fill-amber-400/75" />
                            )}
                          </div>
                          <span
                            style={{ color: 'var(--text-secondary)' }}
                            className="text-[11px] flex items-center gap-1 mt-0.5"
                          >
                            <Clock size={10} className="opacity-70" />
                            {item.timeLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionTarget(item);
                        }}
                        style={{ color: 'var(--text-secondary)' }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] shrink-0"
                        title="Tùy chọn"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {/* Mini code preview line for pro developer feel */}
                    <div
                      style={{ backgroundColor: 'var(--bg-panel-alt)' }}
                      className="px-2.5 py-2 rounded-xl font-mono text-[11px] truncate"
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.previewLine || (item.isFolder ? `${item.fileCount} tệp trong dự án` : 'Tệp trống')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      <span
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                        className="px-2 py-0.5 rounded-md font-semibold text-[10px]"
                      >
                        {item.isFolder ? `${item.fileCount} tệp` : item.langBadge}
                      </span>
                      <span>{item.sizeLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  boxShadow: 'var(--shadow-card)'
                }}
                className="glass-surface rounded-2xl overflow-hidden divide-y divide-white/[0.04]"
              >
                {filteredProjects.map((item, idx) => (
                  <ProjectListRow
                    key={item.id}
                    item={item}
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
          </section>

          {/* COMPACT WORKSPACE UTILITY FOOTER (BACKUP / RESTORE) */}
          <section
            style={{
              backgroundColor: 'var(--bg-panel)',
              transitionDelay: splashPhase !== 'done' ? '185ms' : undefined
            }}
            className="home-reveal-item glass-surface rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Dữ liệu lưu cục bộ trên máy • <strong style={{ color: 'var(--text-primary)' }}>{files.length} tệp</strong> ({formatBytes(totalSizeBytes)})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-8 px-3 rounded-xl font-semibold flex items-center gap-1.5 btn-lift"
              >
                <Download size={13} className="text-sky-400" />
                <span>Sao lưu</span>
              </button>
              <label
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-8 px-3 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer btn-lift"
              >
                <Upload size={13} className="text-emerald-400" />
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
          </section>
        </div>
      </main>

      {/* FLOATING ROUNDED PILL BOTTOM TAB BAR — NỔI THẬT TRÊN FULL MÀN HÌNH, SÁT HOME INDICATOR */}
      <nav
        style={{
          paddingBottom: 'max(10px, calc(env(safe-area-inset-bottom) - 10px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))'
        }}
        className="home-reveal-nav fixed inset-x-0 bottom-0 select-none pt-1 z-30 pointer-events-none"
      >
        <div
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-panel) 84%, transparent)',
            border: '1px solid var(--border-subtle)',
            boxShadow:
              '0 14px 36px -8px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
          }}
          className="pointer-events-auto relative max-w-md mx-auto rounded-full p-1.5 backdrop-blur-lg"
        >
          <div className="relative flex items-center">
            {/* Viên thuốc nền bo tròn cho mục đang chọn */}
            <div
              aria-hidden="true"
              style={{ width: '25%' }}
              className="absolute inset-y-0 left-0 pointer-events-none"
            >
              <div
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--text-primary) 11%, transparent)'
                }}
                className="w-full h-full rounded-full"
              />
            </div>

            <button
              type="button"
              style={{ color: 'var(--accent-primary)' }}
              className="relative z-10 flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
            >
              <Home size={20} strokeWidth={2.25} className="ios-nav-icon-active" />
              <span className="text-[10px] font-bold leading-none">Trang chủ</span>
            </button>

            <button
              type="button"
              onClick={onOpenProjects}
              style={{ color: 'var(--text-secondary)' }}
              className="relative z-10 flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 hover:text-[var(--text-primary)] active:scale-95 transition-all"
            >
              <Folder size={20} strokeWidth={1.85} />
              <span className="text-[10px] font-medium leading-none">Dự án</span>
            </button>

            <button
              type="button"
              onClick={onRunActive}
              style={{ color: 'var(--text-secondary)' }}
              className="relative z-10 flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 hover:text-[var(--text-primary)] active:scale-95 transition-all"
            >
              <Play size={20} strokeWidth={1.85} />
              <span className="text-[10px] font-medium leading-none">Chạy</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              style={{ color: 'var(--text-secondary)' }}
              className="relative z-10 flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 hover:text-[var(--text-primary)] active:scale-95 transition-all"
            >
              <MoreHorizontal size={20} strokeWidth={1.85} />
              <span className="text-[10px] font-medium leading-none">Thêm</span>
            </button>
          </div>
        </div>
      </nav>

      {/* NATIVE iOS ACTION SHEET FOR PROJECT OPTIONS (KHÔNG BAO GIỜ BỊ ĐÈ HAY CẮT!) */}
      {actionTarget && (
        <div
          onClick={() => setActionTarget(null)}
          style={{
            paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))'
          }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center pt-3 ios-backdrop-enter"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border-subtle)'
            }}
            className="w-full max-w-sm rounded-3xl overflow-hidden ios-modal-enter"
          >
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
              <span
                className="w-9 h-1 rounded-full opacity-35"
                style={{ backgroundColor: 'var(--text-secondary)' }}
              />
            </div>

            <div
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
              className="px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {actionTarget.isFolder ? (
                  <BlueFolderIcon />
                ) : (
                  <FileTypeIcon fileName={actionTarget.name} size={22} />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{actionTarget.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {actionTarget.timeLabel} • {actionTarget.sizeLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  if (t.entryFile) onOpenFile(t.entryFile);
                  else onOpenProjects();
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-3 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <ExternalLink size={16} className="text-sky-400" />
                <span>Mở trong trình soạn thảo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  onTogglePin(t.path);
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-3 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                {actionTarget.isPinned ? (
                  <PinOff size={16} className="text-amber-400" />
                ) : (
                  <Pin size={16} className="text-amber-400" />
                )}
                <span>{actionTarget.isPinned ? 'Bỏ ghim dự án' : 'Ghim lên đầu danh sách'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  setRenameTarget(t);
                  setRenameValue(t.name);
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-3 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Pencil size={16} className="text-violet-400" />
                <span>Đổi tên</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = actionTarget;
                  setActionTarget(null);
                  onExportProjectZip(t.path, t.isFolder);
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-3 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <FileArchive size={16} className="text-emerald-400" />
                <span>Xuất file .ZIP</span>
              </button>

              <div className="pt-1 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => {
                    const t = actionTarget;
                    setActionTarget(null);
                    onDeleteEntry(t.path);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 text-rose-400 hover:bg-rose-500/15 transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Xóa {actionTarget.isFolder ? 'dự án' : 'tệp'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW PROJECT MODAL */}
      {createModalOpen && (
        <div
          onClick={() => setCreateModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 ios-backdrop-enter"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitCreateProject}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border-subtle)'
            }}
            className="w-full max-w-md rounded-3xl p-5 space-y-4 ios-modal-enter"
          >
            <div className="sm:hidden flex justify-center -mt-2 mb-1">
              <span
                className="w-10 h-1 rounded-full opacity-40"
                style={{ backgroundColor: 'var(--text-secondary)' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Tạo dự án mới</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  Khởi tạo thư mục và mã nguồn mẫu sẵn sàng chạy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                className="w-8 h-8 rounded-full flex items-center justify-center btn-lift"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                Tên dự án
              </label>
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="VD: WebPortfolio, AppTodo, BaiTapDSA..."
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)'
                }}
                className="w-full h-11 px-3.5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                Loại dự án
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'web', title: 'Web (HTML/CSS/JS)', desc: 'Có Live Preview' },
                    { id: 'cpp', title: 'C++ Thuật toán', desc: 'GCC 14.2 + STL' },
                    { id: 'cpp-oop', title: 'C++ OOP Nhiều tệp', desc: 'main.cpp + header' },
                    { id: 'python', title: 'Python 3 WASM', desc: 'Chạy Offline' }
                  ] as Array<{ id: NewProjectTemplate; title: string; desc: string }>
                ).map((tpl) => {
                  const selected = newProjectTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setNewProjectTemplate(tpl.id)}
                      style={{
                        backgroundColor: selected ? 'var(--bg-active)' : 'var(--bg-elevated)',
                        border: selected
                          ? '1.5px solid var(--accent-primary)'
                          : '1.5px solid transparent'
                      }}
                      className="p-3 rounded-2xl text-left transition-all btn-lift"
                    >
                      <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        {tpl.title}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {tpl.desc}
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
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                boxShadow: '0 8px 20px -5px rgba(59, 130, 246, 0.55)'
              }}
              className="w-full h-11 rounded-2xl text-white text-sm font-semibold btn-lift disabled:opacity-60"
            >
              {creating ? 'Đang khởi tạo...' : 'Tạo & Mở ngay'}
            </button>
          </form>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTarget && (
        <div
          onClick={() => setRenameTarget(null)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 ios-backdrop-enter"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmitRename}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border-subtle)'
            }}
            className="w-full max-w-sm rounded-3xl p-5 space-y-4 ios-modal-enter"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                Đổi tên {renameTarget.isFolder ? 'dự án' : 'tệp'}
              </h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                className="w-8 h-8 rounded-full flex items-center justify-center btn-lift"
              >
                <X size={15} />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)'
              }}
              className="w-full h-11 px-3.5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-sky-500/50"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                className="flex-1 h-10 rounded-xl text-xs font-semibold btn-lift"
              >
                Hủy
              </button>
              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                className="flex-1 h-10 rounded-xl text-white text-xs font-semibold btn-lift"
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
