import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playBounceSound,
  playClearSound,
  playMoveSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';
import { Check, Lightbulb, Minus, Plus } from 'lucide-react';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  label: string;
  blurb: string;
  pool: string[];
  baseScore: number;
  timeBonusPerSec: number;
  timeLimit: number;
  maxHints: number;
  hintPenalty: number;
  fullGrid: boolean;
}

export interface Feedback {
  kind: 'shift' | 'phrase' | 'timeout';
  ok: boolean;
  title: string;
  detail: string;
  correctWords: number;
  totalWords: number;
}

export interface RoundState {
  phrase: string;
  secretShift: number;
  shift: number;
  typed: string;
  hints: number[];
  checks: number;
  startedAt: number;
  endedAt: number | null;
  won: boolean;
  feedback: Feedback | null;
}

const EASY_PHRASES: string[] = [
  'BUU CHINH LUU NIEM MOT LUC QUEN',
  'SONG DEO BAN TAY CHAN TRON',
  'TAI GIA NANG LAM CHI THA',
  'BIET NGHIA HAY LUA DAO',
  'TRAI CAY COT DAI NAY',
  'GIAO NHAO CHU THA GIA NANG',
];

const MEDIUM_PHRASES: string[] = [
  'CUU CHINH TAI LUC NGHIA',
  'LOI RACH DAU MOC',
  'MOT XUAT CHI DAI CHUNG',
  'BICH NANG VUA COI',
  'DONG HOA DONG TON',
  'GIU TRON CHUA NEN LONG',
];

const HARD_PHRASES: string[] = [
  'CUU NGUON TUYNH DANG',
  'CHU THA TAI GIA NANG',
  'CON GAI QUANG TRI',
  'HOP HONG CAO BAO',
  'KHOA HOC LAM DAU',
  'VANG NUOC RACH DAO',
];

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Dễ',
    blurb: 'Câu dài, nổi tiếng',
    pool: EASY_PHRASES,
    baseScore: 500,
    timeBonusPerSec: 3,
    timeLimit: 300,
    maxHints: 2,
    hintPenalty: 120,
    fullGrid: true,
  },
  medium: {
    label: 'Trung bình',
    blurb: 'Câu vừa phải',
    pool: MEDIUM_PHRASES,
    baseScore: 900,
    timeBonusPerSec: 3,
    timeLimit: 240,
    maxHints: 1,
    hintPenalty: 180,
    fullGrid: false,
  },
  hard: {
    label: 'Khó',
    blurb: 'Câu ngắn, bí ẩn',
    pool: HARD_PHRASES,
    baseScore: 1400,
    timeBonusPerSec: 3,
    timeLimit: 200,
    maxHints: 1,
    hintPenalty: 260,
    fullGrid: false,
  },
};

export const SHIFT_VALUES: number[] = Array.from({ length: 25 }, (_, i) => i + 1);

const normalizeOffset = (offset: number): number => {
  if (!Number.isFinite(offset)) return 0;
  return ((Math.round(offset) % 26) + 26) % 26;
};

export const rotateText = (text: string, offset: number, avoidIdentity = false): string => {
  const step = normalizeOffset(offset);
  const shift = step === 0 && avoidIdentity ? 1 : step;
  if (shift === 0) return text;
  return text.replace(/[a-z]/gi, char => {
    const base = char <= 'Z' ? 65 : 97;
    const index = char.charCodeAt(0) - base;
    const moved = (index + shift) % 26;
    return String.fromCharCode(base + moved);
  });
};

export const pickSecretShift = (random: () => number = Math.random): number => {
  const candidates = SHIFT_VALUES.filter(value => value !== 13);
  return candidates[Math.floor(random() * candidates.length)] ?? 7;
};

export const splitWords = (text: string): string[] => text.split(' ').filter(word => word.length > 0);

export const normalizeTyped = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const countCorrectWords = (guess: string, phrase: string): number => {
  const guessed = splitWords(guess);
  const target = splitWords(phrase);
  let correct = 0;
  for (let i = 0; i < Math.max(guessed.length, target.length); i += 1) {
    if (guessed[i] === target[i]) correct += 1;
  }
  return correct;
};

export const pickHintIndex = (
  phrase: string,
  used: number[],
  random: () => number = Math.random,
): number | null => {
  const candidates = splitWords(phrase)
    .map((word, index) => ({ word, index }))
    .filter(item => !used.includes(item.index) && item.word.length >= 3);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.word.length - a.word.length);
  const shortlist = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
  return shortlist[Math.floor(random() * shortlist.length)].index;
};

