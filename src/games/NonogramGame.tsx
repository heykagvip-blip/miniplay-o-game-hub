import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Lightbulb, X, AlertTriangle, Clock } from 'lucide-react';

type CellState = 0 | 1 | 2;

interface Difficulty {
  id: string;
  label: string;
  size: number;
  mirrorV: boolean;
  base: number;
  target: number;
  hints: number;
}

interface Puzzle {
  size: number;
  colors: number[][];
  rowClues: number[][];
  colClues: number[][];
  total: number;
  palette: string[];
}

const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Dễ', size: 10, mirrorV: true, base: 300, target: 150, hints: 4 },
  { id: 'medium', label: 'Trung bình', size: 15, mirrorV: true, base: 650, target: 300, hints: 3 },
  { id: 'hard', label: 'Khó', size: 20, mirrorV: false, base: 1100, target: 480, hints: 3 },
];

const PALETTES: string[][] = [
  ['#ef4444', '#f59e0b', '#22c55e'],
  ['#3b82f6', '#a855f7', '#f472b6'],
  ['#f59e0b', '#22c55e', '#38bdf8'],
  ['#ef4444', '#8b5cf6', '#14b8a6'],
];

const DANGER_COLOR = '#ef4444';
const WRONG_COLOR = '#f43f5e';
const CROSS_COLOR = 'var(--text-muted)';
const EMPTY_COLOR = 'var(--surface-strong)';

function cluesFor(line: boolean[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i]) {
      run++;
    } else if (run > 0) {
      out.push(run);
      run = 0;
    }
  }
  if (run > 0) out.push(run);
  return out.length ? out : [0];
}

function expandQuad(
  quad: number[][],
  size: number,
  mirrorV: boolean,
): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < size; r++) {
    const srcRow = mirrorV ? Math.min(r, size - 1 - r) : r;
    const row: number[] = new Array(size).fill(-1);
    for (let c = 0; c < size; c++) {
      const srcCol = Math.min(c, size - 1 - c);
      row[c] = quad[srcRow][srcCol];
    }
    out.push(row);
  }
  return out;
}

function buildPuzzle(diff: Difficulty): Puzzle {
  const n = diff.size;
  const qRows = diff.mirrorV ? Math.ceil(n / 2) : n;
  const qCols = Math.ceil(n / 2);
  let best: number[][] | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const blobCount = 2 + Math.floor(Math.random() * 2);
    const blobs: { cx: number; cy: number; rx: number; ry: number }[] = [];
    for (let i = 0; i < blobCount; i++) {
      blobs.push({
        cx: Math.random() * qCols,
        cy: Math.random() * qRows,
        rx: 1.2 + Math.random() * qCols * 0.62,
        ry: 1.2 + Math.random() * qRows * 0.62,
      });
    }

    const quad: number[][] = [];
    for (let y = 0; y < qRows; y++) {
      const row: number[] = new Array(qCols).fill(-1);
      for (let x = 0; x < qCols; x++) {
        let pick = -1;
        let bestDist = Infinity;
        for (let b = 0; b < blobs.length; b++) {
          const blob = blobs[b];
          const dx = (x - blob.cx) / blob.rx;
          const dy = (y - blob.cy) / blob.ry;
          const dist = dx * dx + dy * dy;
          if (dist <= 1 && dist < bestDist) {
            bestDist = dist;
            pick = b;
          }
        }
        row[x] = pick;
      }
      quad.push(row);
    }

    const colors = expandQuad(quad, n, diff.mirrorV);
    let filled = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (colors[r][c] >= 0) filled++;
    const ratio = filled / (n * n);
    if (ratio >= 0.3 && ratio <= 0.75 && filled >= n * 2) {
      best = colors;
      break;
    }
  }

  const colors = best;
  if (!colors) {
    const fallback: number[][] = [];
    for (let r = 0; r < n; r++) {
      const row: number[] = new Array(n).fill(-1);
      for (let c = 0; c < n; c++) {
        const dx = (c - (n - 1) / 2) / (n / 2.4);
        const dy = (r - (n - 1) / 2) / (n / 2.4);
        if (dx * dx + dy * dy <= 1) row[c] = (r + c) % 2;
      }
      fallback.push(row);
    }
    return finalize(n, fallback);
  }
  return finalize(n, colors);
}

