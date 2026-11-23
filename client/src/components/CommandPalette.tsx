import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  X
} from 'lucide-react';
import { WorkspaceFile } from '../types/ide';
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

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  files,
  onSelectFile,
  commands
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo(() => {
    const raw = query.trim();
    const isCommandOnly = raw.startsWith('>');
    const needle = (isCommandOnly ? raw.slice(1) : raw).trim().toLowerCase();

    const matchedFiles = isCommandOnly
      ? []
      : files
          .filter(
            (f) =>
              !needle ||
              f.name.toLowerCase().includes(needle) ||
              f.path.toLowerCase().includes(needle)
          )
          .slice(0, 12)
          .map((file) => ({
            kind: 'file' as const,
            id: `file:${file.path}`,
            title: file.name,
            subtitle: file.path,
            file
          }));

    const matchedCommands = commands
      .filter(
        (cmd) =>
          !needle ||
          cmd.title.toLowerCase().includes(needle) ||
          (cmd.subtitle || '').toLowerCase().includes(needle)
      )
      .map((command) => ({
        kind: 'command' as const,
        id: `cmd:${command.id}`,
        title: command.title,
        subtitle: command.subtitle,
        shortcut: command.shortcut,
        command
      }));

    return isCommandOnly
      ? matchedCommands
      : [...matchedFiles, ...matchedCommands];
  }, [query, files, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, items.length]);

  if (!open) return null;

  const executeItem = (idx: number) => {
    const chosen = items[idx];
    if (!chosen) return;
    onClose();
    if (chosen.kind === 'file') {
      onSelectFile(chosen.file);
    } else {
      chosen.command.action();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3 select-none ios-backdrop-enter"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--bg-hover)'
        }}
        className="w-full max-w-xl rounded-3xl overflow-hidden flex flex-col max-h-[72vh] ios-modal-enter"
      >
        {/* Search Input */}
        <div
          style={{ borderBottom: '1px solid var(--bg-elevated)' }}
          className="px-4 h-14 flex items-center gap-3 shrink-0"
        >
          <Search size={17} style={{ color: 'var(--accent-primary)' }} className="shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  items.length ? (prev - 1 + items.length) % items.length : 0
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                executeItem(selectedIndex);
              }
            }}
            placeholder="Tìm tệp nhanh hoặc gõ > để chạy lệnh (Cmd+P)..."
            style={{ color: 'var(--text-primary)' }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ color: 'var(--text-secondary)' }}
              className="p-1 rounded-lg hover:bg-[var(--bg-elevated)]"
            >
              <X size={14} />
            </button>
          )}
          <kbd
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            className="hidden sm:inline-block px-2 py-0.5 rounded-lg text-[10px] font-mono"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
              Không tìm thấy tệp hoặc lệnh phù hợp với &ldquo;{query}&rdquo;
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => executeItem(idx)}
                  style={{
                    backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                    color: 'var(--text-primary)'
                  }}
                  className="w-full px-3 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{ backgroundColor: 'var(--bg-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    >
                      {item.kind === 'file' ? (
                        <FileTypeIcon fileName={item.title} size={17} />
                      ) : (
                        item.command.icon
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.title}</div>
                      {item.subtitle && (
                        <div
                          className="text-[11px] truncate"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.kind === 'command' && item.shortcut && (
                      <kbd
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)'
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-mono"
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    {active && <CornerDownLeft size={13} style={{ color: 'var(--accent-primary)' }} />}
                  </div>
                </button>
              );
            })
          )}
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