export const createRound = (difficulty: Difficulty, random: () => number = Math.random): RoundState => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const secretShift = pickSecretShift(random);
  const shift = pickSecretShift(random);
  return {
    phrase: config.pool[Math.floor(random() * config.pool.length)],
    secretShift,
    shift: shift === secretShift ? (shift === 25 ? 1 : shift + 1) : shift,
    typed: '',
    hints: [],
    checks: 0,
    startedAt: Date.now(),
    endedAt: null,
    won: false,
    feedback: null,
  };
};

export const computeScore = (difficulty: Difficulty, elapsed: number, hintsUsed: number, won: boolean): number => {
  if (!won) return 0;
  const config = DIFFICULTY_CONFIG[difficulty];
  const timeLeft = Math.max(0, config.timeLimit - elapsed);
  const raw = config.baseScore + timeLeft * config.timeBonusPerSec - hintsUsed * config.hintPenalty;
  const floor = Math.round(config.baseScore * 0.3);
  return Math.max(floor, Math.round(raw));
};

export const formatClock = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

const CipherLine: React.FC<{ text: string; size: 'sm' | 'lg' }> = ({ text, size }) => (
  <p
    className={`break-words text-center font-mono font-bold uppercase leading-loose tracking-[0.2em] ${
      size === 'lg' ? 'text-lg sm:text-2xl' : 'text-sm sm:text-base'
    }`}
    style={{ color: 'var(--text-primary)' }}
  >
    {splitWords(text).map((word, index) => (
      <span key={`${word}-${index}`} className="inline-block">
        {word}
        {index < splitWords(text).length - 1 ? ' ' : ''}
      </span>
    ))}
  </p>
);

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="w-full rounded-2xl border px-3 py-3 theme-border" style={{ background: 'var(--surface-soft)' }}>
    <div className="mb-1.5 text-center text-[10px] font-black uppercase tracking-[0.2em] theme-muted">{label}</div>
    {children}
  </div>
);