function finalize(size: number, colors: number[][]): Puzzle {
  const order: number[] = [];
  let total = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = colors[r][c];
      if (v < 0) continue;
      total++;
      if (order.indexOf(v) === -1) order.push(v);
    }
  }
  const base = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const palette = order.map(idx => base[idx % base.length]);
  const remap = new Map<number, number>();
  order.forEach((idx, i) => remap.set(idx, i));
  const norm = colors.map(row => row.map(v => (v >= 0 ? remap.get(v)! : -1)));

  const rowClues: number[][] = [];
  const colClues: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(norm[r][c] >= 0);
    rowClues.push(cluesFor(row));
  }
  for (let c = 0; c < size; c++) {
    const col: boolean[] = [];
    for (let r = 0; r < size; r++) col.push(norm[r][c] >= 0);
    colClues.push(cluesFor(col));
  }
  return { size, colors: norm, rowClues, colClues, total, palette };
}

function lineSolvable(cells: CellState[], clues: number[]): boolean {
  const n = cells.length;
  const k = clues.length;
  const dead = new Set<string>();
  const solve = (p: number, j: number, runLeft: number): boolean => {
    if (p >= n) return j >= k && runLeft === 0;
    const key = `${p}:${j}:${runLeft}`;
    if (dead.has(key)) return false;
    const cell = cells[p];
    if (runLeft > 0) {
      if (cell === 2) {
        dead.add(key);
        return false;
      }
      return solve(p + 1, j, runLeft - 1);
    }
    if (cell === 2) return solve(p + 1, j, 0);
    if (j < k) {
      const len = clues[j];
      if (p + len <= n) {
        let fits = true;
        for (let t = p; t < p + len; t++) {
          if (cells[t] === 2) {
            fits = false;
            break;
          }
        }
        if (fits) {
          if (p + len === n) {
            if (solve(n, j + 1, 0)) return true;
          } else if (cells[p + len] !== 1 && solve(p + len + 1, j + 1, 0)) {
            return true;
          }
        }
      }
    }
    if (cell === 1) {
      dead.add(key);
      return false;
    }
    return solve(p + 1, j, 0);
  };
  return solve(0, 0, 0);
}

function dangerInLine(cells: CellState[], clues: number[]): boolean[] {
  const out: boolean[] = new Array(cells.length).fill(false);
  if (lineSolvable(cells, clues)) return out;
  const k = clues.length;
  let runIndex = 0;
  let i = 0;
  while (i < cells.length) {
    if (cells[i] === 1) {
      let j = i;
      while (j < cells.length && cells[j] === 1) j++;
      const len = j - i;
      const limit = runIndex < k ? clues[runIndex] : 0;
      if (len > limit) for (let t = i; t < j; t++) out[t] = true;
      runIndex++;
      i = j;
    } else {
      i++;
    }
  }
  if (!out.some(v => v)) {
    for (let t = 0; t < cells.length; t++) if (cells[t] === 1) out[t] = true;
  }
  return out;
}

const emptyGrid = (n: number): CellState[][] =>
  Array.from({ length: n }, () => new Array<CellState>(n).fill(0));

interface Session {
  diffIndex: number;
  puzzle: Puzzle;
  grid: CellState[][];
  cursor: { r: number; c: number };
  hintsLeft: number;
  hintsUsed: number;
  elapsed: number;
  score: number;
  won: boolean;
  ended: boolean;
}

