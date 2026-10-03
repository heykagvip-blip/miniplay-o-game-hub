import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Lightbulb, Eraser, Repeat2, Check, X } from 'lucide-react';

type Cell = 0 | 1 | 2;
type Difficulty = 'easy' | 'medium' | 'hard';

const SIZE: Record<Difficulty, number> = { easy: 8, medium: 10, hard: 12 };
const SEEDS: Record<Difficulty, number> = { easy: 6, medium: 9, hard: 12 };
const BASE_SCORE: Record<Difficulty, number> = { easy: 900, medium: 1700, hard: 2800 };
const PAR_TIME: Record<Difficulty, number> = { easy: 300, medium: 480, hard: 720 };
const MAX_HINTS: Record<Difficulty, number> = { easy: 3, medium: 3, hard: 2 };
const SIZE_LABEL: Record<Difficulty, string> = {
  easy: 'Dễ 8x8',
  medium: 'Trung bình 10x10',
  hard: 'Khó 12x12',
};

interface Generated {
  clue: number[];
  solution: Cell[];
}

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

function isFree(
  land: boolean[],
  own: Set<number>,
  n: number,
  p: number
): boolean {
  const r = Math.floor(p / n);
  const c = p % n;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const q = nr * n + nc;
      if (land[q] && !own.has(q)) return false;
    }
  }
  return true;
}

function addCell(
  land: boolean[],
  groupOf: Int32Array,
  cells: number[][],
  gi: number,
  p: number
): void {
  land[p] = true;
  groupOf[p] = gi;
  cells[gi].push(p);
}

function growGroup(
  land: boolean[],
  groupOf: Int32Array,
  cells: number[][],
  gi: number,
  target: number,
  n: number
): void {
  const own = new Set(cells[gi]);
  const buf: number[] = [];
  while (cells[gi].length < target) {
    buf.length = 0;
    for (const p of cells[gi]) {
      const r = Math.floor(p / n);
      const c = p % n;
      const around = [
        r > 0 ? p - n : -1,
        r < n - 1 ? p + n : -1,
        c > 0 ? p - 1 : -1,
        c < n - 1 ? p + 1 : -1,
      ];
      for (const q of around) {
        if (q < 0 || land[q]) continue;
        if (buf.indexOf(q) >= 0) continue;
        if (!isFree(land, own, n, q)) continue;
        buf.push(q);
      }
    }
    if (buf.length === 0) return;
    const pick = buf[Math.floor(Math.random() * buf.length)];
    addCell(land, groupOf, cells, gi, pick);
    own.add(pick);
  }
}

function firstSeaBlock(land: boolean[], n: number): number {
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const p = r * n + c;
      if (!land[p] && !land[p + 1] && !land[p + n] && !land[p + n + 1]) return p;
    }
  }
  return -1;
}

function soleNeighbourGroup(
  land: boolean[],
  groupOf: Int32Array,
  n: number,
  p: number
): number {
  const r = Math.floor(p / n);
  const c = p % n;
  const near: number[] = [];
  if (r > 0 && land[p - n]) near.push(groupOf[p - n]);
  if (r < n - 1 && land[p + n]) near.push(groupOf[p + n]);
  if (c > 0 && land[p - 1]) near.push(groupOf[p - 1]);
  if (c < n - 1 && land[p + 1]) near.push(groupOf[p + 1]);
  for (let i = 0; i < near.length; i++) {
    if (near[i] < 0 || near[i] === near[0]) continue;
    return -1;
  }
  return near.length === 0 ? -1 : near[0];
}

