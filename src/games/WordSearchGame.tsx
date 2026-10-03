import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';

type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  label: string;
  size: number;
  wordCount: number;
  minWords: number;
  minLen: number;
  maxLen: number;
  base: number;
  penalty: number;
  timeLimit: number;
  bonusPerSecond: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { label: 'Dễ', size: 8, wordCount: 5, minWords: 4, minLen: 4, maxLen: 5, base: 120, penalty: 20, timeLimit: 120, bonusPerSecond: 2 },
  medium: { label: 'Trung bình', size: 10, wordCount: 6, minWords: 5, minLen: 4, maxLen: 7, base: 180, penalty: 30, timeLimit: 180, bonusPerSecond: 3 },
  hard: { label: 'Khó', size: 12, wordCount: 7, minWords: 6, minLen: 5, maxLen: 10, base: 260, penalty: 40, timeLimit: 240, bonusPerSecond: 4 },
};

export const WORD_LIST: string[] = [
  'banh', 'bien', 'bong', 'buon', 'cach', 'canh', 'chay', 'choi', 'chuc', 'chua', 'cuoi', 'cuoc',
  'dang', 'danh', 'dich', 'diem', 'dien', 'dieu', 'dinh', 'doan', 'dung', 'ghep', 'giap', 'giay',
  'gioi', 'hang', 'hanh', 'hieu', 'hinh', 'kenh', 'khuc', 'kiem', 'kinh', 'khoa', 'lang', 'lanh',
  'lenh', 'lien', 'linh', 'loai', 'long', 'muoc', 'muon', 'nghe', 'nhan', 'nhac', 'nhom', 'phai',
  'phim', 'phuc', 'quan', 'quay', 'quoc', 'rang', 'rong', 'ruou', 'sach', 'sang', 'sieu', 'song',
  'thoi', 'tien', 'tiet', 'toan', 'tong', 'tram', 'trau', 'troi', 'tuan', 'vang', 'viec', 'vinh',
  'vuon', 'xanh', 'xinh', 'chanh', 'cheo', 'chieu', 'chinh', 'duong', 'giang', 'hanoi', 'halong',
  'huong', 'huyen', 'khach', 'khong', 'luong', 'muong', 'nguoi', 'nguon', 'phong', 'phuoc', 'thang',
  'thanh', 'thien', 'thiet', 'thuoc', 'thuy', 'trang', 'tranh', 'trong', 'truoc', 'chuyen', 'hoaqua',
  'nghien', 'nuong', 'phuong', 'saigon', 'thuong', 'truyen', 'vietnam', 'khonggian',
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export interface WordPlacement {
  word: string;
  cells: number[];
}

export interface WordPuzzle {
  size: number;
  grid: string[];
  placements: WordPlacement[];
}

export interface GridSelection {
  cells: number[];
  text: string;
  reversed: string;
}

export type SelectionKind = 'ignored' | 'miss' | 'duplicate' | 'match';

export interface SelectionResult {
  kind: SelectionKind;
  word: string | null;
}

const shuffle = <T,>(items: T[], rng: () => number): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
};

const fits = (
  cells: (string | null)[],
  size: number,
  word: string,
  row: number,
  col: number,
  dr: number,
  dc: number,
): boolean => {
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    const current = cells[r * size + c];
    if (current !== null && current !== word[i]) return false;
  }
  return true;
};

const placeWord = (
  cells: (string | null)[],
  size: number,
  word: string,
  rng: () => number,
): number[] | null => {
  const options: Array<[number, number, number, number]> = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dr, dc] of DIRECTIONS) {
        if (fits(cells, size, word, row, col, dr, dc)) options.push([row, col, dr, dc]);
      }
    }
  }
  if (options.length === 0) return null;
  const [row, col, dr, dc] = options[Math.floor(rng() * options.length) % options.length];
  const out: number[] = [];
  for (let i = 0; i < word.length; i++) {
    const index = (row + dr * i) * size + (col + dc * i);
    out.push(index);
    cells[index] = word[i];
  }
  return out;
};

