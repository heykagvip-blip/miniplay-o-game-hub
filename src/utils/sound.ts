// Web Audio API Sound Synthesizer for MiniPlay
// Generates vintage gaming chimes, bounces, points, and victory fanfares completely offline.

import { getSettings } from './storage';

let audioCtx: AudioContext | null = null;
let backgroundMusicTimer: number | null = null;
let backgroundMusicStep = 0;
let musicOutput: GainNode | null = null;
let effectsOutput: GainNode | null = null;
// Per-track gain node used to crossfade smoothly between the calm (dark) and upbeat (light) themes.
let activeMusicFader: GainNode | null = null;

// Time (seconds) for the short, even crossfade between the two themes.
// Kept brief so switching feels instant while still avoiding an abrupt cut.
const MUSIC_CROSSFADE_SECONDS = 0.28;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getAudioOutput(ctx: AudioContext, channel: 'music' | 'effects'): GainNode {
  const existing = channel === 'music' ? musicOutput : effectsOutput;
  if (existing) return existing;

  const output = ctx.createGain();
  const settings = getSettings();
  output.gain.value = (channel === 'music' ? settings.musicVolume : settings.soundVolume) / 100;
  output.connect(ctx.destination);
  if (channel === 'music') musicOutput = output;
  else effectsOutput = output;
  return output;
}

export function setAudioVolumes(musicVolume: number, soundVolume: number): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const musicGain = Math.max(0, Math.min(100, musicVolume)) / 100;
  const effectsGain = Math.max(0, Math.min(100, soundVolume)) / 100;
  musicOutput?.gain.setTargetAtTime(musicGain, now, 0.025);
  effectsOutput?.gain.setTargetAtTime(effectsGain, now, 0.025);
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem('miniplay_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.sound !== false;
    }
  } catch {
    // fallback
  }
  return true;
}

export function isVibrationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem('miniplay_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.vibration !== false;
    }
  } catch {
    // fallback
  }
  return true;
}

export function isBackgroundMusicEnabled(): boolean {
  return getSettings().music !== false;
}

let activeMusicTrack: 'upbeat' | 'calm' | null = null;

// Track 1: Upbeat Arcade Chiptune (Default for Light Theme / Daytime Gaming)
// 128 steps, 16 bars ~31s loop, fast & cheerful
const UPBEAT_MELODY = [
  523.25, 0, 659.25, 783.99, 0, 1046.5, 783.99, 659.25,      // C Maj (Original Phrase 1)
  440.00, 0, 523.25, 698.46, 0, 880.00, 698.46, 587.33,      // F Maj (Original Phrase 2)
  392.00, 0, 493.88, 587.33, 0, 783.99, 698.46, 587.33,      // G Maj
  659.25, 0, 783.99, 659.25, 587.33, 0, 523.25, 0,           // C Maj

  659.25, 0, 880.00, 987.77, 1046.50, 0, 987.77, 880.00,     // A Min
  783.99, 0, 659.25, 783.99, 0, 987.77, 880.00, 783.99,      // E Min
  880.00, 0, 698.46, 880.00, 0, 1046.50, 987.77, 880.00,     // F Maj
  783.99, 0, 587.33, 698.46, 659.25, 0, 587.33, 783.99,      // G7

  1046.50, 0, 783.99, 659.25, 0, 783.99, 1046.50, 1318.51,   // C Maj (Octave jump)
  1174.66, 0, 880.00, 698.46, 0, 880.00, 1046.50, 1174.66,   // F Maj
  1318.51, 0, 1046.50, 783.99, 0, 880.00, 1046.50, 1318.51,  // A Min
  1174.66, 0, 987.77, 783.99, 0, 698.46, 783.99, 987.77,     // G Maj

  1046.50, 0, 880.00, 698.46, 0, 523.25, 698.46, 880.00,     // F Maj chimes
  987.77, 0, 783.99, 587.33, 0, 493.88, 587.33, 783.99,      // G Maj
  830.61, 0, 987.77, 1318.51, 0, 1046.50, 987.77, 880.00,    // E7 -> Am
  783.99, 0, 880.00, 987.77, 1174.66, 0, 987.77, 0,          // G7 Turnaround -> C
];

