import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Clock, Eraser, Eye } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';

interface MasyuLevel {
  label: string;
  size: number;
  base: number;
  limit: number;
  keep: number;
  minLoop: number;
  minCandidates: number;
  revealPenalty: number;
}

interface Puzzle {
  circles: number[];
  solution: Set<number>;
}

const LEVELS: Record<Difficulty, MasyuLevel> = {
  easy: { label: 'Dễ', size: 6, base: 600, limit: 300, keep: 0.8, minLoop: 8, minCandidates: 8, revealPenalty: 260 },
  medium: { label: 'Trung bình', size: 8, base: 1000, limit: 480, keep: 0.66, minLoop: 12, minCandidates: 10, revealPenalty: 440 },
  hard: { label: 'Khó', size: 10, base: 1600, limit: 720, keep: 0.52, minLoop: 16, minCandidates: 12, revealPenalty: 680 },
};

const LEVEL_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const MISTAKE_PENALTY = 15;
const PAD = 0.55;
const SPAN_UNIT = 1024;
const DR = [0, 1, 0, -1];
const DC = [1, 0, -1, 0];
const LOOP_COLOR = '#4f46e5';
const LOOP_COLOR_SOLVED = '#f59e0b';
const DANGER_COLOR = '#ef4440';
const GOOD_COLOR = '#16a34a';
const WHITE_FILL = '#f8fafc';
const BLACK_FILL = '#111827';

const rowOf = (size: number, dot: number): number => Math.floor(dot / size);
const colOf = (size: number, dot: number): number => dot % size;
const dotAt = (size: number, row: number, col: number): number => row * size + col;
const edgeKey = (a: number, b: number): number => (a < b ? a * SPAN_UNIT + b : b * SPAN_UNIT + a);
const keyA = (key: number): number => Math.floor(key / SPAN_UNIT);
const keyB = (key: number): number => key % SPAN_UNIT;

const shuffle = <T,>(list: T[]): T[] => {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
};

const neighborsOf = (size: number, dot: number): number[] => {
  const row = rowOf(size, dot);
  const col = colOf(size, dot);
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    const r = row + DR[d];
    const c = col + DC[d];
    if (r >= 0 && r < size && c >= 0 && c < size) out.push(dotAt(size, r, c));
  }
  return out;
};

const areAdjacent = (size: number, a: number, b: number): boolean =>
  Math.abs(rowOf(size, a) - rowOf(size, b)) + Math.abs(colOf(size, a) - colOf(size, b)) === 1;

const hasEdge = (edges: Set<number>, a: number, b: number): boolean => edges.has(edgeKey(a, b));

const computeDegrees = (total: number, edges: Set<number>): number[] => {
  const deg = new Array<number>(total).fill(0);
  edges.forEach(key => {
    deg[keyA(key)] += 1;
    deg[keyB(key)] += 1;
  });
  return deg;
};

const dirsAt = (size: number, dot: number, edges: Set<number>): number[] => {
  const row = rowOf(size, dot);
  const col = colOf(size, dot);
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    const r = row + DR[d];
    const c = col + DC[d];
    if (r < 0 || r >= size || c < 0 || c >= size) continue;
    if (edges.has(edgeKey(dot, dotAt(size, r, c)))) out.push(d);
  }
  return out;
};

const dirsStraight = (dirs: number[]): boolean => dirs.length === 2 && (dirs[0] + 2) % 4 === dirs[1];

const isStraightDot = (size: number, dot: number, edges: Set<number>): boolean =>
  dirsStraight(dirsAt(size, dot, edges));

const isTurnDot = (size: number, dot: number, edges: Set<number>): boolean => {
  const dirs = dirsAt(size, dot, edges);
  return dirs.length === 2 && !dirsStraight(dirs);
};

const edgesFromCycle = (cycle: number[]): Set<number> => {
  const set = new Set<number>();
  for (let i = 0; i < cycle.length; i++) set.add(edgeKey(cycle[i], cycle[(i + 1) % cycle.length]));
  return set;
};