function repairBlock(
  land: boolean[],
  groupOf: Int32Array,
  cells: number[][],
  n: number,
  block: number
): boolean {
  const order = shuffle([block, block + 1, block + n, block + n + 1]);
  for (const p of order) {
    const gi = soleNeighbourGroup(land, groupOf, n, p);
    if (gi < 0 || cells[gi].length >= 4) continue;
    if (!isFree(land, new Set<number>(cells[gi]), n, p)) continue;
    addCell(land, groupOf, cells, gi, p);
    return true;
  }
  for (const p of order) {
    if (soleNeighbourGroup(land, groupOf, n, p) >= 0) continue;
    if (land[p] || !isFree(land, new Set<number>(), n, p)) continue;
    cells.push([]);
    const gi = cells.length - 1;
    addCell(land, groupOf, cells, gi, p);
    growGroup(land, groupOf, cells, gi, 2 + Math.floor(Math.random() * 3), n);
    return true;
  }
  return false;
}

function seaConnected(land: boolean[], n: number): boolean {
  const total = n * n;
  let start = -1;
  let seaCount = 0;
  for (let i = 0; i < total; i++) {
    if (land[i]) continue;
    seaCount++;
    if (start < 0) start = i;
  }
  if (seaCount === 0 || start < 0) return false;
  const seen = new Uint8Array(total);
  const stack = [start];
  seen[start] = 1;
  let reached = 0;
  while (stack.length) {
    const p = stack.pop() as number;
    reached++;
    const r = Math.floor(p / n);
    const c = p % n;
    const around = [
      r > 0 ? p - n : -1,
      r < n - 1 ? p + n : -1,
      c > 0 ? p - 1 : -1,
      c < n - 1 ? p + 1 : -1,
    ];
    for (const q of around) {
      if (q < 0 || seen[q] || land[q]) continue;
      seen[q] = 1;
      stack.push(q);
    }
  }
  return reached === seaCount;
}

function tryGenerate(n: number, seeds: number): Generated | null {
  const total = n * n;
  const land = new Array<boolean>(total).fill(false);
  const groupOf = new Int32Array(total).fill(-1);
  const cells: number[][] = [];
  const spots = shuffle(Array.from({ length: total }, (_, i) => i));
  for (const p of spots) {
    if (cells.length >= seeds) break;
    if (!isFree(land, new Set<number>(), n, p)) continue;
    cells.push([]);
    addCell(land, groupOf, cells, cells.length - 1, p);
  }
  if (cells.length < 3) return null;
  for (let guard = 0; guard < total * 2; guard++) {
    const block = firstSeaBlock(land, n);
    if (block < 0) break;
    if (!repairBlock(land, groupOf, cells, n, block)) return null;
  }
  if (firstSeaBlock(land, n) >= 0) return null;
  for (const gi of shuffle(cells.map((_, i) => i))) {
    const before = cells[gi].length;
    growGroup(land, groupOf, cells, gi, 2 + Math.floor(Math.random() * 3), n);
    if (!seaConnected(land, n)) {
      for (let k = cells[gi].length - 1; k >= before; k--) {
        const p = cells[gi][k];
        land[p] = false;
        groupOf[p] = -1;
        cells[gi].pop();
      }
    }
  }
  if (firstSeaBlock(land, n) >= 0) return null;
  if (!seaConnected(land, n)) return null;
  const clue = new Array<number>(total).fill(0);
  for (const group of cells) {
    if (group.length < 1 || group.length > 4) return null;
    const p = group[Math.floor(Math.random() * group.length)];
    clue[p] = group.length;
  }
  const solution: Cell[] = land.map(v => (v ? 1 : 2)) as Cell[];
  return { clue, solution };
}

function generatePuzzle(n: number, seeds: number): Generated {
  for (let extra = 0; extra < 6; extra++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = tryGenerate(n, seeds + extra);
      if (res) return res;
    }
  }
  const fallback = tryGenerate(n, Math.floor((n * n) / 5));
  if (fallback) return fallback;
  return { clue: new Array<number>(n * n).fill(0), solution: new Array<Cell>(n * n).fill(2) as Cell[] };
}

interface Analysis {
  danger: Uint8Array;
  block: Uint8Array;
  islands: number;
}