const attemptPuzzle = (cfg: DifficultyConfig, rng: () => number): WordPuzzle => {
  const size = cfg.size;
  const cells: (string | null)[] = new Array(size * size).fill(null);
  const placements: WordPlacement[] = [];
  const usable = WORD_LIST.filter(word => word.length >= 4 && word.length <= size);
  const preferred = shuffle(
    usable.filter(word => word.length >= cfg.minLen && word.length <= Math.min(cfg.maxLen, size)),
    rng,
  );
  const extras = shuffle(usable, rng);
  const used = new Set<string>();
  for (const word of preferred.concat(extras)) {
    if (placements.length >= cfg.wordCount) break;
    if (used.has(word)) continue;
    used.add(word);
    const placed = placeWord(cells, size, word, rng);
    if (placed) placements.push({ word, cells: placed });
  }
  const grid = cells.map(cell => cell ?? ALPHABET[Math.floor(rng() * ALPHABET.length) % ALPHABET.length]);
  return { size, grid, placements };
};

export const buildPuzzle = (difficulty: Difficulty = 'easy', rng: () => number = Math.random): WordPuzzle => {
  const cfg = DIFFICULTIES[difficulty];
  let best = attemptPuzzle(cfg, rng);
  for (let attempt = 0; attempt < 60 && best.placements.length < cfg.minWords; attempt++) {
    best = attemptPuzzle(cfg, rng);
  }
  return best;
};

export const buildSelection = (size: number, grid: string[], anchor: number, hover: number): GridSelection | null => {
  const total = size * size;
  if (anchor < 0 || hover < 0 || anchor >= total || hover >= total) return null;
  const anchorRow = Math.floor(anchor / size);
  const anchorCol = anchor % size;
  const hoverRow = Math.floor(hover / size);
  const hoverCol = hover % size;
  if (anchor === hover) {
    return { cells: [anchor], text: grid[anchor], reversed: grid[anchor] };
  }
  const rowDelta = hoverRow - anchorRow;
  const colDelta = hoverCol - anchorCol;
  const rowSpan = Math.abs(rowDelta);
  const colSpan = Math.abs(colDelta);
  const steps = Math.max(rowSpan, colSpan);
  const stepRow = rowSpan === 0 ? 0 : rowDelta > 0 ? 1 : -1;
  const stepCol = colSpan === 0 ? 0 : colDelta > 0 ? 1 : -1;
  const cells: number[] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push((anchorRow + stepRow * i) * size + (anchorCol + stepCol * i));
  }
  const text = cells.map(cell => grid[cell]).join('');
  return { cells, text, reversed: text.split('').reverse().join('') };
};

export const classifySelection = (
  selection: GridSelection | null,
  targets: string[],
  found: string[],
): SelectionResult => {
  if (!selection) return { kind: 'ignored', word: null };
  if (selection.text.length < 2) return { kind: 'ignored', word: null };
  let hit: string | null = null;
  if (targets.indexOf(selection.text) >= 0) hit = selection.text;
  else if (targets.indexOf(selection.reversed) >= 0) hit = selection.reversed;
  if (!hit) return { kind: 'miss', word: null };
  return found.indexOf(hit) >= 0 ? { kind: 'duplicate', word: hit } : { kind: 'match', word: hit };
};

export const calcScore = (
  wordsFound: number,
  wrongAttempts: number,
  hintsUsed: number,
  elapsed: number,
  cfg: DifficultyConfig,
): number => {
  const timeBonus = Math.max(0, Math.round((cfg.timeLimit - elapsed) * cfg.bonusPerSecond));
  const raw = wordsFound * cfg.base - wrongAttempts * cfg.penalty - hintsUsed * 50 + timeBonus;
  return Math.max(10, raw);
};

interface CellColor {
  fill: string;
  ink: string;
}

const WORD_COLORS: CellColor[] = [
  { fill: '#3b82f6', ink: '#eff6ff' },
  { fill: '#22c55e', ink: '#04220f' },
  { fill: '#a855f7', ink: '#faf5ff' },
  { fill: '#f97316', ink: '#3b1102' },
  { fill: '#14b8a6', ink: '#032b27' },
  { fill: '#ec4899', ink: '#fff1f6' },
  { fill: '#84cc16', ink: '#1d2b05' },
  { fill: '#06b6d4', ink: '#04222a' },
];