const componentCount = (size: number, edges: Set<number>): number => {
  const total = size * size;
  const deg = computeDegrees(total, edges);
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  let comps = 0;
  for (let start = 0; start < total; start++) {
    if (deg[start] === 0 || seen[start] === 1) continue;
    comps += 1;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      for (const nb of neighborsOf(size, cur)) {
        if (seen[nb] === 1 || !hasEdge(edges, cur, nb)) continue;
        seen[nb] = 1;
        stack.push(nb);
      }
    }
  }
  return comps;
};

const isConnected = (size: number, edges: Set<number>, a: number, b: number): boolean => {
  if (a === b) return true;
  const total = size * size;
  const seen = new Uint8Array(total);
  const stack: number[] = [a];
  seen[a] = 1;
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    for (const nb of neighborsOf(size, cur)) {
      if (seen[nb] === 1 || !hasEdge(edges, cur, nb)) continue;
      if (nb === b) return true;
      seen[nb] = 1;
      stack.push(nb);
    }
  }
  return false;
};

const skippedDots = (size: number, edges: Set<number>): number[] => {
  const total = size * size;
  const deg = computeDegrees(total, edges);
  const out: number[] = [];
  for (let dot = 0; dot < total; dot++) {
    if (deg[dot] !== 0) continue;
    const col = colOf(size, dot);
    const row = rowOf(size, dot);
    if (col >= 2 && col <= size - 3 && hasEdge(edges, dot - 1, dot - 2) && hasEdge(edges, dot + 1, dot + 2)) {
      out.push(dot);
      continue;
    }
    if (row >= 2 && row <= size - 3 && hasEdge(edges, dot - size, dot - size * 2) && hasEdge(edges, dot + size, dot + size * 2)) {
      out.push(dot);
    }
  }
  return out;
};

const isSingleClosedLoop = (size: number, edges: Set<number>): boolean => {
  const total = size * size;
  if (edges.size < 4) return false;
  const deg = computeDegrees(total, edges);
  for (let dot = 0; dot < total; dot++) if (deg[dot] === 1 || deg[dot] > 2) return false;
  return componentCount(size, edges) === 1;
};

const canAddEdge = (size: number, edges: Set<number>, a: number, b: number): boolean => {
  if (!areAdjacent(size, a, b)) return false;
  if (edges.has(edgeKey(a, b))) return false;
  const deg = computeDegrees(size * size, edges);
  if (deg[a] >= 2 || deg[b] >= 2) return false;
  if (isSingleClosedLoop(size, edges)) return false;
  if (isConnected(size, edges, a, b) && componentCount(size, edges) > 1) return false;
  return true;
};

type CircleState = 'pending' | 'ok' | 'bad';

const circleState = (
  size: number,
  dot: number,
  kind: number,
  edges: Set<number>,
  closedLoop: boolean,
): CircleState => {
  const dirs = dirsAt(size, dot, edges);
  if (dirs.length === 0) return closedLoop ? 'bad' : 'pending';
  if (dirs.length !== 2) return 'pending';
  const row = rowOf(size, dot);
  const col = colOf(size, dot);
  let n1 = -1;
  let n2 = -1;
  for (let i = 0; i < 2; i++) {
    const r = row + DR[dirs[i]];
    const c = col + DC[dirs[i]];
    if (r < 0 || r >= size || c < 0 || c >= size) return 'pending';
    const nb = dotAt(size, r, c);
    if (i === 0) n1 = nb;
    else n2 = nb;
  }
  const s1 = isStraightDot(size, n1, edges);
  const s2 = isStraightDot(size, n2, edges);
  const straight = dirsStraight(dirs);
  if (kind === 2) return !straight && s1 && s2 ? 'ok' : 'bad';
  return straight && (!s1 || !s2) ? 'ok' : 'bad';
};

const checkWin = (size: number, circles: number[], edges: Set<number>): boolean => {
  if (!isSingleClosedLoop(size, edges)) return false;
  if (skippedDots(size, edges).length > 0) return false;
  for (let dot = 0; dot < size * size; dot++) {
    if (circles[dot] === 0) continue;
    if (circleState(size, dot, circles[dot], edges, true) !== 'ok') return false;
  }
  return true;
};

