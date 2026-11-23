import React, { useEffect, useRef, useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  Trash2,
  Pencil,
  Upload,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';
import { FileNode, WorkspaceFile } from '../types/ide';
import { FileTypeIcon } from './FileTypeIcon';

interface ExplorerSidebarProps {
  tree: FileNode[];
  files: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  onSelectFile: (file: WorkspaceFile) => void;
  onCreateFile: (relPath: string) => Promise<void> | void;
  onCreateFolder: (relPath: string) => Promise<void> | void;
  onRenameEntry?: (oldPath: string, newPath: string) => Promise<void> | void;
  onImportCodeFiles?: (files: FileList) => Promise<void> | void;
  onDeleteEntry: (relPath: string) => Promise<void> | void;
  onRefresh: () => void;
  onCloseMobile?: () => void;
  isOverlay?: boolean;
}

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({
  tree,
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameEntry,
  onImportCodeFiles,
  onDeleteEntry,
  onRefresh,
  onCloseMobile,
  isOverlay
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState<{
    type: 'file' | 'folder';
    parentPath: string;
  } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renaming, setRenaming] = useState<{
    oldPath: string;
    isFolder: boolean;
  } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Mặc định mở sẵn các thư mục cấp 1
  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = { ...prev };
      tree.forEach((node) => {
        if (node.type === 'folder' && next[node.path] === undefined) {
          next[node.path] = true;
        }
      });
      return next;
    });
  }, [tree]);

  useEffect(() => {
    if (creating) {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    }
  }, [creating]);

  useEffect(() => {
    if (renaming) {
      window.setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 20);
    }
  }, [renaming]);

  const startCreate = (type: 'file' | 'folder', parentPath = '') => {
    setRenaming(null);
    if (parentPath) {
      setExpandedFolders((prev) => ({ ...prev, [parentPath]: true }));
    }
    setDraftName('');
    setCreating({ type, parentPath });
  };

  const commitCreate = async () => {
    if (!creating) return;
    const trimmed = draftName.trim().replace(/^\/+|\/+$/g, '');
    const current = creating;
    setCreating(null);
    setDraftName('');

    if (!trimmed) return;
    const fullPath = current.parentPath ? `${current.parentPath}/${trimmed}` : trimmed;

    if (current.type === 'file') {
      await onCreateFile(fullPath);
    } else {
      await onCreateFolder(fullPath);
    }
  };

  const startRename = (node: FileNode) => {
    setCreating(null);
    setRenaming({ oldPath: node.path, isFolder: node.type === 'folder' });
    setRenameDraft(node.name);
  };

  const commitRename = async () => {
    if (!renaming) return;
    const current = renaming;
    const trimmed = renameDraft.trim().replace(/[\\/:*?"<>|]+/g, '');
    setRenaming(null);
    setRenameDraft('');

    if (!trimmed || !onRenameEntry) return;
    const parts = current.oldPath.split('/');
    parts[parts.length - 1] = trimmed;
    const nextPath = parts.join('/');
    if (nextPath !== current.oldPath) {
      await onRenameEntry(current.oldPath, nextPath);
    }
  };

  const renderInlineCreator = (depth: number) => {
    if (!creating) return null;
    const previewFileName = draftName.trim() || (creating.type === 'file' ? 'file.txt' : 'folder');

    return (
      <div
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className="pr-2 py-1 flex items-center gap-1.5"
      >
        <FileTypeIcon
          fileName={previewFileName}
          isFolder={creating.type === 'folder'}
          size={16}
        />
        <input
          ref={inputRef}
          type="text"
          value={draftName}
          placeholder={creating.type === 'file' ? 'vd: app.js, main.c...' : 'Tên thư mục...'}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitCreate();
            } else if (e.key === 'Escape') {
              setCreating(null);
              setDraftName('');
            }
          }}
          onBlur={commitCreate}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)'
          }}
          className="flex-1 min-w-0 h-7 px-2 rounded-lg text-xs outline-none ring-1 ring-[var(--accent-primary)]"
        />
      </div>
    );
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isBeingRenamed = renaming?.oldPath === node.path;

    if (node.type === 'folder') {
      const isExpanded = Boolean(expandedFolders[node.path]);
      return (
        <div key={node.path}>
          <div
            onClick={() => {
              if (!isBeingRenamed) {
                setExpandedFolders((prev) => ({ ...prev, [node.path]: !isExpanded }));
              }
            }}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className="group h-8 pr-2 rounded-xl flex items-center justify-between gap-1 cursor-pointer hover:bg-[var(--bg-hover)] text-xs transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span style={{ color: 'var(--text-secondary)' }} className="shrink-0">
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
              <FileTypeIcon fileName={node.name} isFolder isOpen={isExpanded} size={16} />
              {isBeingRenamed ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameDraft}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === 'Escape') {
                      setRenaming(null);
                    }
                  }}
                  onBlur={commitRename}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)'
                  }}
                  className="flex-1 min-w-0 h-6 px-1.5 rounded-md text-xs outline-none ring-1 ring-[var(--accent-primary)]"
                />
              ) : (
                <span
                  style={{ color: 'var(--text-primary)' }}
                  className="font-medium truncate"
                >
                  {node.name}
                </span>
              )}
            </div>

            {!isBeingRenamed && (
              <div
                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => startCreate('file', node.path)}
                  className="p-1 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Tạo tệp trong thư mục này"
                >
                  <FilePlus size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => startCreate('folder', node.path)}
                  className="p-1 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Tạo thư mục con"
                >
                  <FolderPlus size={12} />
                </button>
                {onRenameEntry && (
                  <button
                    type="button"
                    onClick={() => startRename(node)}
                    className="p-1 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-sky-400"
                    title="Đổi tên thư mục"
                  >
                    <Pencil size={11} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteEntry(node.path)}
                  className="p-1 rounded-md hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-500"
                  title="Xóa thư mục"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {isExpanded && (
            <div>
              {creating?.parentPath === node.path && renderInlineCreator(depth + 1)}
              {(node.children || []).map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = activeFile?.path === node.path;
    const fileObj = files.find((f) => f.path === node.path) || node.file;

    return (
      <div
        key={node.path}
        onClick={() => {
          if (!isBeingRenamed && fileObj) onSelectFile(fileObj);
        }}
        style={{
          paddingLeft: `${depth * 14 + 20}px`,
          backgroundColor: isSelected ? 'var(--bg-active)' : undefined,
          color: 'var(--text-primary)'
        }}
        className={`group h-7 pr-2 rounded-lg flex items-center justify-between gap-1.5 cursor-pointer text-xs transition-colors relative ${
          isSelected
            ? 'font-semibold'
            : 'hover:bg-[var(--bg-hover)]/70 opacity-90 hover:opacity-100'
        }`}
      >
        {isSelected && (
          <span
            aria-hidden="true"
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r-full"
          />
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileTypeIcon fileName={node.name} size={15} />
          {isBeingRenamed ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  setRenaming(null);
                }
              }}
              onBlur={commitRename}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)'
              }}
              className="flex-1 min-w-0 h-6 px-1.5 rounded-md text-xs outline-none ring-1 ring-[var(--accent-primary)]"
            />
          ) : (
            <>
              <span className="truncate">{node.name}</span>
              {fileObj?.dirty && (
                <span
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                />
              )}
            </>
          )}
        </div>

        {!isBeingRenamed && (
          <div
            className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {onRenameEntry && (
              <button
                type="button"
                onClick={() => startRename(node)}
                className="p-1 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="Đổi tên tệp"
              >
                <Pencil size={11} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteEntry(node.path)}
              className="p-1 rounded-md hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-400"
              title="Xóa tệp"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">
      {/* Thanh hành động nhanh */}
      <div className="px-3 py-2 flex items-center justify-between gap-1 shrink-0">
        <span
          style={{ color: 'var(--text-secondary)' }}
          className="text-[11px] font-bold uppercase tracking-wider"
        >
          Workspace
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => startCreate('file', '')}
            style={{ color: 'var(--text-secondary)' }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            title="Tạo tệp mới (vd: app.js, main.c, index.html)"
          >
            <FilePlus size={14} />
          </button>

          <button
            type="button"
            onClick={() => startCreate('folder', '')}
            style={{ color: 'var(--text-secondary)' }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            title="Tạo thư mục mới"
          >
            <FolderPlus size={14} />
          </button>

          {onImportCodeFiles && (
            <label
              style={{ color: 'var(--text-secondary)' }}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] hover:text-emerald-400 transition-colors cursor-pointer"
              title="Mở / Nhập tệp code lẻ từ máy (iPad Files)"
            >
              <Upload size={13} />
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
          )}

          <button
            type="button"
            onClick={onRefresh}
            style={{ color: 'var(--text-secondary)' }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw size={13} />
          </button>

          {(isOverlay || onCloseMobile) && (
            <button
              type="button"
              onClick={onCloseMobile}
              style={{ color: 'var(--text-secondary)' }}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] hover:text-rose-500 transition-colors"
              title="Đóng"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Cây thư mục & tệp */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5">
        {creating?.parentPath === '' && renderInlineCreator(0)}
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};