const SELECTION_FILL = '#facc15';
const MISS_FILL = '#dc2626';
const MISS_INK = '#fff1f2';
const REACTIONS = ['Chính xác!', 'Tuyệt vời!', 'Mắt như cú!', 'Nhanh quá!', 'Đỉnh thật!', 'Bậc thầy!'];
const SHAKE_STEPS = [0, -7, 6, -5, 4, -2, 0];

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const WordSearchGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('word-search')!;
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [puzzle, setPuzzle] = useState<WordPuzzle>(() => buildPuzzle('easy'));
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [hints, setHints] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [missCells, setMissCells] = useState<number[]>([]);
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [reaction, setReaction] = useState<{ word: string; text: string; id: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [isLight, setIsLight] = useState(false);

  const cfg = DIFFICULTIES[difficulty];
  const gridRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef<number>(Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const selectionRef = useRef<GridSelection | null>(null);

  const targets = useMemo(() => puzzle.placements.map(item => item.word), [puzzle]);
  const score = useMemo(
    () => calcScore(found.length, wrong, hints, elapsed, cfg),
    [found.length, wrong, hints, elapsed, cfg],
  );

  useEffect(() => {
    if (ended) return;
    const id = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [ended, puzzle]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(timer => clearTimeout(timer));
      pending.length = 0;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsLight(root.classList.contains('light'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      const index = timers.current.indexOf(timer);
      if (index >= 0) timers.current.splice(index, 1);
      fn();
    }, ms);
    timers.current.push(timer);
  };

  const runShake = () => {
    let step = 0;
    const tick = () => {
      setShake(SHAKE_STEPS[Math.min(step, SHAKE_STEPS.length - 1)]);
      step += 1;
      if (step < SHAKE_STEPS.length) later(tick, 55);
    };
    tick();
  };

  const cellFromPoint = (clientX: number, clientY: number): number | null => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element || !gridRef.current) return null;
    const cell = (element as HTMLElement).closest('[data-cell]');
    if (!cell || !gridRef.current.contains(cell)) return null;
    const raw = cell.getAttribute('data-cell');
    return raw === null ? null : Number(raw);
  };

  const commit = (picked: GridSelection | null) => {
    const result = classifySelection(picked, targets, found);
    if (result.kind === 'ignored' || result.kind === 'duplicate') {
      if (result.kind === 'duplicate' && result.word) {
        setReaction({ word: result.word, text: 'Từ này bạn đã tìm rồi!', id: Date.now() });
      }
      return;
    }
    if (result.kind === 'miss') {
      setWrong(count => count + 1);
      setMissCells(picked ? picked.cells : []);
      runShake();
      playMoveSound();
      later(() => setMissCells([]), 420);
      return;
    }
    const word = result.word as string;
    const nextFound = found.concat(word);
    setFound(nextFound);
    setReaction({
      word,
      text: REACTIONS[Math.min(REACTIONS.length - 1, nextFound.length - 1)],
      id: Date.now(),
    });
    playScoreSound();
    triggerHaptic(20);
    if (nextFound.length >= puzzle.placements.length) {
      setEnded(true);
      setWon(true);
      playClearSound();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (ended) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerIdRef.current = event.pointerId;
    } catch {
      pointerIdRef.current = null;
    }
    anchorRef.current = cell;
    const picked = buildSelection(puzzle.size, puzzle.grid, cell, cell);
    selectionRef.current = picked;
    setSelection(picked);
    playMoveSound();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (anchorRef.current === null) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (cell === null) return;
    const picked = buildSelection(puzzle.size, puzzle.grid, anchorRef.current, cell);
    if (!picked) return;
    const previous = selectionRef.current;
    if (previous && previous.cells.length === picked.cells.length && previous.cells[previous.cells.length - 1] === picked.cells[picked.cells.length - 1]) {
      return;
    }
    selectionRef.current = picked;
    setSelection(picked);
  };

  const releaseDrag = (submit: boolean) => {
    if (anchorRef.current === null) return;
    anchorRef.current = null;
    const picked = selectionRef.current;
    selectionRef.current = null;
    setSelection(null);
    const pointerId = pointerIdRef.current;
    pointerIdRef.current = null;
    if (pointerId !== null && gridRef.current) {
      try {
        if (gridRef.current.hasPointerCapture(pointerId)) gridRef.current.releasePointerCapture(pointerId);
      } catch {
        pointerIdRef.current = null;
      }
    }
    if (submit) commit(picked);
  };

  const restart = () => {
    timers.current.forEach(timer => clearTimeout(timer));
    timers.current = [];
    setPuzzle(buildPuzzle(difficulty));
    setFound([]);
    setWrong(0);
    setHints(0);
    setElapsed(0);
    setEnded(false);
    setWon(false);
    setSelection(null);
    selectionRef.current = null;
    anchorRef.current = null;
    pointerIdRef.current = null;
    setMissCells([]);
    setHintCells([]);
    setReaction(null);
    setShake(0);
    startRef.current = Date.now();
  };

  const switchDifficulty = (next: Difficulty) => {
    if (next === difficulty) return;
    timers.current.forEach(timer => clearTimeout(timer));
    timers.current = [];
    setDifficulty(next);
    setPuzzle(buildPuzzle(next));
    setFound([]);
    setWrong(0);
    setHints(0);
    setElapsed(0);
    setEnded(false);
    setWon(false);
    setSelection(null);
    selectionRef.current = null;
    anchorRef.current = null;
    setMissCells([]);
    setHintCells([]);
    setReaction(null);
    setShake(0);
    startRef.current = Date.now();
    playMoveSound();
  };

  const useHint = () => {
    if (ended) return;
    const pending = puzzle.placements.filter(item => found.indexOf(item.word) < 0);
    if (pending.length === 0) return;
    const pick = pending[Math.floor(Math.random() * pending.length) % pending.length];
    setHints(count => count + 1);
    setHintCells(pick.cells);
    setReaction({ word: pick.word, text: 'Gợi ý: từ này nằm ở đây!', id: Date.now() });
    playMoveSound();
    later(() => setHintCells([]), 1600);
  };

  const foundCells = useMemo(() => {
    const map = new Map<number, CellColor>();
    found.forEach((word, index) => {
      const placement = puzzle.placements.find(item => item.word === word);
      if (!placement) return;
      const color = WORD_COLORS[index % WORD_COLORS.length];
      placement.cells.forEach(cell => {
        if (!map.has(cell)) map.set(cell, color);
      });
    });
    return map;
  }, [found, puzzle]);

  const selectedSet = useMemo(() => new Set(selection ? selection.cells : []), [selection]);
  const missSet = useMemo(() => new Set(missCells), [missCells]);
  const hintSet = useMemo(() => new Set(hintCells), [hintCells]);
  const remaining = puzzle.placements.length - found.length;
  const pickedText = selection ? selection.text : '';
  const accentInk = isLight ? '#a16207' : '#facc15';
  const hintOutline = isLight ? '#b45309' : '#facc15';
  const selectionInk = isLight ? '#422006' : '#221802';

  const cellTextClass = puzzle.size <= 8 ? 'text-sm' : puzzle.size <= 10 ? 'text-[11px]' : 'text-[9px]';

  const statusText = ended
    ? `Hoàn thành ${puzzle.placements.length} từ trong ${formatTime(elapsed)}.`
    : reaction
    ? `${reaction.word}: ${reaction.text}`
    : remaining === 0
    ? 'Đã tìm hết! Chờ chút nhé...'
    : 'Kéo trên lưới để chọn từ — ngang, dọc hoặc chéo.';

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>Còn lại {remaining} từ</span>
          <span>|</span>
          <span>Sai {wrong}</span>
          <span>|</span>
          <span>{formatTime(elapsed)}</span>
        </div>
      }
    >
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map(key => {
            const active = key === difficulty;
            return (
              <button
                key={key}
                onClick={() => switchDifficulty(key)}
                className="rounded-xl border px-3 py-1.5 text-xs font-bold transition game-btn-press"
                style={{
                  background: active ? 'var(--accent)' : 'var(--game-control-bg)',
                  borderColor: active ? 'var(--accent)' : 'var(--game-control-border)',
                  color: active ? '#12101a' : 'var(--text-muted)',
                }}
              >
                {DIFFICULTIES[key].label}
              </button>
            );
          })}
          <button
            onClick={useHint}
            disabled={ended || remaining === 0}
            className="rounded-xl border px-3 py-1.5 text-xs font-bold transition game-btn-press"
            style={{
              background: 'var(--game-control-bg)',
              borderColor: 'var(--game-control-border)',
              color: 'var(--text-muted)',
            }}
          >
            Gợi ý (−50)
          </button>
        </div>

        <div
          className="flex w-full max-w-3xl items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-center text-xs font-bold"
          style={{
            background: ended ? 'var(--game-status-bg)' : 'var(--game-surface-bg)',
            borderColor: 'var(--border-color)',
            color: reaction ? accentInk : 'var(--text-muted)',
          }}
        >
          {statusText}
        </div>

        <div className="grid w-full max-w-4xl gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
          <div className="min-w-0">
            <div
              className="mx-auto w-full max-w-[440px] select-none rounded-2xl p-1.5"
              style={{
                background: 'var(--border-color)',
                transform: `translateX(${shake}px)`,
                transition: 'transform 55ms linear',
                touchAction: 'none',
              }}
            >
              <div
                ref={gridRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => releaseDrag(true)}
                onPointerCancel={() => releaseDrag(false)}
                onLostPointerCapture={() => releaseDrag(false)}
                className="grid gap-[2px] rounded-xl p-1"
                style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`, background: 'var(--game-surface-bg)' }}
              >
                {puzzle.grid.map((letter, index) => {
                  const foundColor = foundCells.get(index);
                  const isSelected = selectedSet.has(index);
                  const isMiss = missSet.has(index);
                  const isHint = hintSet.has(index);
                  let fill = 'var(--game-control-bg)';
                  let ink = 'var(--text-primary)';
                  if (isMiss) {
                    fill = MISS_FILL;
                    ink = MISS_INK;
                  } else if (isSelected) {
                    fill = SELECTION_FILL;
                    ink = selectionInk;
                  } else if (foundColor) {
                    fill = foundColor.fill;
                    ink = foundColor.ink;
                  }
                  return (
                    <div
                      key={index}
                      data-cell={index}
                      className={`grid aspect-square min-w-0 place-items-center rounded-[3px] font-black uppercase transition-colors duration-150 ${cellTextClass}`}
                      style={{
                        background: fill,
                        color: ink,
                        outline: isHint ? `2px solid ${hintOutline}` : 'none',
                        outlineOffset: '-2px',
                      }}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex h-6 items-center justify-center">
              <span
                className="text-sm font-black uppercase tracking-[0.3em]"
                style={{ color: pickedText.length >= 2 ? accentInk : 'var(--text-muted)' }}
              >
                {pickedText}
              </span>
            </div>

            <p className="mt-1 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Lưới {puzzle.size}×{puzzle.size} · {DIFFICULTIES[difficulty].label} · sai bị trừ{' '}
              {cfg.penalty} điểm mỗi lần
            </p>
          </div>

          <aside className="min-w-0">
            <div
              className="rounded-2xl border p-3"
              style={{ background: 'var(--game-surface-bg)', borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                  Từ cần tìm
                </h3>
                <span className="text-xs font-black" style={{ color: accentInk }}>
                  còn lại {remaining} từ
                </span>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-1.5">
                {puzzle.placements.map(item => {
                  const done = found.indexOf(item.word) >= 0;
                  const color = done ? WORD_COLORS[found.indexOf(item.word) % WORD_COLORS.length] : null;
                  const highlighted = reaction ? reaction.word === item.word : false;
                  return (
                    <li
                      key={item.word}
                      className="truncate rounded-lg border px-2 py-1 text-[11px] font-bold uppercase transition-colors duration-150"
                      style={{
                        background: color ? color.fill : 'var(--game-control-bg)',
                        borderColor: color ? color.fill : 'var(--game-control-border)',
                        color: color ? color.ink : 'var(--text-muted)',
                        textDecorationLine: done ? 'line-through' : 'none',
                        outline: highlighted ? `2px solid ${hintOutline}` : 'none',
                        outlineOffset: '-2px',
                      }}
                      title={done ? `Đã tìm: ${item.word}` : item.word}
                    >
                      {done ? '✓ ' : ''}
                      {item.word}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {found.length}/{puzzle.placements.length} từ đã tìm · {hints} gợi ý
              </p>
            </div>
          </aside>
        </div>
      </div>
    </GameShell>
  );
};