const randomCycle = (size: number, budget: number): number[] | null => {
  const total = size * size;
  if (total < 4) return null;
  const start = Math.floor(Math.random() * total);
  const cycle: number[] = [start];
  const pos = new Int32Array(total).fill(-1);
  pos[start] = 0;
  let cur = start;
  for (let step = 0; step < budget; step++) {
    const options = neighborsOf(size, cur);
    if (options.length === 0) return null;
    const open: number[] = [];
    for (const nb of options) if (pos[nb] === -1) open.push(nb);
    const nb =
      open.length > 0
        ? open[Math.floor(Math.random() * open.length)]
        : options[Math.floor(Math.random() * options.length)];
    const idx = pos[nb];
    if (idx === -1) {
      pos[nb] = cycle.length;
      cycle.push(nb);
      cur = nb;
      continue;
    }
    if (idx === 0) return cycle.slice();
    for (let k = cycle.length - 1; k > idx; k--) pos[cycle[k]] = -1;
    cycle.length = idx + 1;
    cur = nb;
  }
  return null;
};

const serpentineCycle = (size: number): number[] => {
  const out: number[] = [];
  for (let col = 0; col < size; col++) out.push(dotAt(size, 0, col));
  for (let row = 1; row < size; row++) {
    if (row % 2 === 1) {
      for (let col = size - 1; col >= 1; col--) out.push(dotAt(size, row, col));
    } else {
      for (let col = 1; col <= size - 1; col++) out.push(dotAt(size, row, col));
    }
  }
  for (let row = size - 1; row >= 1; row--) out.push(dotAt(size, row, 0));
  return out;
};

const deriveCircles = (
  size: number,
  solution: Set<number>,
  cycle: number[],
  keep: number,
): { circles: number[]; candidates: number } => {
  const total = size * size;
  const circles = new Array<number>(total).fill(0);
  const candidates: { dot: number; kind: number }[] = [];
  for (const dot of cycle) {
    const dirs = dirsAt(size, dot, solution);
    if (dirs.length !== 2) continue;
    const row = rowOf(size, dot);
    const col = colOf(size, dot);
    const n1 = dotAt(size, row + DR[dirs[0]], col + DC[dirs[0]]);
    const n2 = dotAt(size, row + DR[dirs[1]], col + DC[dirs[1]]);
    const s1 = isStraightDot(size, n1, solution);
    const s2 = isStraightDot(size, n2, solution);
    const straight = dirsStraight(dirs);
    if (!straight && s1 && s2) candidates.push({ dot, kind: 2 });
    else if (straight && (!s1 || !s2)) candidates.push({ dot, kind: 1 });
  }
  const order = shuffle(candidates);
  const count = Math.min(order.length, Math.max(4, Math.round(order.length * keep)));
  for (let i = 0; i < count; i++) circles[order[i].dot] = order[i].kind;
  return { circles, candidates: order.length };
};

const generatePuzzle = (size: number, keep: number, minLoop: number, minCandidates: number): Puzzle => {
  for (let attempt = 0; attempt < 300; attempt++) {
    const cycle = randomCycle(size, 4000);
    if (!cycle || cycle.length < minLoop) continue;
    const solution = edgesFromCycle(cycle);
    if (componentCount(size, solution) !== 1) continue;
    if (skippedDots(size, solution).length > 0) continue;
    const derived = deriveCircles(size, solution, cycle, keep);
    if (derived.candidates < minCandidates) continue;
    return { circles: derived.circles, solution };
  }
  const cycle = serpentineCycle(size);
  const solution = edgesFromCycle(cycle);
  return { circles: deriveCircles(size, solution, cycle, keep).circles, solution };
};