const UPBEAT_BASSLINE = [
  130.81, 0, 196.00, 0, 130.81, 0, 196.00, 0,
  174.61, 0, 220.00, 0, 174.61, 0, 196.00, 0,
  196.00, 0, 246.94, 0, 196.00, 0, 220.00, 0,
  130.81, 0, 164.81, 0, 196.00, 0, 246.94, 0,

  220.00, 0, 164.81, 0, 220.00, 0, 261.63, 0,
  164.81, 0, 246.94, 0, 164.81, 0, 196.00, 0,
  174.61, 0, 220.00, 0, 174.61, 0, 220.00, 0,
  196.00, 0, 246.94, 0, 196.00, 0, 174.61, 0,

  130.81, 0, 196.00, 0, 130.81, 0, 164.81, 0,
  174.61, 0, 220.00, 0, 174.61, 0, 196.00, 0,
  220.00, 0, 164.81, 0, 220.00, 0, 261.63, 0,
  196.00, 0, 246.94, 0, 196.00, 0, 220.00, 0,

  174.61, 0, 220.00, 0, 174.61, 0, 220.00, 0,
  196.00, 0, 246.94, 0, 196.00, 0, 220.00, 0,
  164.81, 0, 246.94, 0, 220.00, 0, 164.81, 0,
  196.00, 0, 246.94, 0, 196.00, 0, 98.00, 0,
];

const UPBEAT_CHORDS: number[][] = [
  [261.63, 329.63, 392.00],          // C Maj
  [349.23, 440.00, 523.25],          // F Maj
  [196.00, 246.94, 293.66],          // G Maj
  [261.63, 329.63, 392.00],          // C Maj
  [220.00, 261.63, 329.63],          // Am
  [164.81, 196.00, 246.94],          // Em
  [174.61, 220.00, 261.63],          // F Maj
  [196.00, 246.94, 293.66, 349.23],  // G7
  [261.63, 329.63, 392.00],          // C Maj
  [349.23, 440.00, 523.25],          // F Maj
  [220.00, 261.63, 329.63],          // Am
  [196.00, 246.94, 293.66],          // G Maj
  [174.61, 220.00, 261.63],          // F Maj
  [196.00, 246.94, 293.66],          // G Maj
  [164.81, 207.65, 246.94, 293.66],  // E7
  [196.00, 246.94, 293.66, 349.23],  // G7
];

// Track 2: Calm Lullaby / Melodic Night Theme (Default for Dark Theme / Relaxing Night)
// 128 steps, 16 bars ~46s loop, gentle, atmospheric, dreamy celesta & 7th chords
const CALM_MELODY = [
  // Section 1: Twilight Serenade (Bars 1-4)
  659.25, 0, 783.99, 987.77, 1046.50, 0, 987.77, 783.99,     // Cmaj7 (E5 -> G5 -> B5 -> C6)
  659.25, 0, 880.00, 987.77, 0, 1046.50, 987.77, 659.25,     // Am9
  880.00, 0, 1046.50, 1318.51, 1174.66, 0, 1046.50, 880.00,   // Fmaj7
  783.99, 0, 987.77, 1174.66, 0, 1046.50, 987.77, 783.99,     // Em7

  // Section 2: Soft Floating Lullaby (Bars 5-8)
  698.46, 0, 880.00, 1046.50, 1318.51, 0, 1174.66, 880.00,   // Dm9
  783.99, 0, 987.77, 1174.66, 0, 1318.51, 1174.66, 987.77,   // Em7
  1046.50, 0, 1318.51, 1174.66, 1046.50, 0, 987.77, 880.00,  // Fmaj9
  987.77, 0, 783.99, 587.33, 0, 659.25, 587.33, 0,          // G7sus4

  // Section 3: Music Box Dream (Bars 9-12)
  1318.51, 0, 1174.66, 1046.50, 987.77, 0, 783.99, 659.25,   // Cmaj7 (Octave shimmer)
  1046.50, 0, 987.77, 880.00, 783.99, 0, 659.25, 523.25,     // Am9
  880.00, 0, 1046.50, 1318.51, 0, 1567.98, 1318.51, 1046.50, // Fmaj7
  987.77, 0, 1174.66, 1567.98, 0, 1318.51, 1174.66, 987.77,  // Em7

  // Section 4: Gentle Night Stars & Turnaround (Bars 13-16)
  880.00, 0, 1046.50, 1396.91, 0, 1318.51, 1174.66, 880.00,  // Dm7
  783.99, 0, 987.77, 1174.66, 0, 1396.91, 1318.51, 1174.66,  // G6
  659.25, 0, 830.61, 987.77, 0, 1046.50, 987.77, 880.00,    // E7 -> Am
  783.99, 0, 987.77, 1174.66, 0, 987.77, 783.99, 0,          // G13 -> C
];