function analyze(marks: Cell[], clue: number[], n: number): Analysis {
  const total = n * n;
  const seen = new Uint8Array(total);
  const danger = new Uint8Array(total);
  const block = new Uint8Array(total);
  let islands = 0;
  for (let i = 0; i < total; i++) {
    if (marks[i] !== 1 || seen[i]) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop() as number;
      comp.push(p);
      const r = Math.floor(p / n);
      const c = p % n;
      const around = [
        r > 0 ? p - n : -1,
        r < n - 1 ? p + n : -1,
        c > 0 ? p - 1 : -1,
        c < n - 1 ? p + 1 : -1,
      ];
      for (const q of around) {
        if (q < 0 || seen[q] || marks[q] !== 1) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    islands++;
    let value = 0;
    let clues = 0;
    for (const p of comp) {
      if (clue[p] > 0) {
        value = clue[p];
        clues++;
      }
    }
    if (clues > 0 && comp.length > value) {
      for (const p of comp) danger[p] = 1;
    }
  }
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const p = r * n + c;
      if (marks[p] !== 2 || marks[p + 1] !== 2) continue;
      if (marks[p + n] !== 2 || marks[p + n + 1] !== 2) continue;
      block[p] = 1;
      block[p + 1] = 1;
      block[p + n] = 1;
      block[p + n + 1] = 1;
    }
  }
  return { danger, block, islands };
}

function isSolved(marks: Cell[], clue: number[], n: number): boolean {
  const total = n * n;
  for (let i = 0; i < total; i++) {
    if (marks[i] === 0) return false;
  }
  const { block } = analyze(marks, clue, n);
  for (let i = 0; i < total; i++) {
    if (block[i]) return false;
  }
  const owner = new Int32Array(total).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < total; i++) {
    if (marks[i] !== 1) continue;
    if (owner[i] >= 0) continue;
    const id = i;
    owner[i] = id;
    stack.push(i);
    const comp: number[] = [];
    while (stack.length) {
      const p = stack.pop() as number;
      comp.push(p);
      const r = Math.floor(p / n);
      const c = p % n;
      const around = [
        r > 0 ? p - n : -1,
        r < n - 1 ? p + n : -1,
        c > 0 ? p - 1 : -1,
        c < n - 1 ? p + 1 : -1,
      ];
      for (const q of around) {
        if (q < 0 || owner[q] >= 0 || marks[q] !== 1) continue;
        owner[q] = id;
        stack.push(q);
      }
    }
    let value = 0;
    let clues = 0;
    for (const p of comp) {
      if (clue[p] > 0) {
        value = clue[p];
        clues++;
      }
    }
    if (clues !== 1 || comp.length !== value) return false;
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const p = r * n + c;
      if (owner[p] < 0) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const q = nr * n + nc;
          if (owner[q] >= 0 && owner[q] !== owner[p]) return false;
        }
      }
    }
  }
  let start = -1;
  let seaTotal = 0;
  for (let i = 0; i < total; i++) {
    if (marks[i] === 2) {
      seaTotal++;
      if (start < 0) start = i;
    }
  }
  if (start < 0) return false;
  const seen = new Uint8Array(total);
  const queue = [start];
  seen[start] = 1;
  let reached = 0;
  while (queue.length) {
    const p = queue.pop() as number;
    reached++;
    const r = Math.floor(p / n);
    const c = p % n;
    const around = [
      r > 0 ? p - n : -1,
      r < n - 1 ? p + n : -1,
      c > 0 ? p - 1 : -1,
      c < n - 1 ? p + 1 : -1,
    ];
    for (const q of around) {
      if (q < 0 || seen[q] || marks[q] !== 2) continue;
      seen[q] = 1;
      queue.push(q);
    }
  }
  return reached === seaTotal;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