function makeSession(index: number): Session {
  const cfg = DIFFICULTIES[index];
  const puzzle = buildPuzzle(cfg);
  return {
    diffIndex: index,
    puzzle,
    grid: emptyGrid(puzzle.size),
    cursor: { r: 0, c: 0 },
    hintsLeft: cfg.hints,
    hintsUsed: 0,
    elapsed: 0,
    score: 0,
    won: false,
    ended: false,
  };
}

export const NonogramGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [session, setSession] = useState<Session>(() => makeSession(0));
  const [dangerOn, setDangerOn] = useState(true);
  const startedRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const { puzzle, grid, cursor, won, ended, elapsed, score, hintsLeft, hintsUsed, diffIndex } = session;
  const diff = DIFFICULTIES[diffIndex];

  const newGame = useCallback((index: number) => {
    startedRef.current = null;
    setSession(makeSession(index));
  }, []);

  useEffect(() => {
    if (session.won) return;
    const id = window.setInterval(() => {
      const started = startedRef.current;
      if (started === null) return;
      const secs = Math.floor((Date.now() - started) / 1000);
      setSession(prev => (prev.elapsed === secs ? prev : { ...prev, elapsed: secs }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [session.won]);

  const stats = useMemo(() => {
    let correct = 0;
    let filled = 0;
    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        if (grid[r][c] === 1) {
          filled++;
          if (puzzle.colors[r][c] >= 0) correct++;
        }
      }
    }
    return { correct, filled, pct: puzzle.total ? Math.round((correct / puzzle.total) * 100) : 0 };
  }, [grid, puzzle]);

  const danger = useMemo(() => {
    const n = puzzle.size;
    const map: boolean[][] = [];
    for (let r = 0; r < n; r++) map.push(new Array<boolean>(n).fill(false));
    if (!dangerOn) return { map, count: 0 };
    for (let r = 0; r < n; r++) {
      const flags = dangerInLine(grid[r].slice(), puzzle.rowClues[r]);
      for (let c = 0; c < n; c++) map[r][c] = flags[c];
    }
    for (let c = 0; c < n; c++) {
      const line: CellState[] = [];
      for (let r = 0; r < n; r++) line.push(grid[r][c]);
      const flags = dangerInLine(line, puzzle.colClues[c]);
      for (let r = 0; r < n; r++) if (flags[r]) map[r][c] = true;
    }
    let count = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (map[r][c]) count++;
    return { map, count };
  }, [grid, puzzle, dangerOn]);

  useEffect(() => {
    if (won) return;
    if (stats.correct !== puzzle.total || stats.filled !== puzzle.total) return;
    const started = startedRef.current;
    const secs = started ? Math.floor((Date.now() - started) / 1000) : 0;
    const bonus = Math.round(diff.base * 1.2 * Math.max(0, 1 - secs / diff.target));
    const finalScore = Math.max(10, diff.base + bonus - hintsUsed * 90);
    setSession(prev => ({ ...prev, won: true, ended: true, elapsed: secs, score: finalScore }));
    playClearSound();
    triggerHaptic(40);
  }, [stats, puzzle, won, diff, hintsUsed]);

  const setCell = useCallback(
    (r: number, c: number, state: CellState) => {
      if (won) return;
      if (startedRef.current === null) startedRef.current = Date.now();
      setSession(prev => {
        const grid2 = prev.grid.map(row => row.slice());
        grid2[r][c] = state;
        return { ...prev, grid: grid2, cursor: { r, c } };
      });
      playMoveSound();
      triggerHaptic(12);
    },
    [won],
  );

  const cycleCell = useCallback(
    (r: number, c: number) => {
      if (won) return;
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const cur = session.grid[r][c];
      setCell(r, c, cur === 2 ? 0 : ((cur + 1) as CellState));
    },
    [session.grid, won, setCell],
  );

  const crossCell = useCallback((r: number, c: number) => setCell(r, c, 2), [setCell]);
  const clearCell = useCallback((r: number, c: number) => setCell(r, c, 0), [setCell]);

  const startLongPress = (r: number, c: number) => {
    suppressClickRef.current = false;
    if (longPressRef.current !== null) window.clearTimeout(longPressRef.current);
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      suppressClickRef.current = true;
      crossCell(r, c);
    }, 380);
  };

  const endLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const useHint = () => {
    if (won || hintsLeft <= 0) return;
    const open: { r: number; c: number }[] = [];
    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        if (puzzle.colors[r][c] >= 0 && grid[r][c] !== 1) open.push({ r, c });
      }
    }
    if (!open.length) return;
    const pick = open[Math.floor(Math.random() * open.length)];
    setSession(prev => {
      const grid2 = prev.grid.map(row => row.slice());
      grid2[pick.r][pick.c] = 1;
      return { ...prev, grid: grid2, cursor: pick, hintsLeft: prev.hintsLeft - 1, hintsUsed: prev.hintsUsed + 1 };
    });
    playScoreSound();
    triggerHaptic(20);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const last = puzzle.size - 1;
      let r = cursor.r;
      let c = cursor.c;
      if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
      else if (e.key === 'ArrowDown') r = Math.min(last, r + 1);
      else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
      else if (e.key === 'ArrowRight') c = Math.min(last, c + 1);
      else if (e.key === ' ' || e.key === 'Spacebar') cycleCell(cursor.r, cursor.c);
      else if (e.key === 'x' || e.key === 'X') crossCell(cursor.r, cursor.c);
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') clearCell(cursor.r, cursor.c);
      else return;
      e.preventDefault();
      if (r !== cursor.r || c !== cursor.c) setSession(prev => ({ ...prev, cursor: { r, c } }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [puzzle, won, cursor, cycleCell, crossCell, clearCell]);

  const switchDifficulty = (index: number) => {
    playMoveSound();
    newGame(index);
  };

  const size = puzzle.size;
  const gutter = size >= 20 ? 30 : size >= 15 ? 42 : 54;
  const maxCell = size >= 20 ? 17 : size >= 15 ? 24 : 30;
  const clueFont = size >= 20 ? 'text-[8px]' : size >= 15 ? 'text-[9px]' : 'text-[11px]';
  const boardPad = size >= 20 ? 'p-1' : 'p-1.5 sm:p-2';

  return (
    <GameShell
      game={getGameById('nonogram')!}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={() => newGame(diffIndex)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div
          className="px-3 py-1 rounded-xl border theme-border flex items-center gap-1.5"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">Tiến độ:</span>
          <span className="text-sm font-bold text-emerald-400">
            {stats.correct}/{puzzle.total}
          </span>
          <span className="text-xs font-semibold theme-muted">({stats.pct}%)</span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 w-full px-1">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {DIFFICULTIES.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => switchDifficulty(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition active:translate-y-[1px] ${
                diffIndex === i ? 'text-white border-transparent' : 'theme-panel-soft theme-text theme-border'
              }`}
              style={diffIndex === i ? { background: '#4f46e5' } : undefined}
            >
              {d.label} ({d.size}x{d.size})
            </button>
          ))}
        </div>

        <div
          className="w-full rounded-2xl border theme-border px-3 py-2 flex flex-wrap items-center justify-between gap-2"
          style={{ background: 'var(--game-status-bg)' }}
        >
          <div className="flex items-center gap-1.5">
            {puzzle.palette.map(color => (
              <span key={color} className="w-3.5 h-3.5 rounded border theme-border" style={{ background: color }} />
            ))}
            <span className="text-[10px] theme-muted ml-1 hidden sm:inline">
              Chạm: tô / gạch · Giữ: gạch · Chuột phải: xoá
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              {elapsed}s
            </span>
            <button
              type="button"
              onClick={() => {
                playMoveSound();
                setDangerOn(v => !v);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition active:translate-y-[1px] ${
                dangerOn ? 'text-rose-300 border-rose-500/50 bg-rose-500/15' : 'theme-panel-soft theme-text theme-border'
              }`}
              title="Cảnh báo khi tô vượt số liệu"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {dangerOn ? `Cảnh báo: ${danger.count}` : 'Cảnh báo: tắt'}
            </button>
            <button
              type="button"
              onClick={useHint}
              disabled={hintsLeft <= 0 || won}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-indigo-500/50 bg-indigo-500/15 text-indigo-200 transition active:translate-y-[1px] disabled:opacity-40"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Gợi ý ({hintsLeft})
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border theme-border w-full ${boardPad}`}
          style={{
            background: 'var(--surface-soft)',
            maxWidth: gutter + size * maxCell,
            touchAction: 'manipulation',
          }}
        >
          <div
            className="grid select-none"
            style={{ gridTemplateColumns: `${gutter}px repeat(${size}, minmax(0, 1fr))`, gap: '1px' }}
          >
            <div style={{ gridColumn: 1, gridRow: 1 }} />
            {puzzle.colClues.map((clues, c) => (
              <div
                key={`cc${c}`}
                style={{ gridColumn: c + 2, gridRow: 1 }}
                className="flex flex-col items-center justify-end gap-[1px] pb-[2px]"
              >
                {clues.map((v, i) => (
                  <span key={i} className={`${clueFont} leading-[1.05] font-bold theme-text`}>
                    {v}
                  </span>
                ))}
              </div>
            ))}
              {Array.from({ length: size }, (_, r) => (
                <React.Fragment key={`r${r}`}>
                  <div style={{ gridColumn: 1, gridRow: r + 2 }} className="flex items-center justify-end gap-[3px] pr-[2px]">
                    {puzzle.rowClues[r].map((v, i) => (
                      <span key={i} className={`${clueFont} leading-[1.05] font-bold theme-text`}>
                        {v}
                      </span>
                    ))}
                  </div>
                  {Array.from({ length: size }, (_, c) => {
                    const state = grid[r][c];
                    const isCursor = cursor.r === r && cursor.c === c;
                    const bad = danger.map[r][c];
                    let bg = EMPTY_COLOR;
                    if (state === 1) {
                      if (bad) bg = DANGER_COLOR;
                      else bg = puzzle.colors[r][c] >= 0 ? puzzle.palette[puzzle.colors[r][c]] : WRONG_COLOR;
                    } else if (state === 2) {
                      bg = CROSS_COLOR;
                    }
                    return (
                      <button
                        key={`c${c}`}
                        type="button"
                        onClick={() => cycleCell(r, c)}
                        onContextMenu={e => {
                          e.preventDefault();
                          if (suppressClickRef.current) {
                            suppressClickRef.current = false;
                            return;
                          }
                          clearCell(r, c);
                        }}
                        onTouchStart={() => startLongPress(r, c)}
                        onTouchEnd={endLongPress}
                        onTouchCancel={endLongPress}
                        aria-label={`ô ${r + 1}-${c + 1}`}
                        style={{
                          gridColumn: c + 2,
                          gridRow: r + 2,
                          background: bg,
                          aspectRatio: '1 / 1',
                          border: '1px solid var(--border-color)',
                          outline: isCursor ? '2px solid var(--accent)' : 'none',
                          outlineOffset: '-2px',
                        }}
                        className="flex items-center justify-center p-0 transition-colors duration-100 active:translate-y-[1px]"
                      >
                        {state === 2 ? <X className="w-[55%] h-[55%]" style={{ color: 'var(--text-muted)' }} /> : null}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
          </div>
        </div>

        <p className="text-[11px] theme-muted text-center">
          Phím tắt: ← ↑ → ↓ di chuyển · Space đổi trạng thái · X gạch chéo · Backspace xoá
        </p>
      </div>
    </GameShell>
  );
};
