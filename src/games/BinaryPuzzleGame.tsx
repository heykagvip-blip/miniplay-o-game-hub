import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Lightbulb, CheckCircle2, Eraser } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_SIZES: Record<Difficulty, number> = { easy: 6, medium: 8, hard: 10 };
const DIFFICULTY_BASE_SCORE: Record<Difficulty, number> = { easy: 1000, medium: 2000, hard: 3500 };
const HOLES_TARGET: Record<Difficulty, number> = { easy: 16, medium: 30, hard: 46 };
const MAX_HINTS = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function isValidRowPattern(pattern: number, n: number): boolean {
  let count = 0;
  for (let i = 0; i < n; i++) count += (pattern >> i) & 1;
  if (count * 2 !== n) return false;
  for (let i = 0; i + 2 < n; i++) {
    const a = (pattern >> i) & 1;
    const b = (pattern >> (i + 1)) & 1;
    const c = (pattern >> (i + 2)) & 1;
    if (a === b && b === c) return false;
  }
  return true;
}

export function generateFullGrid(n: number): number[] {
  const patterns: number[] = [];
  for (let p = 0; p < (1 << n); p++) {
    if (isValidRowPattern(p, n)) patterns.push(p);
  }
  const grid = new Array<number>(n * n).fill(-1);
  const colCounts0 = new Array<number>(n).fill(0);
  const colCounts1 = new Array<number>(n).fill(0);
  const half = n / 2;

  const place = (row: number): boolean => {
    if (row === n) return true;
    const opts = shuffle(patterns);
    for (const p of opts) {
      let ok = true;
      for (let c = 0; c < n; c++) {
        const v = (p >> c) & 1;
        const same = v ? colCounts1[c] : colCounts0[c];
        const other = v ? colCounts0[c] : colCounts1[c];
        if (same + 1 > half) { ok = false; break; }
        if (other + (n - row - 1) < half) { ok = false; break; }
        if (row >= 2 && grid[(row - 1) * n + c] === v && grid[(row - 2) * n + c] === v) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let c = 0; c < n; c++) {
        const v = (p >> c) & 1;
        grid[row * n + c] = v;
        if (v) colCounts1[c]++;
        else colCounts0[c]++;
      }
      if (place(row + 1)) return true;
      for (let c = 0; c < n; c++) {
        if ((p >> c) & 1) colCounts1[c]--;
        else colCounts0[c]--;
      }
    }
    return false;
  };

  place(0);
  return grid;
}

export interface SolveInfo {
  solutions: number;
  aborted: boolean;
}

function propagate(masks: Uint8Array, n: number): boolean {
  const half = n / 2;
  let changed = true;
  while (changed) {
    changed = false;
    for (let line = 0; line < n * 2; line++) {
    const isRow = line < n;
    const base = isRow ? line * n : 0;
    const col = isRow ? 0 : line - n;
    const idx = (i: number) => (isRow ? base + i : i * n + col);
      for (let i = 0; i + 2 < n; i++) {
        const a = idx(i);
        const b = idx(i + 1);
        const c = idx(i + 2);
        const ma = masks[a];
        const mb = masks[b];
        const mc = masks[c];
        if (ma === 1 && mb === 1 && (mc & 1) !== 0) {
          const nm = mc & 2;
          if (nm !== mc) { masks[c] = nm; changed = true; }
        }
        if (ma === 2 && mb === 2 && (mc & 2) !== 0) {
          const nm = mc & 1;
          if (nm !== mc) { masks[c] = nm; changed = true; }
        }
        if (mb === 1 && mc === 1 && (ma & 1) !== 0) {
          const nm = ma & 2;
          if (nm !== ma) { masks[a] = nm; changed = true; }
        }
        if (mb === 2 && mc === 2 && (ma & 2) !== 0) {
          const nm = ma & 1;
          if (nm !== ma) { masks[a] = nm; changed = true; }
        }
        if (ma === 1 && mc === 1 && (mb & 1) !== 0) {
          const nm = mb & 2;
          if (nm !== mb) { masks[b] = nm; changed = true; }
        }
        if (ma === 2 && mc === 2 && (mb & 2) !== 0) {
          const nm = mb & 1;
          if (nm !== mb) { masks[b] = nm; changed = true; }
        }
      }
      let c0 = 0;
      let c1 = 0;
      let e = 0;
      for (let i = 0; i < n; i++) {
        const m = masks[idx(i)];
        if (m === 1) c0++;
        else if (m === 2) c1++;
        else if (m === 3) e++;
        else return false;
      }
      if (c0 > half || c1 > half) return false;
      if (c0 === half || c1 + e === half) {
        for (let i = 0; i < n; i++) {
          const p = idx(i);
          if (masks[p] === 3) { masks[p] = 2; changed = true; }
        }
      }
      if (c1 === half || c0 + e === half) {
        for (let i = 0; i < n; i++) {
          const p = idx(i);
          if (masks[p] === 3) { masks[p] = 1; changed = true; }
        }
      }
    }
  }
  return true;
}

