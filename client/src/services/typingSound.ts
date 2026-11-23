let audioCtx: AudioContext | null = null;

export type KeySoundKind = 'normal' | 'space' | 'enter' | 'backspace';
export type KeySoundProfile = 'waterdrop' | 'creamy' | 'typewriter';

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    ensureAudioContext();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export function getSavedSoundProfile(): KeySoundProfile {
  if (typeof window === 'undefined') return 'waterdrop';
  const saved = localStorage.getItem('codeide_sound_profile') as KeySoundProfile | null;
  return saved === 'creamy' || saved === 'typewriter' || saved === 'waterdrop' ? saved : 'waterdrop';
}

export function getSavedSoundVolume(): number {
  if (typeof window === 'undefined') return 0.5;
  const raw = localStorage.getItem('codeide_sound_volume');
  if (raw === null) return 0.5;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.5;
}

export function playSoftKeyClick(
  kind: KeySoundKind = 'normal',
  profile: KeySoundProfile = getSavedSoundProfile(),
  volumeScale: number = getSavedSoundVolume()
) {
  if (volumeScale <= 0) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const trigger = () => {
    const now = ctx.currentTime;
    const rand = 0.96 + Math.random() * 0.08;
    // Nhân hệ số volume (mức 50% tương đương 1.0x chuẩn mặc định, 100% là 2.0x)
    const gainMultiplier = volumeScale * 2;

    if (profile === 'waterdrop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      let startFreq = 520 * rand;
      let endFreq = 860 * rand;
      let vol = 0.14 * gainMultiplier;
      let dur = 0.042;

      if (kind === 'space') {
        startFreq = 380 * rand;
        endFreq = 620 * rand;
        vol = 0.17 * gainMultiplier;
        dur = 0.052;
      } else if (kind === 'enter') {
        startFreq = 440 * rand;
        endFreq = 780 * rand;
        vol = 0.17 * gainMultiplier;
        dur = 0.055;
      } else if (kind === 'backspace') {
        startFreq = 620 * rand;
        endFreq = 410 * rand;
        vol = 0.14 * gainMultiplier;
        dur = 0.04;
      }

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.min(0.85, vol), now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.005);
      return;
    }

    if (profile === 'creamy') {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const base =
        kind === 'space' ? 195 : kind === 'enter' ? 225 : kind === 'backspace' ? 245 : 275 * rand;
      const dur = kind === 'space' ? 0.055 : 0.042;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.min(0.95, 0.28 * gainMultiplier), now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.005);
      return;
    }

    // Marimba gỗ
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq =
      kind === 'space' ? 330 : kind === 'enter' ? 392 : kind === 'backspace' ? 440 : 523.25 * rand;
    const dur = 0.036;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.85, 0.16 * gainMultiplier), now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.005);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(trigger).catch(() => {});
  } else {
    trigger();
  }
}