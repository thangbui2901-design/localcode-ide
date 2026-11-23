import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Trash2, Square, Send, ChevronDown, ChevronUp, X, Play } from 'lucide-react';
import { ExecutionMode, IdeDiagnostic } from '../types/ide';

export interface TerminalChunk {
  type: 'status' | 'stdout' | 'stderr' | 'stdin';
  text: string;
}

interface BottomPanelProps {
  mode: ExecutionMode;
  logs: TerminalChunk[];
  diagnostics: IdeDiagnostic[];
  isRunning: boolean;
  stdinPreset: string;
  autoEof: boolean;
  onChangeStdinPreset: (val: string) => void;
  onChangeAutoEof: (val: boolean) => void;
  onRunWithInput: () => void;
  onSendStdin: (line: string) => void;
  onSendEof: () => void;
  onKill: () => void;
  onClear: () => void;
  onJumpToDiagnostic: (diag: IdeDiagnostic) => void;
  onClose?: () => void;
  isSheet?: boolean;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  mode,
  logs,
  diagnostics,
  isRunning,
  stdinPreset,
  autoEof,
  onChangeStdinPreset,
  onChangeAutoEof,
  onRunWithInput,
  onSendStdin,
  onSendEof,
  onKill,
  onClear,
  onJumpToDiagnostic,
  onClose,
  isSheet = false
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'input' | 'problems' | 'output'>('terminal');
  const [stdinText, setStdinText] = useState('');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stdinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isRunning]);

  useEffect(() => {
    if (isRunning && activeTab === 'terminal' && mode === 'local') {
      stdinInputRef.current?.focus();
    }
  }, [isRunning, activeTab, mode]);

  const handleCopy = async () => {
    const plain = logs.map((l) => l.text).join('');
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const submitStdin = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'standalone') {
      const nextPreset = stdinPreset ? `${stdinPreset}\n${stdinText}` : stdinText;
      onChangeStdinPreset(nextPreset);
      setStdinText('');
      return;
    }
    onSendStdin(stdinText + '\n');
    setStdinText('');
  };

  const hasPresetInput = stdinPreset.trim().length > 0;

  const tabBtn = (id: 'problems' | 'input' | 'output' | 'terminal', label: string, badge?: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`h-9 flex items-center gap-1.5 border-b-2 transition-colors ${
        activeTab === id ? 'border-[#007ACC] text-white' : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
      }`}
    >
      <span>{label}</span>
      {badge}
    </button>
  );

  return (
    <div
      className={`bg-[#181818] border-t border-[#3C3C3C] flex flex-col ${
        isSheet ? (expanded ? 'h-[80vh]' : 'h-[48vh]') : 'h-60 shrink-0'
      }`}
    >
      <div className="h-9 px-3 border-b border-[#2B2B2B] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-4 text-[11px] uppercase tracking-wide overflow-x-auto no-scrollbar">
          {tabBtn(
            'problems',
            'Problems',
            diagnostics.length > 0 && (
              <span className="px-1.5 rounded-full bg-[#007ACC] text-white text-[10px]">{diagnostics.length}</span>
            )
          )}
          {tabBtn(
            'input',
            'Input',
            hasPresetInput && <span className="w-2 h-2 rounded-full bg-[#4EC9B0]" title="Đang có dữ liệu Testcase" />
          )}
          {tabBtn('output', 'Output')}
          {tabBtn('terminal', 'Terminal')}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isRunning && mode === 'local' && (
            <button
              onClick={onKill}
              title="Dừng tiến trình"
              className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded hover:bg-[#2A2D2E] text-[#F14C4C]"
            >
              <Square size={14} fill="currentColor" />
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copy Output"
            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded hover:bg-[#2A2D2E] text-[#CCCCCC]"
          >
            {copied ? <Check size={14} className="text-[#4EC9B0]" /> : <Copy size={14} />}
          </button>
          <button
            onClick={onClear}
            title="Xóa Terminal"
            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded hover:bg-[#2A2D2E] text-[#CCCCCC]"
          >
            <Trash2 size={14} />
          </button>
          {isSheet && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded hover:bg-[#2A2D2E] text-[#CCCCCC]"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded hover:bg-[#2A2D2E] text-[#CCCCCC]"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'input' && (
        <div className="flex-1 min-h-0 flex flex-col bg-[#1E1E1E]">
          <div className="px-3 py-1.5 bg-[#252526] border-b border-[#2D2D2D] flex items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 text-[#CCCCCC] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoEof}
                onChange={(e) => onChangeAutoEof(e.target.checked)}
                className="accent-[#007ACC]"
              />
              <span>Tự gửi EOF sau khi nạp Input</span>
            </label>

            <div className="flex items-center gap-2 shrink-0">
              {hasPresetInput && (
                <button
                  onClick={() => onChangeStdinPreset('')}
                  className="px-2 py-1 rounded hover:bg-[#333336] text-[#9E9E9E] hover:text-white"
                >
                  Xóa Input
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab('terminal');
                  onRunWithInput();
                }}
                disabled={isRunning}
                className="px-2.5 py-1 rounded bg-[#007ACC] hover:bg-[#1F8AD2] text-white font-medium flex items-center gap-1"
              >
                <Play size={12} fill="currentColor" />
                <span>Chạy với Input này</span>
              </button>
            </div>
          </div>

          <textarea
            value={stdinPreset}
            onChange={(e) => onChangeStdinPreset(e.target.value)}
            placeholder={`Dán toàn bộ dữ liệu đầu vào (Testcase DSA) tại đây...\nVí dụ:\n5\n42 17 8 99 23`}
            className="flex-1 w-full p-3 bg-[#181818] text-[#CCCCCC] terminal-font text-[13px] leading-relaxed resize-none outline-none"
          />
        </div>
      )}

      {activeTab === 'problems' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          {diagnostics.length === 0 ? (
            <div className="text-[#858585] p-2">Không phát hiện lỗi cú pháp hoặc cảnh báo nào.</div>
          ) : (
            diagnostics.map((d, idx) => (
              <div
                key={idx}
                onClick={() => onJumpToDiagnostic(d)}
                className="px-2.5 py-2 rounded hover:bg-[#2A2D2E] cursor-pointer flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2">
                  <span className={d.severity === 'error' ? 'text-[#F14C4C]' : 'text-[#CCA700]'}>●</span>
                  <span className="text-[#CCCCCC]">{d.message}</span>
                </div>
                <span className="text-[#858585] shrink-0 code-font">
                  {d.fileName} [{d.line}:{d.column}]
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {(activeTab === 'terminal' || activeTab === 'output') && (
        <>
          <div
            ref={scrollRef}
            onClick={() => {
              if (!window.getSelection()?.toString()) {
                stdinInputRef.current?.focus();
              }
            }}
            className="flex-1 overflow-y-auto p-3 terminal-font text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text cursor-text"
          >
            {logs.length === 0 ? (
              <span className="text-[#6E6E6E]">
                {hasPresetInput
                  ? 'Đã có sẵn dữ liệu trong tab INPUT. Nhấn Run (F5) để tự động nạp và chạy...'
                  : 'Nhấn Run (F5) để biên dịch và chạy chương trình...'}
              </span>
            ) : (
              <>
                {logs.map((chunk, i) => (
                  <span
                    key={i}
                    className={
                      chunk.type === 'stderr'
                        ? 'text-[#F14C4C]'
                        : chunk.type === 'status'
                        ? 'text-[#569CD6]'
                        : chunk.type === 'stdin'
                        ? 'text-[#4EC9B0]'
                        : 'text-[#CCCCCC]'
                    }
                  >
                    {chunk.text}
                  </span>
                ))}
                {isRunning && (
                  <span
                    className="inline-block w-2 h-4 ml-1 align-middle bg-[#CCCCCC] animate-pulse"
                    title="Đang xử lý..."
                  />
                )}
              </>
            )}
          </div>

          <form
            onSubmit={submitStdin}
            className="h-10 px-2 border-t border-[#2B2B2B] flex items-center gap-2 bg-[#1E1E1E] shrink-0"
          >
            <span className="text-[#4EC9B0] text-xs code-font shrink-0">stdin &gt;</span>
            <input
              ref={stdinInputRef}
              value={stdinText}
              onChange={(e) => setStdinText(e.target.value)}
              placeholder={
                mode === 'standalone'
                  ? 'Thêm nhanh 1 dòng vào tab INPUT rồi nhấn Enter...'
                  : isRunning
                  ? 'Chương trình đang chờ nhập — gõ dữ liệu rồi nhấn Enter...'
                  : 'Nhập trực tiếp từng dòng hoặc dùng tab INPUT ở trên...'
              }
              className="flex-1 bg-transparent text-[#CCCCCC] text-xs code-font outline-none"
            />
            {isRunning && mode === 'local' && (
              <button
                type="button"
                onClick={onSendEof}
                title="Gửi tín hiệu kết thúc nhập (EOF / Ctrl+D)"
                className="h-7 px-2 rounded bg-[#333336] hover:bg-[#444448] text-[#CCCCCC] text-[11px] code-font shrink-0"
              >
                EOF
              </button>
            )}
            <button
              type="submit"
              className="min-w-[36px] min-h-[34px] px-2.5 rounded bg-[#007ACC] text-white flex items-center justify-center shrink-0"
            >
              <Send size={13} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