export function countSolutions(
  grid: number[],
  n: number,
  cap = 2,
  maxNodes = 20000,
  deadline = Number.POSITIVE_INFINITY
): SolveInfo {
  const masks = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    masks[i] = grid[i] === -1 ? 3 : grid[i] === 0 ? 1 : 2;
  }
  if (!propagate(masks, n)) return { solutions: 0, aborted: false };
  let solutions = 0;
  let nodes = 0;
  let aborted = false;

  const dfs = (state: Uint8Array): boolean => {
    if (aborted) return true;
    nodes++;
    if (nodes > maxNodes || Date.now() > deadline) {
      aborted = true;
      return true;
    }
    let pick = -1;
    for (let i = 0; i < n * n; i++) {
      if (state[i] === 3) { pick = i; break; }
    }
    if (pick === -1) {
      solutions++;
      return solutions >= cap;
    }
    for (let v = 0; v < 2; v++) {
      const next = state.slice();
      next[pick] = 1 << v;
      if (propagate(next, n)) {
        if (dfs(next)) return true;
      }
    }
    return false;
  };

  dfs(masks);
  return { solutions, aborted };
}

export interface PuzzleResult {
  puzzle: number[];
  solution: number[];
  holes: number;
  timedOut: boolean;
}

export function generatePuzzle(n: number, holesTarget: number, deadline: number): PuzzleResult {
  const solution = generateFullGrid(n);
  const puzzle = solution.slice();
  const order = shuffle(Array.from({ length: n * n }, (_, i) => i));
  let holes = 0;
  let timedOut = false;
  for (const idx of order) {
    if (holes >= holesTarget) break;
    if (Date.now() > deadline) { timedOut = true; break; }
    if (puzzle[idx] === -1) continue;
    const saved = puzzle[idx];
    puzzle[idx] = -1;
    const res = countSolutions(puzzle, n, 2, 20000, deadline);
    if (res.aborted) {
      puzzle[idx] = saved;
      timedOut = true;
      break;
    }
    if (res.solutions === 1) holes++;
    else puzzle[idx] = saved;
  }
  return { puzzle, solution, holes, timedOut };
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function generatePuzzleAsync(
  n: number,
  holesTarget: number,
  deadline: number
): Promise<PuzzleResult> {
  const solution = generateFullGrid(n);
  await tick();
  const puzzle = solution.slice();
  const order = shuffle(Array.from({ length: n * n }, (_, i) => i));
  let holes = 0;
  let timedOut = false;
  for (let k = 0; k < order.length; k++) {
    if (holes >= holesTarget) break;
    if (Date.now() > deadline) { timedOut = true; break; }
    if (k % 4 === 0) await tick();
    const idx = order[k];
    if (puzzle[idx] === -1) continue;
    const saved = puzzle[idx];
    puzzle[idx] = -1;
    const res = countSolutions(puzzle, n, 2, 20000, deadline);
    if (res.aborted) {
      puzzle[idx] = saved;
      timedOut = true;
      break;
    }
    if (res.solutions === 1) holes++;
    else puzzle[idx] = saved;
  }
  return { puzzle, solution, holes, timedOut };
}

export const BinaryPuzzleGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('binary-puzzle')!;
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [size, setSize] = useState(6);
  const [givens, setGivens] = useState<boolean[]>([]);
  const [board, setBoard] = useState<number[]>([]);
  const [solution, setSolution] = useState<number[]>([]);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [checkMode, setCheckMode] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [notice, setNotice] = useState('');
  const [isVictory, setIsVictory] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const runIdRef = useRef(0);

  const startGame = useCallback(async (diff: Difficulty) => {
    const runId = ++runIdRef.current;
    setDifficulty(diff);
    setGenerating(true);
    setNotice('');
    setIsVictory(false);
    setIsGameOver(false);
    setScore(0);
    setHintsLeft(MAX_HINTS);
    setHintsUsed(0);
    setCheckMode(false);
    setCursor([0, 0]);
    const deadline = Date.now() + 9000;
    let n = DIFFICULTY_SIZES[diff];
    let result = await generatePuzzleAsync(n, HOLES_TARGET[diff], deadline);
    if (runId !== runIdRef.current) return;
    if (result.holes < Math.floor((n * n) / 5) && diff !== 'easy') {
      const fallback: Difficulty = diff === 'hard' ? 'medium' : 'easy';
      setDifficulty(fallback);
      setNotice(
        diff === 'hard'
          ? 'Lưới 10x10 tạo quá chậm, đã chuyển sang lưới 8x8'
          : 'Lưới 8x8 tạo quá chậm, đã chuyển sang lưới 6x6'
      );
      n = DIFFICULTY_SIZES[fallback];
      result = await generatePuzzleAsync(n, HOLES_TARGET[fallback], Date.now() + 6000);
      if (runId !== runIdRef.current) return;
    }
    const g = new Array<boolean>(n * n).fill(false);
    for (let i = 0; i < n * n; i++) {
      if (result.puzzle[i] !== -1) g[i] = true;
    }
    setSize(n);
    setGivens(g);
    setBoard(result.puzzle.slice());
    setSolution(result.solution.slice());
    setGenerating(false);
  }, []);

  useEffect(() => {
    startGame('easy');
  }, [startGame]);

  const finishGame = () => {
    const base = DIFFICULTY_BASE_SCORE[difficulty];
    let finalScore = Math.max(50, base - hintsUsed * 120);
    if (hintsUsed === 0) finalScore += Math.round(base * 0.25);
    setScore(finalScore);
    setIsVictory(true);
    setIsGameOver(true);
    playClearSound();
    triggerHaptic(40);
  };

  const applyCell = (r: number, c: number, value: number) => {
    if (generating || isGameOver || isVictory) return;
    const i = r * size + c;
    if (givens[i]) return;
    const next = board.slice();
    next[i] = value;
    setBoard(next);
    setCursor([r, c]);
    playMoveSound();
    triggerHaptic(15);
    if (value !== -1 && next.every((v, idx) => v !== -1 && v === solution[idx])) {
      finishGame();
    }
  };

  const cycleCell = (r: number, c: number) => {
    if (generating || isGameOver || isVictory) return;
    const i = r * size + c;
    if (givens[i]) return;
    const cur = board[i];
    applyCell(r, c, cur === -1 ? 0 : cur === 0 ? 1 : -1);
  };

  const handleHint = () => {
    if (generating || isGameOver || isVictory || hintsLeft <= 0) return;
    let target = -1;
    for (let i = 0; i < size * size; i++) {
      if (!givens[i] && board[i] !== -1 && board[i] !== solution[i]) { target = i; break; }
    }
    if (target === -1) {
      const empties: number[] = [];
      for (let i = 0; i < size * size; i++) {
        if (!givens[i] && board[i] === -1) empties.push(i);
      }
      if (empties.length === 0) return;
      target = empties[Math.floor(Math.random() * empties.length)];
    }
    const next = board.slice();
    next[target] = solution[target];
    const nextGivens = givens.slice();
    nextGivens[target] = true;
    setBoard(next);
    setGivens(nextGivens);
    setHintsLeft(h => h - 1);
    setHintsUsed(u => u + 1);
    setCursor([Math.floor(target / size), target % size]);
    playClearSound();
    triggerHaptic(25);
    if (next.every((v, idx) => v !== -1 && v === solution[idx])) finishGame();
  };

  const handleErase = () => {
    if (generating || isGameOver || isVictory) return;
    const i = cursor[0] * size + cursor[1];
    if (givens[i] || board[i] === -1) return;
    const next = board.slice();
    next[i] = -1;
    setBoard(next);
    playMoveSound();
    triggerHaptic(10);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (generating || isGameOver || isVictory) return;
      const r = cursor[0];
      const c = cursor[1];
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor([Math.max(0, r - 1), c]); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor([Math.min(size - 1, r + 1), c]); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setCursor([r, Math.max(0, c - 1)]); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setCursor([r, Math.min(size - 1, c + 1)]); }
      else if (e.key === '0') applyCell(r, c, 0);
      else if (e.key === '1') applyCell(r, c, 1);
      else if (e.key === ' ') { e.preventDefault(); cycleCell(r, c); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); handleErase(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const total = size * size;
  const filled = board.reduce((acc, v) => acc + (v !== -1 ? 1 : 0), 0);
  const mistakes = checkMode
    ? board.reduce((acc, v, i) => acc + (v !== -1 && !givens[i] && v !== solution[i] ? 1 : 0), 0)
    : 0;
  const fontSizeClass = size <= 6 ? 'text-lg' : size <= 8 ? 'text-base' : 'text-sm';

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isVictory={isVictory}
      isPaused={false}
      onRestart={() => startGame(difficulty)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2">
          <div
            className="px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5"
            style={{ borderColor: 'var(--border-color)', background: 'var(--surface-strong)' }}
          >
            <span className="theme-muted">Đã điền</span>
            <span className="font-bold theme-text">
              {filled}/{total}
            </span>
          </div>
          {checkMode && mistakes > 0 && (
            <div
              className="px-2 py-1 rounded-xl border text-xs font-bold"
              style={{ borderColor: 'var(--border-color)', background: 'var(--surface-strong)', color: '#fb7185' }}
            >
              Lỗi: {mistakes}
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center w-full max-w-md mx-auto gap-3 px-1">
        <div
          className="flex items-center gap-1.5 p-1 rounded-2xl"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-color)' }}
        >
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => startGame(d)}
              disabled={generating}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 active:translate-y-[2px]"
              style={
                difficulty === d
                  ? { background: '#4338ca', color: '#fff' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {d === 'easy' ? 'Dễ 6x6' : d === 'medium' ? 'Trung bình 8x8' : 'Khó 10x10'}
            </button>
          ))}
        </div>

        {notice && (
          <div className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
            {notice}
          </div>
        )}

        <div className="w-full">
          <div className="flex justify-between text-xs mb-1">
            <span className="theme-muted">Tiến trình</span>
            <span className="theme-muted">{Math.round((filled / total) * 100)}%</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-color)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${(filled / total) * 100}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>

        <div
          className="grid gap-px rounded-2xl overflow-hidden w-full aspect-square game-touch-zone"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            background: 'var(--border-color)',
            border: '2px solid var(--border-color)',
          }}
        >
          {board.map((val, i) => {
            const r = Math.floor(i / size);
            const c = i % size;
            const isGiven = givens[i];
            const isCursor = cursor[0] === r && cursor[1] === c;
            const inLine = cursor[0] === r || cursor[1] === c;
            const isWrong = checkMode && val !== -1 && !isGiven && val !== solution[i];
            const isRight = checkMode && val !== -1 && !isGiven && val === solution[i];
            return (
              <button
                key={i}
                onClick={() => {
                  setCursor([r, c]);
                  cycleCell(r, c);
                }}
                className={`flex items-center justify-center font-bold transition-colors select-none game-touch-zone ${fontSizeClass}`}
                style={{
                  background: isWrong
                    ? 'rgba(225,29,72,0.28)'
                    : isRight
                      ? 'rgba(16,185,129,0.20)'
                      : isGiven
                        ? 'var(--surface-strong)'
                        : inLine
                          ? 'var(--surface-soft)'
                          : 'var(--game-surface-bg)',
                  color: isGiven
                    ? 'var(--text-primary)'
                    : isWrong
                      ? '#fb7185'
                      : isRight
                        ? '#34d399'
                        : 'var(--accent)',
                  outline: isCursor ? '2px solid var(--accent)' : 'none',
                  outlineOffset: -2,
                }}
              >
                {val === -1 ? '' : val}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 w-full">
          <button
            onClick={handleHint}
            disabled={hintsLeft <= 0 || generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:translate-y-[2px] disabled:opacity-40"
            style={{
              background: 'rgba(245,158,11,0.15)',
              borderColor: 'rgba(245,158,11,0.4)',
              color: '#fbbf24',
            }}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Gợi ý ({hintsLeft})</span>
          </button>
          <button
            onClick={() => {
              setCheckMode(m => !m);
              playMoveSound();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:translate-y-[2px]"
            style={
              checkMode
                ? { background: '#4338ca', borderColor: '#4338ca', color: '#fff' }
                : {
                    background: 'var(--surface-strong)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }
            }
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Kiểm tra</span>
          </button>
          <button
            onClick={handleErase}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:translate-y-[2px] disabled:opacity-40"
            style={{
              background: 'var(--surface-strong)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Xóa ô</span>
          </button>
        </div>

        <p className="text-[11px] text-center theme-muted leading-relaxed">
          Quy tắc: mỗi hàng và cột phải có số lượng 0 và 1 bằng nhau, không quá 2 ô giống nhau
          liên tiếp. Nhấn ô để đổi trống → 0 → 1. Phím mũi tên di chuyển, 0/1 điền số, Space đổi
          ô.
        </p>
      </div>

      {generating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(2,6,23,0.88)' }}
        >
          <div
            className="rounded-3xl p-8 flex flex-col items-center gap-4"
            style={{
              background: 'var(--surface-strong)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: '#818cf8', borderTopColor: 'transparent' }}
            />
            <div className="text-sm font-bold theme-text">Đang tạo câu đố...</div>
            <div className="text-xs theme-muted">
              Đang kiểm tra nghiệm duy nhất cho lưới {size}x{size}
            </div>
          </div>
        </div>
      )}
    </GameShell>
  );
};