export const CryptogramGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [round, setRound] = useState<RoundState>(() => createRound('medium'));
  const [now, setNow] = useState(() => Date.now());
  const roundRef = useRef<RoundState>(round);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  const config = DIFFICULTY_CONFIG[difficulty];
  const cipher = useMemo(() => rotateText(round.phrase, round.secretShift, true), [round.phrase, round.secretShift]);
  const trial = useMemo(() => rotateText(cipher, -round.shift), [cipher, round.shift]);
  const words = useMemo(() => splitWords(round.phrase), [round.phrase]);
  const typedWords = useMemo(() => splitWords(normalizeTyped(round.typed)), [round.typed]);
  const ended = round.endedAt !== null;
  const hintsLeft = config.maxHints - round.hints.length;

  const elapsed = ended
    ? Math.max(0, Math.floor(((round.endedAt as number) - round.startedAt) / 1000))
    : Math.max(0, Math.floor((now - round.startedAt) / 1000));
  const timeLeft = Math.max(0, config.timeLimit - elapsed);
  const potential = computeScore(difficulty, elapsed, round.hints.length, true);
  const score = ended ? computeScore(difficulty, elapsed, round.hints.length, round.won) : potential;

  const commit = useCallback((next: RoundState) => {
    roundRef.current = next;
    setRound(next);
  }, []);

  const startRound = useCallback(
    (next: Difficulty) => {
      setDifficulty(next);
      setNow(Date.now());
      commit(createRound(next));
    },
    [commit],
  );

  useEffect(() => {
    if (ended) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [ended]);

  useEffect(() => {
    const current = roundRef.current;
    if (current.endedAt !== null) return;
    if (timeLeft > 0) return;
    playBounceSound();
    commit({
      ...current,
      endedAt: Date.now(),
      won: false,
      feedback: {
        kind: 'timeout',
        ok: false,
        title: 'Hết giờ!',
        detail: `Số dịch đúng là ${current.secretShift}.`,
        correctWords: 0,
        totalWords: splitWords(current.phrase).length,
      },
    });
  }, [timeLeft, commit]);

  const changeShift = useCallback(
    (value: number) => {
      const current = roundRef.current;
      if (current.endedAt !== null) return;
      const next = Math.min(25, Math.max(1, value));
      if (next === current.shift) return;
      playMoveSound();
      commit({ ...current, shift: next });
    },
    [commit],
  );

  const useHint = useCallback(() => {
    const current = roundRef.current;
    if (current.endedAt !== null || current.hints.length >= DIFFICULTY_CONFIG[difficulty].maxHints) return;
    const index = pickHintIndex(current.phrase, current.hints);
    if (index === null) return;
    playScoreSound();
    triggerHaptic(18);
    commit({ ...current, hints: [...current.hints, index] });
  }, [commit, difficulty]);

  const check = useCallback(() => {
    const current = roundRef.current;
    if (current.endedAt !== null) return;
    const targetWords = splitWords(current.phrase);
    const totalWords = targetWords.length;
    const typed = normalizeTyped(current.typed);
    const checks = current.checks + 1;

    if (typed.length > 0) {
      if (typed === current.phrase) {
        playClearSound();
        playScoreSound();
        triggerHaptic(25);
        commit({
          ...current,
          checks,
          won: true,
          endedAt: Date.now(),
          feedback: {
            kind: 'phrase',
            ok: true,
            title: 'Chính xác!',
            detail: `Bạn đã giải ra câu trong ${checks} lần kiểm tra với số dịch ${current.secretShift}.`,
            correctWords: totalWords,
            totalWords,
          },
        });
        return;
      }
      playBounceSound();
      commit({
        ...current,
        checks,
        feedback: {
          kind: 'phrase',
          ok: false,
          title: 'Chưa đúng câu này',
          detail: `${countCorrectWords(typed, current.phrase)}/${totalWords} từ đúng.`,
          correctWords: countCorrectWords(typed, current.phrase),
          totalWords,
        },
      });
      return;
    }

    if (current.shift === current.secretShift) {
      playClearSound();
      playScoreSound();
      triggerHaptic(25);
      commit({
        ...current,
        checks,
        won: true,
        endedAt: Date.now(),
        feedback: {
          kind: 'shift',
          ok: true,
          title: 'Số dịch chính xác!',
          detail: `Độ dời đúng là ${current.secretShift}. Bạn tìm ra sau ${checks} lần kiểm tra.`,
          correctWords: totalWords,
          totalWords,
        },
      });
      return;
    }

    playBounceSound();
    const correct = countCorrectWords(rotateText(rotateText(current.phrase, current.secretShift, true), -current.shift), current.phrase);
    commit({
      ...current,
      checks,
      feedback: {
        kind: 'shift',
        ok: false,
        title: 'Số dịch chưa đúng',
        detail: `${correct}/${totalWords} từ đúng. Thử số khác rồi bấm Kiểm tra.`,
        correctWords: correct,
        totalWords,
      },
    });
  }, [commit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        changeShift(roundRef.current.shift + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        changeShift(roundRef.current.shift - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        check();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeShift, check]);

  const feedback = round.feedback;
  const showWordMarks = feedback !== null && !feedback.ok && feedback.kind !== 'timeout';

  return (
    <GameShell
      game={getGameById('cryptogram')!}
      score={score}
      isGameOver={ended}
      isVictory={round.won}
      isPaused={false}
      onRestart={() => startRound(difficulty)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-1 theme-border"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] font-bold uppercase theme-muted">Còn:</span>
          <span className="text-sm font-black" style={{ color: timeLeft <= 30 ? '#e11d48' : '#34d399' }}>
            {formatClock(timeLeft)}
          </span>
          <span className="text-[10px] theme-muted">· Dịch {round.shift}</span>
        </div>
      }
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-3">
        <div className="grid w-full grid-cols-3 gap-2">
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
            const item = DIFFICULTY_CONFIG[key];
            const active = key === difficulty;
            return (
              <button
                key={key}
                onClick={() => startRound(key)}
                className={`rounded-xl border px-2 py-2 text-xs font-black transition-transform active:translate-y-[2px] ${
                  active ? 'border-transparent text-white' : 'theme-panel-soft theme-text theme-border'
                }`}
                style={active ? { background: '#4f46e5' } : undefined}
              >
                {item.label}
                <span className="block text-[10px] font-semibold opacity-80">{item.blurb}</span>
              </button>
            );
          })}
        </div>

        <Section label="Mật mã đã mã hóa">
          <CipherLine text={cipher} size="sm" />
        </Section>

        <Section label={`Sau khi dịch ${round.shift}`}>
          <CipherLine text={trial} size="lg" />
        </Section>

        <div className="w-full rounded-2xl border px-3 py-3 theme-border" style={{ background: 'var(--game-control-bg)' }}>
          {config.fullGrid ? (
            <>
              <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.2em] theme-muted">
                Chọn số dịch 1-25
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {SHIFT_VALUES.map(value => {
                  const active = value === round.shift;
                  return (
                    <button
                      key={value}
                      onClick={() => changeShift(value)}
                      disabled={ended}
                      className={`rounded-lg border py-2 font-mono text-sm font-black transition-transform active:translate-y-[2px] disabled:opacity-40 ${
                        active ? 'border-transparent text-white' : 'theme-panel-soft theme-text theme-border'
                      }`}
                      style={active ? { background: '#4f46e5' } : undefined}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.2em] theme-muted">
                Chỉnh số dịch: {round.shift}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeShift(round.shift - 1)}
                  disabled={ended}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border theme-border theme-panel-soft theme-text transition-transform active:translate-y-[2px] disabled:opacity-40"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={1}
                  value={round.shift}
                  disabled={ended}
                  onChange={event => changeShift(Number(event.target.value))}
                  className="h-2 w-full flex-1 cursor-pointer appearance-none rounded-full"
                  style={{ background: 'var(--game-control-border)' }}
                />
                <button
                  onClick={() => changeShift(round.shift + 1)}
                  disabled={ended}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border theme-border theme-panel-soft theme-text transition-transform active:translate-y-[2px] disabled:opacity-40"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="w-full rounded-2xl border px-3 py-3 theme-border" style={{ background: 'var(--surface-soft)' }}>
          <label className="mb-1.5 block text-center text-[10px] font-black uppercase tracking-[0.2em] theme-muted" htmlFor="crypto-guess">
            Hoặc gõ câu gốc
          </label>
          <input
            id="crypto-guess"
            value={round.typed}
            disabled={ended}
            onChange={event => {
              const current = roundRef.current;
              commit({ ...current, typed: event.target.value });
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                check();
              }
            }}
            placeholder="Nhập đáp án của bạn"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full rounded-xl border px-3 py-2.5 text-center font-mono text-sm font-bold uppercase tracking-widest theme-text theme-border outline-none"
            style={{ background: 'var(--game-control-bg)' }}
          />
          {showWordMarks && typedWords.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {typedWords.map((word, index) => {
                const ok = words[index] === word;
                return (
                  <span
                    key={`${word}-${index}`}
                    className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                    style={
                      ok
                        ? { background: '#0d9488', borderColor: '#0d9488', color: '#fff' }
                        : { background: 'transparent', borderColor: '#e11d48', color: '#e11d48' }
                    }
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          <button
            onClick={check}
            disabled={ended}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-white transition-transform active:translate-y-[2px] disabled:opacity-40"
            style={{ background: '#4f46e5' }}
          >
            <Check className="h-4 w-4" />
            Kiểm tra
          </button>
          <button
            onClick={useHint}
            disabled={ended || hintsLeft <= 0}
            className="flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-black transition-transform active:translate-y-[2px] disabled:opacity-40"
            style={{ background: 'transparent', borderColor: '#d97706', color: '#d97706' }}
          >
            <Lightbulb className="h-4 w-4" />
            Gợi ý ({hintsLeft})
          </button>
        </div>

        {round.hints.length > 0 && (
          <div className="flex w-full flex-wrap justify-center gap-2">
            {round.hints.map(index => {
              const word = words[index] ?? '';
              const masked = word[0] + ' ' + Array.from({ length: Math.max(0, word.length - 1) }).map(() => '_').join(' ');
              return (
                <span
                  key={index}
                  className="rounded-lg border px-2 py-1 font-mono text-[11px] font-bold"
                  style={{ background: 'var(--game-status-bg)', borderColor: '#d97706', color: '#d97706' }}
                >
                  Từ {index + 1}: {masked}
                </span>
              );
            })}
          </div>
        )}

        {feedback && (
          <div
            className="w-full animate-in fade-in rounded-2xl border-2 px-3 py-2.5 text-center duration-200"
            style={feedback.ok ? { borderColor: '#0d9488' } : { borderColor: '#e11d48' }}
          >
            <div className="text-sm font-black" style={{ color: feedback.ok ? '#0d9488' : '#e11d48' }}>
              {feedback.title}
            </div>
            <div className="mt-0.5 text-xs theme-muted">{feedback.detail}</div>
          </div>
        )}

        {ended && (
          <div
            className="w-full animate-in zoom-in-95 rounded-2xl border-2 px-3 py-3 text-center duration-200"
            style={{ background: 'var(--game-status-bg)', borderColor: round.won ? '#0d9488' : '#e11d48' }}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.2em] theme-muted">Câu gốc</div>
            <div className="mt-1 break-words text-center font-mono text-base font-black uppercase leading-relaxed tracking-[0.2em] sm:text-lg theme-text">
              {round.phrase}
            </div>
            <div className="mt-2 text-xs font-bold theme-text">
              Số dịch đúng: {round.secretShift} · Gợi ý: {round.hints.length} · Kiểm tra: {round.checks} lần
            </div>
            {round.won && (
              <div className="mt-1 text-xs font-black" style={{ color: '#34d399' }}>
                {round.won ? 'Giải xong trong ' + formatClock(elapsed) + ' · Điểm ' + score.toLocaleString('vi-VN') : 'Hết giờ'}
              </div>
            )}
          </div>
        )}
      </div>
    </GameShell>
  );
};