const computeScore = (level: MasyuLevel, elapsed: number, revealed: boolean, mistakes: number): number => {
  const timeBonus = Math.max(0, Math.round((level.limit - elapsed) * 3));
  const penalty = (revealed ? level.revealPenalty : 0) + mistakes * MISTAKE_PENALTY;
  return Math.max(80, level.base + timeBonus - penalty);
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const MasyuGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('masyu')!;

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [puzzle, setPuzzle] = useState<Puzzle>(() =>
    generatePuzzle(LEVELS.easy.size, LEVELS.easy.keep, LEVELS.easy.minLoop, LEVELS.easy.minCandidates),
  );
  const [edges, setEdges] = useState<Set<number>>(() => new Set<number>());
  const [pendingDot, setPendingDot] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const size = LEVELS[difficulty].size;
  const circles = puzzle.circles;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const edgesRef = useRef<Set<number>>(new Set<number>());
  const statsRef = useRef({ elapsed: 0, mistakes: 0, revealed: false });
  const metaRef = useRef({ size, circles, solution: puzzle.solution, difficulty, ended });
  metaRef.current = { size, circles, solution: puzzle.solution, difficulty, ended };

  const finish = useCallback((finalEdges: Set<number>) => {
    const meta = metaRef.current;
    if (meta.ended) return;
    if (!checkWin(meta.size, meta.circles, finalEdges)) return;
    setWon(true);
    setEnded(true);
    setFinalScore(
      computeScore(LEVELS[meta.difficulty], statsRef.current.elapsed, statsRef.current.revealed, statsRef.current.mistakes),
    );
    playClearSound();
    triggerHaptic(60);
  }, []);

  const commit = useCallback((next: Set<number>) => {
    edgesRef.current = next;
    setEdges(next);
  }, []);

  const addMistake = useCallback(() => {
    statsRef.current.mistakes += 1;
    setMistakes(statsRef.current.mistakes);
    playMoveSound();
  }, []);

  const toggleEdge = useCallback(
    (a: number, b: number) => {
      const meta = metaRef.current;
      if (meta.ended || !areAdjacent(meta.size, a, b)) return;
      const key = edgeKey(a, b);
      const current = edgesRef.current;
      const next = new Set(current);
      if (current.has(key)) {
        next.delete(key);
        commit(next);
        playClearSound();
        triggerHaptic(12);
        return;
      }
      if (!canAddEdge(meta.size, current, a, b)) {
        addMistake();
        return;
      }
      next.add(key);
      commit(next);
      playMoveSound();
      triggerHaptic(12);
      finish(next);
    },
    [addMistake, commit, finish],
  );

  const removeEdge = useCallback(
    (key: number) => {
      const meta = metaRef.current;
      if (meta.ended || !edgesRef.current.has(key)) return;
      const next = new Set(edgesRef.current);
      next.delete(key);
      commit(next);
      playClearSound();
      triggerHaptic(12);
    },
    [commit],
  );

  const dotFromPoint = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return -1;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;
    const grid = metaRef.current.size;
    const span = grid + PAD * 2;
    const x = ((clientX - rect.left) / rect.width) * span - PAD;
    const y = ((clientY - rect.top) / rect.height) * span - PAD;
    const col = Math.round(x);
    const row = Math.round(y);
    if (row < 0 || col < 0 || row >= grid || col >= grid) return -1;
    if (Math.abs(x - col) > 0.42 || Math.abs(y - row) > 0.42) return -1;
    return dotAt(grid, row, col);
  }, []);

  const dragRef = useRef<{ last: number; moved: boolean } | null>(null);
  const pendingRef = useRef<number | null>(null);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || metaRef.current.ended) return;
      const dot = dotFromPoint(clientX, clientY);
      if (dot < 0 || dot === drag.last) return;
      const prev = drag.last;
      if (!areAdjacent(metaRef.current.size, prev, dot)) return;
      drag.last = dot;
      drag.moved = true;
      toggleEdge(prev, dot);
    },
    [dotFromPoint, toggleEdge],
  );

  const handleUp = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      if (drag.moved) {
        if (pendingRef.current !== null) {
          pendingRef.current = null;
          setPendingDot(null);
        }
        return;
      }
      const dot = dotFromPoint(clientX, clientY);
      if (dot < 0) {
        pendingRef.current = null;
        setPendingDot(null);
        return;
      }
      const prev = pendingRef.current;
      if (prev !== null && areAdjacent(metaRef.current.size, prev, dot)) {
        pendingRef.current = null;
        setPendingDot(null);
        toggleEdge(prev, dot);
        return;
      }
      pendingRef.current = dot;
      setPendingDot(dot);
    },
    [dotFromPoint, toggleEdge],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => handleMove(event.clientX, event.clientY);
    const up = (event: PointerEvent) => handleUp(event.clientX, event.clientY);
    const cancel = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [handleMove, handleUp]);

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(() => {
      statsRef.current.elapsed += 1;
      setElapsed(statsRef.current.elapsed);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ended]);

  const restart = useCallback((next: Difficulty) => {
    const level = LEVELS[next];
    dragRef.current = null;
    pendingRef.current = null;
    edgesRef.current = new Set<number>();
    statsRef.current = { elapsed: 0, mistakes: 0, revealed: false };
    setDifficulty(next);
    setPuzzle(generatePuzzle(level.size, level.keep, level.minLoop, level.minCandidates));
    setEdges(new Set<number>());
    setPendingDot(null);
    setRevealed(false);
    setMistakes(0);
    setElapsed(0);
    setEnded(false);
    setWon(false);
    setFinalScore(0);
  }, []);

  const handleClear = useCallback(() => {
    if (metaRef.current.ended || edgesRef.current.size === 0) return;
    pendingRef.current = null;
    setPendingDot(null);
    commit(new Set<number>());
    playClearSound();
  }, [commit]);

  const handleReveal = useCallback(() => {
    const meta = metaRef.current;
    if (meta.ended) return;
    statsRef.current.revealed = true;
    setRevealed(true);
    const next = new Set(meta.solution);
    commit(next);
    playScoreSound();
    finish(next);
  }, [commit, finish]);

  const degreeList = useMemo(() => computeDegrees(size * size, edges), [size, edges]);
  const usedEdges = useMemo(
    () => Array.from(edges).map(key => ({ key, a: keyA(key), b: keyB(key) })),
    [edges],
  );
  const closedLoop = useMemo(() => isSingleClosedLoop(size, edges), [size, edges]);
  const skipList = useMemo(() => skippedDots(size, edges), [size, edges]);
  const circleStates = useMemo(() => {
    const map = new Map<number, CircleState>();
    for (let dot = 0; dot < size * size; dot++) {
      if (circles[dot] === 0) continue;
      map.set(dot, circleState(size, dot, circles[dot], edges, closedLoop));
    }
    return map;
  }, [size, circles, edges, closedLoop]);
  const violated = useMemo(() => {
    let count = 0;
    circleStates.forEach(state => {
      if (state === 'bad') count += 1;
    });
    return count;
  }, [circleStates]);

  const score = ended ? finalScore : computeScore(LEVELS[difficulty], elapsed, revealed, mistakes);
  const span = size + PAD * 2;
  const loopColor = revealed ? LOOP_COLOR_SOLVED : LOOP_COLOR;

  const controlClass =
    'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border theme-border theme-panel-soft theme-text transition active:translate-y-[2px] disabled:opacity-40 disabled:pointer-events-none';

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={() => restart(difficulty)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold theme-text"
            style={{ background: 'var(--game-status-bg)' }}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {formatTime(elapsed)}
          </span>
          {mistakes > 0 && (
            <span
              className="rounded-xl border px-2 py-1 text-xs font-bold text-rose-400"
              style={{ background: 'var(--game-status-bg)', borderColor: 'var(--border-color)' }}
            >
              Lỗi {mistakes}
            </span>
          )}
        </div>
      }
    >
      <div className="w-full max-w-[520px] mx-auto flex flex-col items-center gap-2 px-1">
        <div
          className="flex items-center gap-1 p-1 rounded-2xl border theme-border w-full"
          style={{ background: 'var(--surface-soft)' }}
        >
          {LEVEL_ORDER.map(level => {
            const config = LEVELS[level];
            const active = difficulty === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  playMoveSound();
                  restart(level);
                }}
                aria-label={`Độ khó ${config.label}, lưới ${config.size} nhân ${config.size}`}
                aria-pressed={active}
                className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-bold transition active:translate-y-[2px] ${
                  active ? 'text-white' : 'theme-muted'
                }`}
                style={active ? { background: '#4f46e5' } : undefined}
              >
                {config.label}
                <span className="ml-1 text-[10px] opacity-80">
                  {config.size}x{config.size}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="w-full rounded-3xl border p-2"
          style={{ background: 'var(--game-surface-bg)', borderColor: 'var(--game-surface-border)' }}
        >
          <div className="w-full" style={{ aspectRatio: '1 / 1' }}>
            <svg
              ref={svgRef}
              viewBox={`${-PAD} ${-PAD} ${span} ${span}`}
              className="w-full h-full select-none"
              style={{ display: 'block', touchAction: 'none' }}
              role="img"
              aria-label="Bàn Masyu"
            >
              {usedEdges.map(edge => (
                <line
                  key={edge.key}
                  x1={colOf(size, edge.a)}
                  y1={rowOf(size, edge.a)}
                  x2={colOf(size, edge.b)}
                  y2={rowOf(size, edge.b)}
                  stroke={loopColor}
                  strokeWidth={0.16}
                  strokeLinecap="round"
                />
              ))}
              {usedEdges.map(edge => (
                <line
                  key={`hit-${edge.key}`}
                  x1={colOf(size, edge.a)}
                  y1={rowOf(size, edge.a)}
                  x2={colOf(size, edge.b)}
                  y2={rowOf(size, edge.b)}
                  stroke="transparent"
                  strokeWidth={0.34}
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={event => {
                    event.preventDefault();
                    removeEdge(edge.key);
                  }}
                />
              ))}
              {Array.from({ length: size * size }, (_, dot) => {
                const x = colOf(size, dot);
                const y = rowOf(size, dot);
                const kind = circles[dot];
                const state = circleStates.get(dot) ?? 'pending';
                const bad = state === 'bad';
                const ring = bad ? DANGER_COLOR : state === 'ok' ? GOOD_COLOR : BLACK_FILL;
                const skipped = skipList.indexOf(dot) >= 0;
                return (
                  <g key={dot}>
                    <circle
                      cx={x}
                      cy={y}
                      r={0.06}
                      style={{ fill: degreeList[dot] > 2 ? DANGER_COLOR : 'var(--text-muted)' }}
                    />
                    {skipped && (
                      <circle cx={x} cy={y} r={0.15} fill="none" stroke={DANGER_COLOR} strokeWidth={0.05} />
                    )}
                    {kind === 1 && (
                      <circle cx={x} cy={y} r={0.2} style={{ fill: WHITE_FILL, stroke: ring }} strokeWidth={0.055} />
                    )}
                    {kind === 2 && (
                      <circle
                        cx={x}
                        cy={y}
                        r={0.185}
                        style={{ fill: BLACK_FILL, stroke: state === 'pending' ? 'none' : ring }}
                        strokeWidth={0.055}
                      />
                    )}
                    {pendingDot === dot && (
                      <circle cx={x} cy={y} r={0.3} fill="none" stroke={loopColor} strokeWidth={0.05} />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={0.32}
                      fill="transparent"
                      pointerEvents="all"
                      style={{ cursor: 'pointer' }}
                      onPointerDown={event => {
                        event.preventDefault();
                        if (metaRef.current.ended) return;
                        dragRef.current = { last: dot, moved: false };
                      }}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <p className="text-[11px] theme-muted text-center leading-snug px-1">
          Tròn trắng: đi thẳng qua và phải rẽ ở ít nhất một chấm kề. Tròn đen: rẽ tại chấm đó và đi thẳng ở cả hai chấm kề.
          Vẽ một vòng khép kín duy nhất, vòng không được đi xuyên qua một chấm trống.
        </p>

        <p className="text-xs font-bold theme-text text-center">
          {closedLoop ? 'Đã khép kín vòng' : `Đã vẽ ${edges.size} đoạn`}
          {violated > 0 ? ` · ${violated} chấm sai luật` : ''}
          {skipList.length > 0 ? ` · vòng đi qua ${skipList.length} chấm trống` : ''}
        </p>

        <div className="flex items-center justify-center gap-2 w-full">
          <button type="button" onClick={handleClear} disabled={ended || edges.size === 0} className={controlClass}>
            <Eraser className="w-3.5 h-3.5" />
            Xóa hết
          </button>
          <button
            type="button"
            onClick={handleReveal}
            disabled={ended || revealed}
            className={controlClass}
            aria-label={`Xem lời giải, trừ ${LEVELS[difficulty].revealPenalty} điểm`}
          >
            <Eye className="w-3.5 h-3.5" />
            Lời giải
          </button>
        </div>

        <p className="text-[11px] theme-muted text-center leading-snug px-1">
          Chạm một chấm rồi chạm chấm kề để bật/tắt đoạn, hoặc kéo để vẽ liên tục. Chạm vào đoạn đã vẽ để xóa.
        </p>
      </div>
    </GameShell>
  );
};