export const NurikabeGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('nurikabe')!;
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [n, setN] = useState(8);
  const [clue, setClue] = useState<number[]>([]);
  const [solution, setSolution] = useState<Cell[]>([]);
  const [marks, setMarks] = useState<Cell[]>([]);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [won, setWon] = useState(false);
  const [ended, setEnded] = useState(false);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isLight, setIsLight] = useState(false);
  const startRef = useRef<number>(Date.now());
  const pressRef = useRef<number | null>(null);
  const longRef = useRef(-1);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsLight(root.classList.contains('light'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const startGame = useCallback((diff: Difficulty) => {
    const size = SIZE[diff];
    const res = generatePuzzle(size, SEEDS[diff]);
    const initial: Cell[] = new Array<Cell>(size * size).fill(0) as Cell[];
    for (let i = 0; i < size * size; i++) {
      if (res.clue[i] > 0) initial[i] = 1;
    }
    setDifficulty(diff);
    setN(size);
    setClue(res.clue);
    setSolution(res.solution);
    setMarks(initial);
    setLocked(new Array<boolean>(size * size).fill(false));
    setCursor([0, 0]);
    setHintsLeft(MAX_HINTS[diff]);
    setHintsUsed(0);
    setReverse(false);
    setWon(false);
    setEnded(false);
    setScore(0);
    setElapsed(0);
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    startGame('easy');
  }, [startGame]);

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ended]);

  const finish = useCallback(
    (finalMarks: Cell[], finalClue: number[], size: number, used: number) => {
      if (!isSolved(finalMarks, finalClue, size)) return;
      const time = Math.floor((Date.now() - startRef.current) / 1000);
      const bonus = Math.max(0, PAR_TIME[difficulty] - time) * 2;
      const total = Math.max(50, BASE_SCORE[difficulty] + bonus - used * 200);
      setScore(total);
      setWon(true);
      setEnded(true);
      setElapsed(time);
      playClearSound();
      triggerHaptic(40);
    },
    [difficulty]
  );

  const paint = useCallback(
    (r: number, c: number, dir: 1 | -1) => {
      if (ended) return;
      const i = r * n + c;
      if (clue[i] > 0 || locked[i]) {
        playMoveSound();
        return;
      }
      const next = marks.slice();
      next[i] = (((marks[i] + (dir === 1 ? 1 : 2)) % 3) as Cell);
      setMarks(next);
      playMoveSound();
      triggerHaptic(12);
      finish(next, clue, n, hintsUsed);
    },
    [ended, n, clue, locked, marks, hintsUsed, finish]
  );

  const clearCell = useCallback(() => {
    if (ended) return;
    const i = cursor[0] * n + cursor[1];
    if (clue[i] > 0 || locked[i]) return;
    if (marks[i] === 0) return;
    const next = marks.slice();
    next[i] = 0;
    setMarks(next);
    playMoveSound();
  }, [ended, cursor, n, clue, locked, marks]);

  const handleHint = useCallback(() => {
    if (ended || hintsLeft <= 0) return;
    const total = n * n;
    const wrong: number[] = [];
    const empty: number[] = [];
    for (let i = 0; i < total; i++) {
      if (clue[i] > 0 || locked[i]) continue;
      if (marks[i] === 0) empty.push(i);
      else if (marks[i] !== solution[i]) wrong.push(i);
    }
    const pool = wrong.length > 0 ? wrong : empty;
    if (pool.length === 0) return;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const nextMarks = marks.slice();
    nextMarks[target] = solution[target];
    const nextLocked = locked.slice();
    nextLocked[target] = true;
    setMarks(nextMarks);
    setLocked(nextLocked);
    setHintsLeft(h => h - 1);
    setHintsUsed(u => u + 1);
    setCursor([Math.floor(target / n), target % n]);
    playClearSound();
    triggerHaptic(25);
    finish(nextMarks, clue, n, hintsUsed + 1);
  }, [ended, hintsLeft, n, clue, locked, marks, solution, hintsUsed, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (ended) return;
      const r = cursor[0];
      const c = cursor[1];
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor([Math.max(0, r - 1), c]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor([Math.min(n - 1, r + 1), c]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursor([r, Math.max(0, c - 1)]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursor([r, Math.min(n - 1, c + 1)]);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        paint(r, c, reverse ? -1 : 1);
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        clearCell();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        setReverse(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, n, ended, paint, clearCell, reverse]);

  const view = useMemo(
    () => analyze(marks, clue, n),
    [marks, clue, n]
  );
  const hasBlock = useMemo(() => {
    for (let i = 0; i < n * n; i++) {
      if (view.block[i]) return true;
    }
    return false;
  }, [view, n]);
  const filled = useMemo(() => marks.reduce<number>((acc, v) => acc + (v === 0 ? 0 : 1), 0), [marks]);
  const seaFilled = useMemo(() => marks.reduce<number>((acc, v) => acc + (v === 2 ? 1 : 0), 0), [marks]);
  const landTotal = useMemo(
    () => solution.reduce<number>((acc, v) => acc + (v === 1 ? 1 : 0), 0),
    [solution]
  );
  const target = n * n;

  const bg = useMemo(() => {
    if (isLight) {
      return {
        cell: '#e3effc',
        island: '#86efac',
        sea: '#33404f',
        clue: '#bcd9f6',
        dangerIsland: '#fdba74',
        dangerSea: '#fca5a5',
        ink: '#0f172a',
        seaInk: '#f1f5f9',
      };
    }
    return {
      cell: '#2b2138',
      island: '#1f6f45',
      sea: '#0c0c12',
      clue: '#3d2f57',
      dangerIsland: '#7c2d12',
      dangerSea: '#7f1d1d',
      ink: '#f8fafc',
      seaInk: '#94a3b8',
    };
  }, [isLight]);

  const beginPress = (r: number, c: number) => {
    longRef.current = -1;
    if (pressRef.current !== null) window.clearTimeout(pressRef.current);
    pressRef.current = window.setTimeout(() => {
      pressRef.current = null;
      longRef.current = r * n + c;
      paint(r, c, -1);
    }, 420);
  };
  const endPress = () => {
    if (pressRef.current !== null) {
      window.clearTimeout(pressRef.current);
      pressRef.current = null;
    }
  };

  const fontClass = n <= 8 ? 'text-sm' : n <= 10 ? 'text-xs' : 'text-[10px]';

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={() => startGame(difficulty)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2">
          <div
            className="px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5"
            style={{ borderColor: 'var(--border-color)', background: 'var(--surface-strong)' }}
          >
            <span className="theme-muted">Ô</span>
            <span className="font-bold theme-text">
              {filled}/{target}
            </span>
          </div>
          <div
            className="px-2.5 py-1 rounded-xl border text-xs font-bold"
            style={{ borderColor: 'var(--border-color)', background: 'var(--surface-strong)' }}
          >
            {formatTime(elapsed)}
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center w-full max-w-lg mx-auto gap-2.5 px-1">
        <div
          className="flex items-center gap-1.5 p-1 rounded-2xl w-full"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-color)' }}
        >
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => startGame(d)}
              className="flex-1 px-2 py-1.5 rounded-xl text-[11px] font-bold transition active:translate-y-[2px]"
              style={
                difficulty === d
                  ? { background: '#4338ca', color: '#fff' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {SIZE_LABEL[d]}
            </button>
          ))}
        </div>

        <div
          className="w-full rounded-2xl p-2"
          style={{ background: 'var(--game-status-bg)', border: '1px solid var(--border-color)' }}
        >
          <div
            className="grid gap-px w-full aspect-square"
            style={{
              gridTemplateColumns: 'repeat(' + n + ', 1fr)',
              background: 'var(--border-color)',
              border: '2px solid var(--border-color)',
            }}
          >
            {marks.map((mark, i) => {
              const r = Math.floor(i / n);
              const c = i % n;
              const isClue = clue[i] > 0;
              const isCursor = cursor[0] === r && cursor[1] === c;
              const badBlock = view.block[i] === 1;
              const badIsland = view.danger[i] === 1;
              let fill = bg.cell;
              let ink = bg.ink;
              if (mark === 1) {
                fill = bg.island;
                ink = isLight ? '#052e16' : '#dcfce7';
              } else if (mark === 2) {
                fill = bg.sea;
                ink = bg.seaInk;
              } else if (isClue) {
                fill = bg.clue;
              }
              if (badBlock) {
                fill = bg.dangerSea;
                ink = isLight ? '#7f1d1d' : '#fee2e2';
              } else if (badIsland) {
                fill = bg.dangerIsland;
                ink = isLight ? '#7c2d12' : '#ffedd5';
              }
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (longRef.current === i) {
                      longRef.current = -1;
                      return;
                    }
                    setCursor([r, c]);
                    paint(r, c, reverse ? -1 : 1);
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    setCursor([r, c]);
                    paint(r, c, -1);
                  }}
                  onPointerDown={e => {
                    if (e.pointerType === 'touch') beginPress(r, c);
                  }}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onPointerCancel={endPress}
                  className={'flex items-center justify-center font-black select-none transition-colors ' + fontClass}
                  style={{
                    background: fill,
                    color: ink,
                    outline: isCursor ? '2px solid var(--accent)' : 'none',
                    outlineOffset: -2,
                    touchAction: 'manipulation',
                  }}
                >
                  {isClue ? clue[i] : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 w-full">
          <button
            onClick={handleHint}
            disabled={hintsLeft <= 0 || ended}
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
            onClick={clearCell}
            disabled={ended}
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
          <button
            onClick={() => {
              setReverse(v => !v);
              playMoveSound();
            }}
            disabled={ended}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:translate-y-[2px] disabled:opacity-40"
            style={
              reverse
                ? { background: '#4338ca', borderColor: '#4338ca', color: '#fff' }
                : {
                    background: 'var(--surface-strong)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }
            }
          >
            {reverse ? <Check className="w-3.5 h-3.5" /> : <Repeat2 className="w-3.5 h-3.5" />}
            <span>Đảo chiều</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1 theme-muted">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: bg.clue, border: '1px solid var(--border-color)' }}
            />
            Ô số (đảo)
          </span>
          <span className="flex items-center gap-1 theme-muted">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: bg.island, border: '1px solid var(--border-color)' }}
            />
            Đảo
          </span>
          <span className="flex items-center gap-1 theme-muted">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: bg.sea, border: '1px solid var(--border-color)' }}
            />
            Biển (tường)
          </span>
          <span className="flex items-center gap-1 theme-muted">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: bg.dangerSea, border: '1px solid var(--border-color)' }}
            />
            2x2 biển (sai)
          </span>
          <span className="flex items-center gap-1 theme-muted">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: bg.dangerIsland, border: '1px solid var(--border-color)' }}
            />
            Đảo quá số (sai)
          </span>
        </div>

        <div className="flex items-center justify-center gap-3 w-full text-[11px]">
          <span className="theme-muted">
            Biển: {seaFilled}/{target - landTotal}
          </span>
          <span className="theme-muted">Đảo: {view.islands}</span>
          {hasBlock && (
            <span className="flex items-center gap-0.5 font-bold" style={{ color: '#f87171' }}>
              <X className="w-3 h-3" />
              Khối 2x2 biển
            </span>
          )}
        </div>

        <p className="text-[11px] text-center theme-muted leading-relaxed">
          Mỗi ô số nằm trong một đảo đúng bằng số ô (không chạm đảo khác kể cả chéo). Phần còn lại
          là biển: phải liên thông và không có khối 2x2 toàn biển. Click trái đổi trạng thái, chuột
          phải hoặc giữ để đảo ngược. Phím mũi tên di chuyển, Space đổi ô, Z đảo chiều, X xóa ô.
        </p>
      </div>
    </GameShell>
  );
};