const CALM_BASSLINE = [
  130.81, 0, 196.00, 0, 261.63, 0, 196.00, 0,
  110.00, 0, 164.81, 0, 220.00, 0, 164.81, 0,
  174.61, 0, 220.00, 0, 261.63, 0, 220.00, 0,
  164.81, 0, 196.00, 0, 246.94, 0, 196.00, 0,

  146.83, 0, 220.00, 0, 261.63, 0, 220.00, 0,
  164.81, 0, 196.00, 0, 246.94, 0, 196.00, 0,
  174.61, 0, 220.00, 0, 261.63, 0, 220.00, 0,
  196.00, 0, 246.94, 0, 293.66, 0, 196.00, 0,

  130.81, 0, 196.00, 0, 261.63, 0, 196.00, 0,
  110.00, 0, 164.81, 0, 220.00, 0, 164.81, 0,
  174.61, 0, 220.00, 0, 261.63, 0, 220.00, 0,
  164.81, 0, 196.00, 0, 246.94, 0, 196.00, 0,

  146.83, 0, 220.00, 0, 261.63, 0, 220.00, 0,
  196.00, 0, 246.94, 0, 293.66, 0, 246.94, 0,
  164.81, 0, 207.65, 0, 220.00, 0, 164.81, 0,
  196.00, 0, 246.94, 0, 196.00, 0, 130.81, 0,
];

const CALM_CHORDS: number[][] = [
  [261.63, 329.63, 392.00, 493.88],          // Cmaj7
  [220.00, 261.63, 329.63, 392.00],          // Am7
  [174.61, 220.00, 261.63, 329.63],          // Fmaj7
  [164.81, 196.00, 246.94, 293.66],          // Em7
  [146.83, 174.61, 220.00, 261.63],          // Dm7
  [164.81, 196.00, 246.94, 293.66],          // Em7
  [174.61, 220.00, 261.63, 329.63],          // Fmaj7
  [196.00, 246.94, 293.66, 349.23],          // G7
  [261.63, 329.63, 392.00, 493.88],          // Cmaj7
  [220.00, 261.63, 329.63, 392.00],          // Am7
  [174.61, 220.00, 261.63, 329.63],          // Fmaj7
  [164.81, 196.00, 246.94, 293.66],          // Em7
  [146.83, 174.61, 220.00, 261.63],          // Dm7
  [196.00, 246.94, 293.66, 349.23],          // G7
  [164.81, 207.65, 246.94, 293.66],          // E7
  [196.00, 246.94, 293.66, 392.00],          // G
];

