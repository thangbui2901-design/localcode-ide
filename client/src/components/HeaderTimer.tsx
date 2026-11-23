import React, { useEffect, useRef, useState } from 'react';
import { Timer, Play, Pause, RotateCcw, Bell, ChevronDown } from 'lucide-react';

type TimerMode = 'countdown' | 'stopwatch';

const PRESET_MINUTES = [15, 25, 45, 60];

function playTimerFinishChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [587.33, 783.99, 1046.5]; // D5 -> G5 -> C6 êm dịu
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  } catch {
    // Bỏ qua nếu trình duyệt chặn audio
  }
}

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

interface HeaderTimerProps {
  align?: 'left' | 'right';
}

export const HeaderTimer: React.FC<HeaderTimerProps> = ({ align = 'right' }) => {
  const [mode, setMode] = useState<TimerMode>(() => {
    const saved = localStorage.getItem('codeide_timer_mode');
    return saved === 'stopwatch' ? 'stopwatch' : 'countdown';
  });

  const [targetMinutes, setTargetMinutes] = useState<number>(() => {
    const saved = Number(localStorage.getItem('codeide_timer_minutes'));
    return saved >= 1 && saved <= 240 ? saved : 25;
  });

  const [seconds, setSeconds] = useState<number>(() => {
    const savedMode = localStorage.getItem('codeide_timer_mode');
    if (savedMode === 'stopwatch') return 0;
    const savedMin = Number(localStorage.getItem('codeide_timer_minutes'));
    return (savedMin >= 1 && savedMin <= 240 ? savedMin : 25) * 60;
  });

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customMinInput, setCustomMinInput] = useState<string>(() => String(targetMinutes));

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('codeide_timer_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('codeide_timer_minutes', String(targetMinutes));
  }, [targetMinutes]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [popoverOpen]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((prev) => {
        if (mode === 'stopwatch') {
          return prev + 1;
        }
        if (prev <= 1) {
          setRunning(false);
          setFinished(true);
          playTimerFinishChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode]);

  const handleSelectMode = (nextMode: TimerMode) => {
    setRunning(false);
    setFinished(false);
    setMode(nextMode);
    setSeconds(nextMode === 'countdown' ? targetMinutes * 60 : 0);
  };

  const handleApplyMinutes = (mins: number) => {
    const clamped = Math.min(240, Math.max(1, Math.round(mins)));
    setRunning(false);
    setFinished(false);
    setMode('countdown');
    setTargetMinutes(clamped);
    setCustomMinInput(String(clamped));
    setSeconds(clamped * 60);
  };

  const handleToggleRun = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (finished && mode === 'countdown') {
      setFinished(false);
      setSeconds(targetMinutes * 60);
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  };

  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRunning(false);
    setFinished(false);
    setSeconds(mode === 'countdown' ? targetMinutes * 60 : 0);
  };

  const totalTargetSec = Math.max(1, targetMinutes * 60);
  const progressPct =
    mode === 'countdown'
      ? Math.min(100, Math.max(0, ((totalTargetSec - seconds) / totalTargetSec) * 100))
      : 0;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      {/* NÚT PILL TRÊN HEADER */}
      <div
        onClick={() => setPopoverOpen((v) => !v)}
        style={{
          backgroundColor: finished
            ? 'var(--bg-active)'
            : running
              ? 'var(--bg-active)'
              : 'var(--bg-elevated)',
          color: 'var(--text-primary)'
        }}
        className="h-8 px-2 rounded-xl flex items-center gap-1.5 text-xs font-medium cursor-pointer btn-lift"
        title="Đồng hồ bấm giờ luyện tập (Bấm để chỉnh giờ)"
      >
        {finished ? (
          <Bell size={14} style={{ color: 'var(--accent-primary)' }} className="animate-bounce" />
        ) : (
          <Timer
            size={14}
            style={{ color: running ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          />
        )}

        <span
          style={{ color: running || finished ? 'var(--accent-primary)' : 'var(--text-primary)' }}
          className="font-mono font-bold tabular-nums tracking-tight"
        >
          {formatDuration(seconds)}
        </span>

        <button
          type="button"
          onClick={handleToggleRun}
          style={{
            backgroundColor: running ? 'var(--accent-primary)' : 'var(--bg-panel)',
            color: running ? '#FFFFFF' : 'var(--text-primary)'
          }}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
          title={running ? 'Tạm dừng' : 'Bắt đầu đếm'}
        >
          {running ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
        </button>

        <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} className="hidden sm:block" />
      </div>

      {/* POPOVER CHỈNH GIỜ ĐỒNG BỘ THEME */}
      {popoverOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-card)'
          }}
          className={`absolute ${
            align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
          } mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-3.5 z-50 ios-popover-enter space-y-3 border border-[var(--border-subtle)]`}
        >
          {/* Chọn chế độ Đếm ngược / Bấm giờ tăng */}
          <div
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="p-1 rounded-xl grid grid-cols-2 gap-1"
          >
            <button
              type="button"
              onClick={() => handleSelectMode('countdown')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'countdown'
                  ? 'accent-pill-active'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Đếm ngược
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('stopwatch')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'stopwatch'
                  ? 'accent-pill-active'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Bấm giờ tăng
            </button>
          </div>

          {/* Màn hình hiển thị số lớn */}
          <div
            style={{ backgroundColor: 'var(--bg-panel-alt)' }}
            className="p-3 rounded-2xl flex flex-col items-center justify-center gap-2"
          >
            <div
              style={{ color: finished ? 'var(--accent-primary)' : 'var(--text-primary)' }}
              className="text-3xl font-mono font-extrabold tabular-nums tracking-wider"
            >
              {formatDuration(seconds)}
            </div>

            {mode === 'countdown' && (
              <div
                style={{ backgroundColor: 'var(--bg-elevated)' }}
                className="w-full h-1.5 rounded-full overflow-hidden"
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
                  }}
                  className="h-full rounded-full transition-all duration-500"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 w-full">
              <button
                type="button"
                onClick={() => handleToggleRun()}
                className="flex-1 h-8 rounded-xl accent-btn text-xs font-semibold flex items-center justify-center gap-1.5 btn-lift"
              >
                {running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                <span>{running ? 'Tạm dừng' : finished ? 'Chạy lại' : 'Bắt đầu'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleReset()}
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                className="h-8 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1 btn-lift"
                title="Đặt lại về ban đầu"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Cài đặt mốc phút (khi ở chế độ Đếm ngược) */}
          {mode === 'countdown' && (
            <div className="space-y-2">
              <span
                className="block text-[11px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Chọn nhanh thời gian (phút)
              </span>

              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_MINUTES.map((m) => {
                  const active = targetMinutes === m && seconds === m * 60;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleApplyMinutes(m)}
                      className={`py-1.5 rounded-xl text-xs font-semibold transition-all btn-lift ${
                        active
                          ? 'accent-pill-active'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {m}p
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = Number(customMinInput);
                  if (Number.isFinite(val) && val >= 1) {
                    handleApplyMinutes(val);
                  }
                }}
                className="flex items-center gap-1.5 pt-1"
              >
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={customMinInput}
                  onChange={(e) => setCustomMinInput(e.target.value)}
                  placeholder="Số phút..."
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  className="flex-1 h-8 px-2.5 rounded-xl text-xs font-semibold outline-none"
                />
                <button
                  type="submit"
                  style={{ backgroundColor: 'var(--bg-active)', color: 'var(--accent-primary)' }}
                  className="h-8 px-3 rounded-xl text-xs font-bold btn-lift"
                >
                  Đặt giờ
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};