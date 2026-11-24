import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Square,
  Send,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Plus,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PanelRight,
  PanelBottom
} from 'lucide-react';
import { ExecutionMode, IdeDiagnostic, TestCaseItem, TestCaseResult } from '../types/ide';

export interface TerminalChunk {
  type: 'status' | 'stdout' | 'stderr' | 'stdin';
  text: string;
}

interface BottomPanelProps {
  mode: ExecutionMode;
  logs: TerminalChunk[];
  diagnostics: IdeDiagnostic[];
  isRunning: boolean;
  isWaitingForInput?: boolean;
  lastElapsedMs?: number | null;
  stdinPreset: string;
  autoEof: boolean;
  testCases?: TestCaseItem[];
  testResults?: Record<string, TestCaseResult>;
  isRunningTests?: boolean;
  onChangeTestCases?: (next: TestCaseItem[]) => void;
  onRunAllTests?: () => void;
  onRunSingleTest?: (testCase: TestCaseItem) => void;
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
  dockPosition?: 'bottom' | 'right';
  onToggleDockPosition?: () => void;
  requestedTab?: { tab: 'terminal' | 'input' | 'tests' | 'problems'; seq: number } | null;
  hideVirtualKeyboard?: boolean;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  mode,
  logs,
  diagnostics,
  isRunning,
  isWaitingForInput = false,
  lastElapsedMs = null,
  stdinPreset,
  autoEof,
  testCases = [],
  testResults = {},
  isRunningTests = false,
  onChangeTestCases,
  onRunAllTests,
  onRunSingleTest,
  onChangeStdinPreset,
  onChangeAutoEof,
  onRunWithInput,
  onSendStdin,
  onSendEof,
  onKill,
  onClear,
  onJumpToDiagnostic,
  onClose,
  isSheet = false,
  dockPosition = 'bottom',
  onToggleDockPosition,
  requestedTab = null,
  hideVirtualKeyboard = false
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'input' | 'tests' | 'problems'>('terminal');
  const [stdinText, setStdinText] = useState('');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stdinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (requestedTab?.tab) {
      setActiveTab(requestedTab.tab);
    }
  }, [requestedTab?.seq]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isRunning, isWaitingForInput]);

  useEffect(() => {
    if (activeTab === 'terminal' && (isWaitingForInput || (isRunning && mode === 'local'))) {
      stdinInputRef.current?.focus();
    }
  }, [isRunning, isWaitingForInput, activeTab, mode]);

  const handleCopy = async () => {
    const plain = logs.map((l) => l.text).join('');
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const submitStdin = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'standalone' && !isWaitingForInput) {
      const nextPreset = stdinPreset ? `${stdinPreset}\n${stdinText}` : stdinText;
      onChangeStdinPreset(nextPreset);
      setStdinText('');
      return;
    }
    onSendStdin(stdinText + '\n');
    setStdinText('');
  };

  const hasPresetInput = stdinPreset.trim().length > 0;

  const passedCount = testCases.filter((tc) => testResults[tc.id]?.status === 'ac').length;
  const judgedCount = testCases.filter((tc) => {
    const st = testResults[tc.id]?.status;
    return st === 'ac' || st === 'wa' || st === 'err';
  }).length;

  const handleAddTestCase = () => {
    if (!onChangeTestCases) return;
    const nextIdx = testCases.length + 1;
    onChangeTestCases([
      ...testCases,
      {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `Test #${nextIdx}`,
        input: '',
        expectedOutput: ''
      }
    ]);
  };

  const handleUpdateTestCase = (id: string, patch: Partial<TestCaseItem>) => {
    if (!onChangeTestCases) return;
    onChangeTestCases(testCases.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)));
  };

  const handleDeleteTestCase = (id: string) => {
    if (!onChangeTestCases) return;
    onChangeTestCases(testCases.filter((tc) => tc.id !== id));
  };

  const tabBtn = (
    id: 'terminal' | 'input' | 'tests' | 'problems',
    label: string,
    badge?: React.ReactNode
  ) => {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        style={{
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderBottomColor: active ? 'var(--accent-primary)' : 'transparent'
        }}
        className="h-9 px-1 flex items-center gap-1.5 border-b-2 text-[11px] font-semibold tracking-wide transition-colors shrink-0"
      >
        <span>{label}</span>
        {badge}
      </button>
    );
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-panel)',
        color: 'var(--text-primary)'
      }}
      className={`flex flex-col ${
        isSheet
          ? expanded
            ? 'h-[78dvh] max-h-[calc(100dvh-56px)]'
            : 'h-[54dvh] max-h-[calc(100dvh-64px)]'
          : 'h-full min-h-0'
      }`}
    >
      {/* Unified Sleek Header */}
      <div
        style={{
          backgroundColor: 'var(--bg-panel-alt)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
        className="h-9 px-3 flex items-center justify-between select-none shrink-0 gap-2"
      >
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          {tabBtn('terminal', 'Console')}
          {tabBtn(
            'input',
            'Input',
            hasPresetInput && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Đang có dữ liệu Input" />
            )
          )}
          {onChangeTestCases &&
            tabBtn(
              'tests',
              'Tests',
              judgedCount > 0 ? (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    passedCount === testCases.length
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {passedCount}/{testCases.length}
                </span>
              ) : testCases.length > 0 ? (
                <span
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                  className="px-1.5 rounded-full text-[10px]"
                >
                  {testCases.length}
                </span>
              ) : null
            )}
          {tabBtn(
            'problems',
            'Problems',
            diagnostics.length > 0 && (
              <span className="px-1.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                {diagnostics.length}
              </span>
            )
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(isRunning || isWaitingForInput || lastElapsedMs !== null) && (
            <span
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: isWaitingForInput
                  ? '#10B981'
                  : isRunning
                    ? 'var(--accent-secondary)'
                    : 'var(--text-secondary)'
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isWaitingForInput
                    ? 'bg-emerald-400 animate-pulse'
                    : isRunning
                      ? 'bg-sky-400 animate-pulse'
                      : 'bg-emerald-400'
                }`}
              />
              {isWaitingForInput ? 'Đang chờ nhập...' : isRunning ? 'Running...' : `${lastElapsedMs}ms`}
            </span>
          )}

          {(isRunning || isWaitingForInput) && (
            <button
              onClick={onKill}
              title="Dừng tiến trình"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/15 text-rose-400 transition-colors"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copy Output"
            style={{ color: 'var(--text-secondary)' }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          <button
            onClick={onClear}
            title="Xóa Console"
            style={{ color: 'var(--text-secondary)' }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Trash2 size={13} />
          </button>
          {onToggleDockPosition && !isSheet && (
            <button
              onClick={onToggleDockPosition}
              title={
                dockPosition === 'right'
                  ? 'Chuyển Console xuống Dưới đáy (⌘⌥J)'
                  : 'Gắn Console sang Bên phải (⌘⌥J)'
              }
              style={{ color: 'var(--text-secondary)' }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              {dockPosition === 'right' ? <PanelBottom size={13} /> : <PanelRight size={13} />}
            </button>
          )}
          {isSheet && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ color: 'var(--text-secondary)' }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{ color: 'var(--text-secondary)' }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TAB: MULTI TEST CASES AUTO-JUDGE */}
      {activeTab === 'tests' && onChangeTestCases && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            style={{
              backgroundColor: 'var(--bg-panel-alt)',
              borderBottom: '1px solid var(--border-subtle)'
            }}
            className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FlaskConical size={13} className="text-sky-400 shrink-0" />
              <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Test Cases
              </span>
              {judgedCount > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    passedCount === testCases.length
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  Đạt {passedCount}/{testCases.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAddTestCase}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 btn-lift"
              >
                <Plus size={12} />
                <span>Thêm</span>
              </button>
              {onRunAllTests && (
                <button
                  type="button"
                  onClick={onRunAllTests}
                  disabled={isRunningTests || isRunning || testCases.length === 0}
                  className="px-3 py-1 rounded-lg run-btn font-bold flex items-center gap-1.5 disabled:opacity-50 btn-lift"
                >
                  <Play size={10} fill="currentColor" />
                  <span>{isRunningTests ? 'Đang chấm...' : 'Run All'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
            {testCases.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Thêm Input &amp; Expected Output để tự động chấm AC / WA cho C++ và Python.
                </p>
                <button
                  type="button"
                  onClick={handleAddTestCase}
                  className="px-3 py-1.5 rounded-xl accent-btn text-xs font-semibold inline-flex items-center gap-1.5 btn-lift"
                >
                  <Plus size={13} />
                  <span>Tạo Test #1</span>
                </button>
              </div>
            ) : (
              testCases.map((tc, index) => {
                const res = testResults[tc.id];
                const status = res?.status || 'idle';
                return (
                  <div
                    key={tc.id}
                    style={{
                      backgroundColor: 'var(--bg-panel-alt)',
                      border: '1px solid var(--border-subtle)'
                    }}
                    className="rounded-xl p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          {tc.name || `Test #${index + 1}`}
                        </span>
                        {status === 'running' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-400 animate-pulse">
                            Đang chạy...
                          </span>
                        )}
                        {status === 'ac' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            AC {res?.elapsedMs !== undefined ? `• ${res.elapsedMs}ms` : ''}
                          </span>
                        )}
                        {status === 'wa' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 inline-flex items-center gap-1">
                            <XCircle size={11} />
                            WA {res?.elapsedMs !== undefined ? `• ${res.elapsedMs}ms` : ''}
                          </span>
                        )}
                        {status === 'err' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 inline-flex items-center gap-1">
                            <AlertTriangle size={11} />
                            ERR
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onRunSingleTest && (
                          <button
                            type="button"
                            onClick={() => onRunSingleTest(tc)}
                            disabled={isRunningTests || isRunning}
                            className="px-2.5 py-1 rounded-lg accent-btn text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50 btn-lift"
                          >
                            <Play size={10} fill="currentColor" />
                            <span>Chạy</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteTestCase(tc.id)}
                          style={{ color: 'var(--text-secondary)' }}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 hover:text-rose-400"
                          title="Xóa test case"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label
                          className="block text-[10px] uppercase tracking-wider mb-1"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Input (stdin)
                        </label>
                        <textarea
                          rows={2}
                          value={tc.input}
                          onChange={(e) => handleUpdateTestCase(tc.id, { input: e.target.value })}
                          placeholder="VD: 5&#10;3 1 4 1 5"
                          style={{
                            backgroundColor: 'var(--bg-panel)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)'
                          }}
                          className="w-full p-2 rounded-lg font-mono text-xs resize-y outline-none"
                        />
                      </div>
                      <div>
                        <label
                          className="block text-[10px] uppercase tracking-wider mb-1"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Expected Output
                        </label>
                        <textarea
                          rows={2}
                          value={tc.expectedOutput}
                          onChange={(e) =>
                            handleUpdateTestCase(tc.id, { expectedOutput: e.target.value })
                          }
                          placeholder="VD: 1 1 3 4 5"
                          style={{
                            backgroundColor: 'var(--bg-panel)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)'
                          }}
                          className="w-full p-2 rounded-lg font-mono text-xs resize-y outline-none"
                        />
                      </div>
                    </div>

                    {res && res.status !== 'idle' && res.status !== 'running' && (
                      <div
                        style={{
                          backgroundColor: 'var(--bg-panel)',
                          border: '1px solid var(--border-subtle)'
                        }}
                        className="rounded-lg p-2 text-xs font-mono space-y-1"
                      >
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                          Actual Output:
                        </div>
                        <pre className="whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>
                          {res.actualOutput || '(trống)'}
                        </pre>
                        {res.stderr && (
                          <pre className="whitespace-pre-wrap break-words text-rose-400 pt-1 border-t border-white/5">
                            {res.stderr}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB: INPUT */}
      {activeTab === 'input' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            style={{
              backgroundColor: 'var(--bg-panel-alt)',
              borderBottom: '1px solid var(--border-subtle)'
            }}
            className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0"
          >
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={autoEof}
                onChange={(e) => onChangeAutoEof(e.target.checked)}
                className="accent-sky-500"
              />
              <span>Tự gửi EOF</span>
            </label>

            <div className="flex items-center gap-2 shrink-0">
              {hasPresetInput && (
                <button
                  onClick={() => onChangeStdinPreset('')}
                  style={{ color: 'var(--text-secondary)' }}
                  className="px-2 py-1 rounded-lg hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  Xóa
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab('terminal');
                  onRunWithInput();
                }}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-lg run-btn font-bold flex items-center gap-1 btn-lift"
              >
                <Play size={11} fill="currentColor" />
                <span>Chạy với Input</span>
              </button>
            </div>
          </div>

          <textarea
            value={stdinPreset}
            onChange={(e) => onChangeStdinPreset(e.target.value)}
            placeholder={`Dán dữ liệu đầu vào (stdin) tại đây...\nVí dụ:\n5\n42 17 8 99 23`}
            style={{
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-primary)'
            }}
            className="flex-1 w-full p-3 font-mono text-[13px] leading-relaxed resize-none outline-none"
          />
        </div>
      )}

      {/* TAB: PROBLEMS */}
      {activeTab === 'problems' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          {diagnostics.length === 0 ? (
            <div className="p-3" style={{ color: 'var(--text-secondary)' }}>
              Không phát hiện lỗi cú pháp hoặc cảnh báo nào.
            </div>
          ) : (
            diagnostics.map((d, idx) => (
              <div
                key={idx}
                onClick={() => onJumpToDiagnostic(d)}
                className="px-3 py-2 rounded-xl hover:bg-[var(--bg-elevated)] cursor-pointer flex items-start justify-between gap-2 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className={d.severity === 'error' ? 'text-rose-400' : 'text-amber-400'}>●</span>
                  <span style={{ color: 'var(--text-primary)' }}>{d.message}</span>
                </div>
                <span className="shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {d.fileName} [{d.line}:{d.column}]
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: CONSOLE / TERMINAL */}
      {activeTab === 'terminal' && (
        <>
          <div
            ref={scrollRef}
            onClick={() => {
              if (!window.getSelection()?.toString()) {
                stdinInputRef.current?.focus();
              }
            }}
            className="flex-1 overflow-y-auto p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text cursor-text"
          >
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-secondary)' }} className="opacity-70">
                {hasPresetInput
                  ? 'Đã có sẵn dữ liệu trong tab Input. Bấm Run (⌘Enter) để chạy...'
                  : 'Bấm nút Run (⌘Enter) để biên dịch và xem kết quả tại đây...'}
              </span>
            ) : (
              <>
                {logs.map((chunk, i) => (
                  <span
                    key={i}
                    style={chunk.type === 'stdout' ? { color: 'var(--text-primary)' } : undefined}
                    className={
                      chunk.type === 'stderr'
                        ? 'text-rose-400'
                        : chunk.type === 'status'
                          ? 'text-sky-400'
                          : chunk.type === 'stdin'
                            ? 'text-emerald-400'
                            : ''
                    }
                  >
                    {chunk.text}
                  </span>
                ))}
                {(isRunning || isWaitingForInput) && (
                  <span
                    style={{
                      backgroundColor: isWaitingForInput ? '#10B981' : 'var(--accent-primary)'
                    }}
                    className="inline-block w-2 h-4 ml-1 align-middle animate-pulse rounded-xs"
                    title={isWaitingForInput ? 'Đang chờ bạn nhập dữ liệu ở ô dưới...' : 'Đang xử lý...'}
                  />
                )}
              </>
            )}
          </div>

          <form
            onSubmit={submitStdin}
            style={{
              backgroundColor: 'var(--bg-panel-alt)',
              borderTop: isWaitingForInput
                ? '1.5px solid rgba(16, 185, 129, 0.55)'
                : '1px solid var(--border-subtle)'
            }}
            className="h-10 px-3 flex items-center gap-2 shrink-0 transition-colors"
          >
            <span
              className={`text-xs font-mono font-semibold shrink-0 ${
                isWaitingForInput ? 'text-emerald-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {isWaitingForInput ? 'nhập >' : 'stdin >'}
            </span>
            <input
              ref={stdinInputRef}
              value={stdinText}
              onChange={(e) => setStdinText(e.target.value)}
              inputMode={hideVirtualKeyboard ? 'none' : undefined}
              disabled={isRunning && mode === 'standalone'}
              placeholder={
                isWaitingForInput
                  ? 'Gõ giá trị rồi nhấn Enter để chạy tiếp...'
                  : mode === 'standalone'
                    ? 'Bấm Run để nhập từng dòng, hoặc gõ sẵn vào Input...'
                    : isRunning
                      ? 'Nhập dữ liệu rồi nhấn Enter...'
                      : 'Nhập stdin hoặc mở tab Input / Tests...'
              }
              style={{ color: 'var(--text-primary)' }}
              className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:opacity-60 disabled:opacity-50"
            />
            {((isRunning && mode === 'local') || isWaitingForInput) && (
              <button
                type="button"
                onClick={onSendEof}
                title="Gửi tín hiệu kết thúc nhập (EOF / Ctrl+D)"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-7 px-2 rounded-lg text-[11px] font-mono shrink-0 hover:bg-[var(--bg-hover)]"
              >
                EOF
              </button>
            )}
            <button
              type="submit"
              disabled={isRunning && mode === 'standalone'}
              className="w-8 h-7 rounded-lg accent-btn flex items-center justify-center shrink-0 btn-lift disabled:opacity-45"
            >
              <Send size={12} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