export function startBackgroundMusic(explicitStyle?: 'auto' | 'upbeat' | 'calm' | 'dark' | 'light'): void {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx || !isSoundEnabled() || !isBackgroundMusicEnabled()) {
    stopBackgroundMusic();
    return;
  }

  // Determine active track style:
  // - Light Mode -> 'upbeat' (Sunny Arcade)
  // - Dark Mode -> 'calm' (Dreamy Lullaby / Du dương êm đềm)
  const settings = getSettings();
  let targetStyle: 'upbeat' | 'calm' = 'upbeat';

  if (explicitStyle === 'calm' || explicitStyle === 'dark') {
    targetStyle = 'calm';
  } else if (explicitStyle === 'upbeat' || explicitStyle === 'light') {
    targetStyle = 'upbeat';
  } else {
    const userPref = settings.musicStyle || 'auto';
    if (userPref === 'calm') {
      targetStyle = 'calm';
    } else if (userPref === 'upbeat') {
      targetStyle = 'upbeat';
    } else {
      // Auto based on current active theme
      const isLight = settings.theme === 'light' || document.documentElement.classList.contains('light');
      targetStyle = isLight ? 'upbeat' : 'calm';
    }
  }

  // If already playing the requested track, continue playing seamlessly
  if (backgroundMusicTimer !== null && activeMusicTrack === targetStyle) {
    return;
  }

  // Stop scheduling new notes for the previous track; its lingering notes are crossfaded below.
  if (backgroundMusicTimer !== null) {
    window.clearInterval(backgroundMusicTimer);
    backgroundMusicTimer = null;
  }

  // --- Short, even crossfade between the dark (calm) and light (upbeat) themes ---
  // Each track plays through its own gain "fader". A LINEAR ramp is used (instead of
  // exponential) so the incoming theme rises steadily and is never stuck near silence,
  // which removes the long quiet dip when switching.
  const previousFader = activeMusicFader;
  if (previousFader) {
    activeMusicFader = null;
    const fadeOutStart = ctx.currentTime;
    previousFader.gain.cancelScheduledValues(fadeOutStart);
    previousFader.gain.setValueAtTime(previousFader.gain.value, fadeOutStart);
    previousFader.gain.linearRampToValueAtTime(0, fadeOutStart + MUSIC_CROSSFADE_SECONDS);
    // Detach once the fade is complete so any lingering notes cannot leak through.
    window.setTimeout(() => {
      try {
        previousFader.disconnect();
      } catch {
        // ignore
      }
    }, MUSIC_CROSSFADE_SECONDS * 1000 + 150);
  }

  const masterMusic = getAudioOutput(ctx, 'music');
  const fader = ctx.createGain();
  fader.gain.setValueAtTime(0, ctx.currentTime);
  fader.connect(masterMusic);
  // Even, linear fade-in so the new melody is audible right away.
  fader.gain.linearRampToValueAtTime(1, ctx.currentTime + MUSIC_CROSSFADE_SECONDS);
  activeMusicFader = fader;

  activeMusicTrack = targetStyle;
  backgroundMusicStep = 0;

  const isCalm = targetStyle === 'calm';
  const melody = isCalm ? CALM_MELODY : UPBEAT_MELODY;
  const bassline = isCalm ? CALM_BASSLINE : UPBEAT_BASSLINE;
  const chords = isCalm ? CALM_CHORDS : UPBEAT_CHORDS;
  const stepDuration = isCalm ? 360 : 240;

  const scheduleTone = (
    frequency: number,
    type: OscillatorType,
    volume: number,
    duration: number,
    endFrequency?: number,
    attackSeconds?: number,
    vibratoCents?: number
  ) => {
    const noteStart = ctx.currentTime;
    // A softer, longer attack on the calm theme removes the harsh "click" of the lead.
    const attack = Math.min(attackSeconds ?? (isCalm ? 0.07 : 0.012), duration * 0.6);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, noteStart + duration);

    // Optional gentle vibrato gives the night lead a warm, singing ("du dương") tone.
    if (vibratoCents && vibratoCents > 0) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(4.8, noteStart);
      lfoGain.gain.setValueAtTime(vibratoCents, noteStart);
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.detune);
      lfo.start(noteStart);
      lfo.stop(noteStart + duration);
    }

    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(volume, noteStart + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
    oscillator.connect(gain);
    gain.connect(fader);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + duration);
  };

  const playStep = () => {
    const activeCtx = getAudioContext();
    if (!activeCtx || !isSoundEnabled() || !isBackgroundMusicEnabled()) {
      stopBackgroundMusic();
      return;
    }

    const step = backgroundMusicStep;
    const melodyNote = melody[step];
    const bassNote = bassline[step];
    backgroundMusicStep = (backgroundMusicStep + 1) % melody.length;

    if (isCalm) {
      // === CALM NIGHT THEME (du dương, êm ái, thư thái - hết "thô") ===
      if (melodyNote > 0) {
        // Soft, singing sine lead: gentle attack + light vibrato + long legato tail
        scheduleTone(melodyNote, 'sine', 0.02, 0.5, undefined, 0.09, 9);
        // Delicate music-box octave shimmer (barely-there sparkle)
        scheduleTone(melodyNote * 2, 'sine', 0.0026, 0.32, undefined, 0.12);
      }

      if (bassNote > 0) {
        // Warm, rounded bass only (the old thin sub-octave doubling sounded muddy)
        scheduleTone(bassNote, 'triangle', 0.023, 0.46, undefined, 0.12);
      }

      // Bar downbeat: a feather-light, slowly swelling 7th-chord pad
      // (replaces the old low "heartbeat thump" that made the theme sound rough)
      if (step % 8 === 0) {
        const barIndex = Math.floor(step / 8);
        const currentChord = chords[barIndex % chords.length];
        if (currentChord) {
          currentChord.forEach(note => scheduleTone(note, 'sine', 0.0055, 2.2, undefined, 0.5));
        }
      }

      // Occasional soft, lingering bell on beat 3 (gentle bell, not a clicky sweep)
      if (step % 8 === 4) {
        scheduleTone(1567.98, 'sine', 0.0022, 1.0, undefined, 0.16);
      }
    } else {
      // === UPBEAT SUNNY THEME (Vui tươi, sinh động, arcade) ===
      if (melodyNote > 0) {
        scheduleTone(melodyNote, 'square', 0.018, 0.19);
        scheduleTone(melodyNote / 2, 'triangle', 0.008, 0.2);
      }

      if (bassNote > 0) {
        scheduleTone(bassNote, 'triangle', 0.038, 0.22);
      }

      // Bar downbeat: kick + upbeat chord
      if (step % 8 === 0) {
        scheduleTone(92, 'sine', 0.04, 0.12, 48);
        const barIndex = Math.floor(step / 8);
        const currentChord = chords[barIndex % chords.length];
        if (currentChord) {
          currentChord.forEach(note => scheduleTone(note, 'sine', 0.008, 0.42));
        }
      }

      // Beat 3 snare/clap
      if (step % 8 === 4) {
        scheduleTone(220, 'square', 0.012, 0.05, 90);
        scheduleTone(1500, 'sine', 0.006, 0.035, 500);
      }

      // Offbeat hi-hat chime
      if (step % 4 === 2) {
        scheduleTone(1400, 'sine', 0.005, 0.035, 900);
      }
    }
  };

  backgroundMusicStep = 0;
  playStep();
  backgroundMusicTimer = window.setInterval(playStep, stepDuration);
}

export function stopBackgroundMusic(): void {
  if (typeof window !== 'undefined' && backgroundMusicTimer !== null) {
    window.clearInterval(backgroundMusicTimer);
    backgroundMusicTimer = null;
    activeMusicTrack = null;
  }
  backgroundMusicStep = 0;

  // Fade the active track out gently instead of cutting it off instantly.
  const fader = activeMusicFader;
  activeMusicFader = null;
  if (fader && audioCtx) {
    const now = audioCtx.currentTime;
    fader.gain.cancelScheduledValues(now);
    fader.gain.setValueAtTime(fader.gain.value, now);
    fader.gain.linearRampToValueAtTime(0, now + MUSIC_CROSSFADE_SECONDS);
    window.setTimeout(() => {
      try {
        fader.disconnect();
      } catch {
        // ignore
      }
    }, MUSIC_CROSSFADE_SECONDS * 1000 + 150);
  }
}

export function triggerHaptic(duration = 25): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && isVibrationEnabled()) {
    try {
      navigator.vibrate(duration);
    } catch {
      // ignore
    }
  }
}

// 1. Move / Click sound
export function playMoveSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(getAudioOutput(ctx, 'effects'));

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Ignore audio errors
  }
}

// 2. Score / Eat Food / Point sound
export function playScoreSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(getAudioOutput(ctx, 'effects'));

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}

// 3. Clear line / Tile merge / Match sound
export function playClearSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.04);

      gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.04 + 0.12);

      osc.connect(gain);
      gain.connect(getAudioOutput(ctx, 'effects'));

      osc.start(ctx.currentTime + idx * 0.04);
      osc.stop(ctx.currentTime + idx * 0.04 + 0.12);
    });
  } catch {
    // ignore
  }
}

// 4. Game Over / Loss sound
export function playGameOverSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(getAudioOutput(ctx, 'effects'));

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // ignore
  }
}

// 5. Victory / High Score celebration fanfare
export function playVictorySound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const melody = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    melody.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startTime = ctx.currentTime + idx * 0.09;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.14, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(getAudioOutput(ctx, 'effects'));

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  } catch {
    // ignore
  }
}

// 6. Jump sound (for Flappy Bird / Doodle Jump)
export function playJumpSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(getAudioOutput(ctx, 'effects'));

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore
  }
}

// 7. Bounce / Hit sound (for Breakout / Mole Whack)
export function playBounceSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(getAudioOutput(ctx, 'effects'));

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // ignore
  }
}

