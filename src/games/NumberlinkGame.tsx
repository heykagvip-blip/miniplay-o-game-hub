import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Clock, Eraser, Flag, Lightbulb } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';
type Side = 'top' | 'bottom' | 'left' | 'right';
type PathMap = Record<number, number[]>;

interface LevelConfig {
  label: string;
  size: number;
  pairs: number;
  base: number;
  limit: number;
}

interface PipeCell {
  cell: number;
  num: number;
  arms: Side[];
  endpoint: boolean;
  solved: boolean;
}

const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: { label: 'Dễ', size: 5, pairs: 5, base: 500, limit: 120 },
  medium: { label: 'Trung bình', size: 6, pairs: 6, base: 800, limit: 240 },
  hard: { label: 'Khó', size: 7, pairs: 8, base: 1200, limit: 360 },
};

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

const MAX_HINTS = 2;
const HINT_PENALTY = 120;
const RESET_PENALTY = 25;
const SOLVE_BUDGET = 40000;
const DRAG_SOUND_MS = 40;

const PALETTE: { line: string; ink: string }[] = [
  { line: '#e11d48', ink: '#ffffff' },
  { line: '#2563eb', ink: '#ffffff' },
  { line: '#16a34a', ink: '#ffffff' },
  { line: '#f59e0b', ink: '#1f2937' },
  { line: '#9333ea', ink: '#ffffff' },
  { line: '#0d9488', ink: '#ffffff' },
  { line: '#db2777', ink: '#ffffff' },
  { line: '#84cc16', ink: '#1f2937' },
];

const colorOf = (num: number) => PALETTE[(((num - 1) % PALETTE.length) + PALETTE.length) % PALETTE.length];

const swap = (list: number[], i: number, j: number) => {
  const tmp = list[i];
  list[i] = list[j];
  list[j] = tmp;
};

const shuffledIndices = (length: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push(i);
  for (let i = out.length - 1; i > 0; i--) swap(out, i, Math.floor(Math.random() * (i + 1)));
  return out;
};

export const uniqueNumbers = (endpoints: number[]): number[] => {
  const seen: number[] = [];
  for (const value of endpoints) if (value > 0 && seen.indexOf(value) === -1) seen.push(value);
  return seen.sort((a, b) => a - b);
};

export const endpointsOf = (endpoints: number[], num: number): number[] => {
  const out: number[] = [];
  for (let cell = 0; cell < endpoints.length; cell++) if (endpoints[cell] === num) out.push(cell);
  return out;
};

export const isAdjacent = (size: number, a: number, b: number): boolean =>
  Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size)) === 1;

export const computeOwner = (size: number, endpoints: number[], paths: PathMap): Int32Array => {
  const owner = new Int32Array(size * size).fill(-1);
  for (let cell = 0; cell < endpoints.length; cell++) {
    const num = endpoints[cell];
    if (num > 0) owner[cell] = num;
  }
  const keys = Object.keys(paths);
  for (const key of keys) {
    const num = Number(key);
    const path = paths[num];
    if (!path) continue;
    for (const cell of path) if (owner[cell] === -1) owner[cell] = num;
  }
  return owner;
};

export const isNumberSolved = (endpoints: number[], num: number, path?: number[]): boolean => {
  if (!path || path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  if (first === last) return false;
  return endpoints[first] === num && endpoints[last] === num;
};

export const isValidPaths = (size: number, endpoints: number[], paths: PathMap): boolean => {
  const total = size * size;
  const owner = new Int32Array(total).fill(-1);
  const keys = Object.keys(paths);
  for (const key of keys) {
    const num = Number(key);
    const path = paths[num];
    if (!path || path.length < 2) continue;
    const pair = endpointsOf(endpoints, num);
    if (pair.length !== 2) return false;
    const first = path[0];
    const last = path[path.length - 1];
    if ((first !== pair[0] && first !== pair[1]) || (last !== pair[0] && last !== pair[1])) return false;
    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (cell < 0 || cell >= total) return false;
      if (owner[cell] !== -1) return false;
      owner[cell] = num;
      if (i > 0 && !isAdjacent(size, path[i - 1], cell)) return false;
      if (i < path.length - 1 && !isAdjacent(size, cell, path[i + 1])) return false;
    }
    if (!isNumberSolved(endpoints, num, path)) return false;
  }
  return true;
};

export const checkWin = (size: number, endpoints: number[], paths: PathMap): boolean => {
  const nums = uniqueNumbers(endpoints);
  if (nums.length === 0) return false;
  for (const num of nums) {
    const pair = endpointsOf(endpoints, num);
    if (pair.length !== 2) return false;
    if (!isNumberSolved(endpoints, num, paths[num])) return false;
  }
  const owner = computeOwner(size, endpoints, paths);
  for (let cell = 0; cell < size * size; cell++) if (owner[cell] === -1) return false;
  return true;
};

export const traceCells = (size: number, from: number, to: number): number[] => {
  if (to < 0) return [];
  if (from < 0 || from === to) return [to];
  const fromRow = Math.floor(from / size);
  const fromCol = from % size;
  const toRow = Math.floor(to / size);
  const toCol = to % size;
  const out: number[] = [];
  if (fromRow === toRow) {
    const step = toCol > fromCol ? 1 : -1;
    for (let col = fromCol + step; col !== toCol + step; col += step) {
      out.push(fromRow * size + col);
      if (out.length > size) break;
    }
    return out;
  }
  if (fromCol === toCol) {
    const step = toRow > fromRow ? 1 : -1;
    for (let row = fromRow + step; row !== toRow + step; row += step) {
      out.push(row * size + fromCol);
      if (out.length > size) break;
    }
    return out;
  }
  return [to];
};

export const grabPath = (paths: PathMap, num: number, cell: number): PathMap => {
  const path = paths[num];
  if (!path || path.length === 0) return { ...paths, [num]: [cell] };
  if (path[path.length - 1] === cell) return paths;
  if (path[0] === cell) return { ...paths, [num]: path.slice().reverse() };
  return paths;
};

export const extendPath = (
  size: number,
  endpoints: number[],
  paths: PathMap,
  num: number,
  cells: number[],
): PathMap => {
  const current = paths[num];
  if (!current || current.length === 0) return paths;
  const owner = computeOwner(size, endpoints, paths);
  let next = current;
  for (const cell of cells) {
    const tip = next[next.length - 1];
    if (cell === tip) continue;
    if (next.length >= 2 && cell === next[next.length - 2]) {
      next = next.slice(0, -1);
      continue;
    }
    if (!isAdjacent(size, tip, cell)) continue;
    if (next.indexOf(cell) !== -1) continue;
    const own = owner[cell];
    if (own !== -1 && own !== num) continue;
    next = [...next, cell];
  }
  if (next === current) return paths;
  return { ...paths, [num]: next };
};

export const clearPath = (paths: PathMap, num: number): PathMap => {
  const path = paths[num];
  if (!path || path.length === 0) return paths;
  const next = { ...paths };
  delete next[num];
  return next;
};

export const countDrawnPaths = (paths: PathMap): number => {
  const keys = Object.keys(paths);
  let drawn = 0;
  for (const key of keys) {
    const path = paths[Number(key)];
    if (path && path.length > 0) drawn++;
  }
  return drawn;
};

export const serpentine = (size: number): number[] => {
  const out: number[] = [];
  for (let row = 0; row < size; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < size; col++) out.push(row * size + col);
    } else {
      for (let col = size - 1; col >= 0; col--) out.push(row * size + col);
    }
  }
  return out;
};

const searchHamiltonian = (size: number, start: number, budget: number): number[] | null => {
  const total = size * size;
  const visited = new Uint8Array(total);
  const path: number[] = [];
  let steps = 0;
  const walk = (cell: number): boolean => {
    visited[cell] = 1;
    path.push(cell);
    if (path.length === total) return true;
    if (++steps > budget) {
      visited[cell] = 0;
      path.pop();
      return false;
    }
    const row = Math.floor(cell / size);
    const col = cell % size;
    const options: number[] = [];
    if (row > 0) options.push(cell - size);
    if (row < size - 1) options.push(cell + size);
    if (col > 0) options.push(cell - 1);
    if (col < size - 1) options.push(cell + 1);
    for (let i = options.length - 1; i > 0; i--) swap(options, i, Math.floor(Math.random() * (i + 1)));
    for (const next of options) {
      if (visited[next]) continue;
      if (walk(next)) return true;
    }
    visited[cell] = 0;
    path.pop();
    return false;
  };
  return walk(start) ? path : null;
};

export const hamiltonianPath = (size: number): number[] => {
  const total = size * size;
  const corners = [0, size - 1, size * (size - 1), total - 1];
  for (let attempt = 0; attempt < 8; attempt++) {
    const start = corners[Math.floor(Math.random() * corners.length)];
    const found = searchHamiltonian(size, start, 24000);
    if (found && found.length === total) return found;
  }
  return serpentine(size);
};

const pickCuts = (total: number, pairs: number): number[] => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const chosen = new Set<number>();
    while (chosen.size < pairs - 1) chosen.add(2 + Math.floor(Math.random() * (total - 3)));
    const sorted = Array.from(chosen).sort((a, b) => a - b);
    let prev = 0;
    let ok = true;
    for (const point of sorted) {
      if (point - prev < 2) {
        ok = false;
        break;
      }
      prev = point;
    }
    if (ok && total - prev >= 2) return sorted;
  }
  const step = Math.max(2, Math.floor(total / pairs));
  const out: number[] = [];
  for (let i = 1; i < pairs; i++) out.push(i * step);
  return out;
};

const buildEndpoints = (path: number[], cuts: number[]): number[] => {
  const segments: number[][] = [];
  let start = 0;
  for (const cut of cuts) {
    segments.push(path.slice(start, cut));
    start = cut;
  }
  segments.push(path.slice(start, path.length));
  const labels = shuffledIndices(segments.length);
  const endpoints = new Array(path.length).fill(0);
  segments.forEach((segment, index) => {
    const num = labels[index] + 1;
    endpoints[segment[0]] = num;
    endpoints[segment[segment.length - 1]] = num;
  });
  return endpoints;
};

export const isValidEndpoints = (endpoints: number[], pairs: number): boolean => {
  if (endpoints.length === 0) return false;
  const nums = uniqueNumbers(endpoints);
  if (nums.length !== pairs) return false;
  for (const num of nums) if (endpointsOf(endpoints, num).length !== 2) return false;
  return true;
};

export const generatePuzzle = (size: number, pairs: number): number[] => {
  const total = size * size;
  for (let attempt = 0; attempt < 40; attempt++) {
    const path = hamiltonianPath(size);
    if (path.length !== total) continue;
    const endpoints = buildEndpoints(path, pickCuts(total, pairs));
    if (isValidEndpoints(endpoints, pairs)) return endpoints;
  }
  return buildEndpoints(serpentine(size), pickCuts(total, pairs));
};

const manhattan = (size: number, a: number, b: number): number =>
  Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));

export const findAnyPath = (size: number, endpoints: number[], num: number): number[] | null => {
  const pair = endpointsOf(endpoints, num);
  if (pair.length !== 2) return null;
  const total = size * size;
  const blocked = new Uint8Array(total);
  for (const other of uniqueNumbers(endpoints)) {
    if (other === num) continue;
    for (const cell of endpointsOf(endpoints, other)) blocked[cell] = 1;
  }
  const start = pair[0];
  const goal = pair[1];
  const visited = new Uint8Array(total);
  const path: number[] = [start];
  visited[start] = 1;
  let steps = 0;
  const walk = (cell: number): boolean => {
    if (++steps > 60000) return false;
    if (cell === goal) return true;
    const row = Math.floor(cell / size);
    const col = cell % size;
    const options: number[] = [];
    if (row > 0) options.push(cell - size);
    if (row < size - 1) options.push(cell + size);
    if (col > 0) options.push(cell - 1);
    if (col < size - 1) options.push(cell + 1);
    for (let i = options.length - 1; i > 0; i--) swap(options, i, Math.floor(Math.random() * (i + 1)));
    for (const next of options) {
      if (visited[next]) continue;
      if (blocked[next]) continue;
      visited[next] = 1;
      path.push(next);
      if (walk(next)) return true;
      path.pop();
      visited[next] = 0;
    }
    return false;
  };
  return walk(start) ? path : null;
};

export const solveBoard = (size: number, endpoints: number[], budget: number): PathMap | null => {
  const total = size * size;
  const nums = uniqueNumbers(endpoints);
  const pairs = new Map<number, number[]>();
  for (const num of nums) {
    const pair = endpointsOf(endpoints, num);
    if (pair.length !== 2) return null;
    pairs.set(num, pair);
  }
  const used = new Uint8Array(total);
  for (const num of nums) for (const cell of pairs.get(num)!) used[cell] = 1;

  const reachable = (from: number, to: number): boolean => {
    if (from === to) return true;
    const seen = new Uint8Array(total);
    const queue: number[] = [from];
    seen[from] = 1;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      const row = Math.floor(cell / size);
      const col = cell % size;
      const options: number[] = [];
      if (row > 0) options.push(cell - size);
      if (row < size - 1) options.push(cell + size);
      if (col > 0) options.push(cell - 1);
      if (col < size - 1) options.push(cell + 1);
      for (const next of options) {
        if (seen[next]) continue;
        if (used[next] && next !== to) continue;
        if (next === to) return true;
        seen[next] = 1;
        queue.push(next);
      }
    }
    return false;
  };

  const counter = { nodes: 0 };
  const result: PathMap = {};
  let exhausted = false;

  const enumeratePaths = (num: number, cap: number): number[][] => {
    const found: number[][] = [];
    const start = pairs.get(num)![0];
    const goal = pairs.get(num)![1];
    const visited = new Uint8Array(total);
    const path: number[] = [start];
    visited[start] = 1;
    const walk = (cell: number): void => {
      if (found.length >= cap || exhausted) return;
      if (counter.nodes++ > budget) {
        exhausted = true;
        return;
      }
      if (cell === goal) {
        found.push(path.slice());
        return;
      }
      const row = Math.floor(cell / size);
      const col = cell % size;
      const options: number[] = [];
      if (row > 0) options.push(cell - size);
      if (row < size - 1) options.push(cell + size);
      if (col > 0) options.push(cell - 1);
      if (col < size - 1) options.push(cell + 1);
      for (let i = options.length - 1; i > 0; i--) swap(options, i, Math.floor(Math.random() * (i + 1)));
      for (const next of options) {
        if (visited[next]) continue;
        if (used[next] && next !== goal) continue;
        visited[next] = 1;
        path.push(next);
        walk(next);
        path.pop();
        visited[next] = 0;
        if (found.length >= cap || exhausted) return;
      }
    };
    walk(start);
    return found;
  };

  const assign = (remaining: number[]): boolean => {
    if (exhausted) return false;
    if (remaining.length === 0) {
      for (let cell = 0; cell < total; cell++) if (!used[cell]) return false;
      return true;
    }
    let chosenIndex = 0;
    let chosenDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const pair = pairs.get(remaining[i])!;
      const distance = manhattan(size, pair[0], pair[1]);
      if (distance < chosenDistance) {
        chosenDistance = distance;
        chosenIndex = i;
      }
    }
    const num = remaining[chosenIndex];
    const rest = remaining.filter((_, index) => index !== chosenIndex);
    let needed = chosenDistance + 1;
    for (const other of rest) {
      const pair = pairs.get(other)!;
      needed += manhattan(size, pair[0], pair[1]) + 1;
    }
    let freeCells = 0;
    for (let cell = 0; cell < total; cell++) if (!used[cell]) freeCells++;
    if (freeCells < needed) return false;
    const candidates = enumeratePaths(num, 400);
    for (const candidate of candidates) {
      for (const cell of candidate) used[cell] = 1;
      let feasible = true;
      for (const other of rest) {
        const pair = pairs.get(other)!;
        if (!reachable(pair[0], pair[1])) {
          feasible = false;
          break;
        }
      }
      if (feasible && assign(rest)) {
        result[num] = candidate;
        return true;
      }
      for (const cell of candidate) used[cell] = 0;
      if (exhausted) return false;
    }
    return false;
  };

  if (!assign(nums.slice())) return null;
  return result;
};

export const computeScore = (
  difficulty: Difficulty,
  resets: number,
  hintsUsed: number,
  elapsed: number,
): number => {
  const config = LEVELS[difficulty];
  const timeBonus = Math.max(0, Math.round((config.limit - elapsed) * 3));
  const penalty = resets * RESET_PENALTY + hintsUsed * HINT_PENALTY;
  return Math.max(100, config.base + timeBonus - penalty);
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const armStyle = (side: Side, line: string): React.CSSProperties => {
  if (side === 'top') return { position: 'absolute', top: 0, left: '32%', width: '36%', height: '50%', background: line };
  if (side === 'bottom') return { position: 'absolute', bottom: 0, left: '32%', width: '36%', height: '50%', background: line };
  if (side === 'left') return { position: 'absolute', left: 0, top: '32%', height: '36%', width: '50%', background: line };
  return { position: 'absolute', right: 0, top: '32%', height: '36%', width: '50%', background: line };
};

const sideFor = (size: number, from: number, to: number): Side => {
  const rowDelta = Math.floor(to / size) - Math.floor(from / size);
  if (rowDelta < 0) return 'top';
  if (rowDelta > 0) return 'bottom';
  return (to % size) < (from % size) ? 'left' : 'right';
};

export const NumberlinkGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('numberlink')!;

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [size, setSize] = useState(LEVELS.medium.size);
  const [endpoints, setEndpoints] = useState<number[]>(() => generatePuzzle(LEVELS.medium.size, LEVELS.medium.pairs));
  const [paths, setPaths] = useState<PathMap>({});
  const [resets, setResets] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pathsRef = useRef<PathMap>({});
  const dragRef = useRef<{ num: number; start: number; over: number } | null>(null);
  const solutionRef = useRef<PathMap | null | undefined>(undefined);
  const lastSoundRef = useRef(0);
  const metaRef = useRef({ size, endpoints, difficulty, elapsed, resets, hintsUsed, ended, hintsLeft });
  metaRef.current = { size, endpoints, difficulty, elapsed, resets, hintsUsed, ended, hintsLeft };

  const numbers = useMemo(() => uniqueNumbers(endpoints), [endpoints]);
  const solvedFlags = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (const num of numbers) map[num] = isNumberSolved(endpoints, num, paths[num]);
    return map;
  }, [endpoints, numbers, paths]);
  const coveredCells = useMemo(() => {
    let covered = 0;
    const owner = computeOwner(size, endpoints, paths);
    for (let cell = 0; cell < size * size; cell++) if (owner[cell] !== -1) covered++;
    return covered;
  }, [size, endpoints, paths]);
  const solvedCount = useMemo(() => numbers.filter(num => solvedFlags[num]).length, [numbers, solvedFlags]);
  const drawnCount = useMemo(() => countDrawnPaths(paths), [paths]);
  const pipeCells = useMemo(() => {
    const map = new Map<number, PipeCell>();
    for (const num of numbers) {
      const path = paths[num];
      if (!path || path.length < 2) continue;
      for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        const arms: Side[] = [];
        if (i > 0) arms.push(sideFor(size, cell, path[i - 1]));
        if (i < path.length - 1) arms.push(sideFor(size, cell, path[i + 1]));
        map.set(cell, { cell, num, arms, endpoint: i === 0 || i === path.length - 1, solved: !!solvedFlags[num] });
      }
    }
    return map;
  }, [numbers, paths, size, solvedFlags]);
  const score = ended ? finalScore : computeScore(difficulty, resets, hintsUsed, elapsed);

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [ended]);

  const commit = useCallback((next: PathMap) => {
    pathsRef.current = next;
    setPaths(next);
  }, []);

  const finish = useCallback((finalPaths: PathMap) => {
    const meta = metaRef.current;
    if (meta.ended) return;
    if (!checkWin(meta.size, meta.endpoints, finalPaths)) return;
    setWon(true);
    setEnded(true);
    setFinalScore(computeScore(meta.difficulty, meta.resets, meta.hintsUsed, meta.elapsed));
    playClearSound();
    triggerHaptic(60);
  }, []);

  const cellFromPoint = useCallback((clientX: number, clientY: number): number => {
    const grid = gridRef.current;
    if (!grid) return -1;
    const rect = grid.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;
    const meta = metaRef.current;
    const col = Math.floor((clientX - rect.left) / (rect.width / meta.size));
    const row = Math.floor((clientY - rect.top) / (rect.height / meta.size));
    if (row < 0 || col < 0 || row >= meta.size || col >= meta.size) return -1;
    return row * meta.size + col;
  }, []);

  const enterCell = useCallback(
    (target: number) => {
      const drag = dragRef.current;
      if (!drag || metaRef.current.ended) return;
      if (target < 0 || target === drag.over) return;
      drag.over = target;
      const meta = metaRef.current;
      const path = pathsRef.current[drag.num] ?? [];
      const tip = path.length > 0 ? path[path.length - 1] : drag.start;
      const cells = traceCells(meta.size, tip, target);
      const next = extendPath(meta.size, meta.endpoints, pathsRef.current, drag.num, cells);
      if (next === pathsRef.current) return;
      commit(next);
      const now = Date.now();
      if (now - lastSoundRef.current > DRAG_SOUND_MS) {
        lastSoundRef.current = now;
        playMoveSound();
      }
      if (isNumberSolved(meta.endpoints, drag.num, next[drag.num])) {
        playScoreSound();
        triggerHaptic(20);
      }
      if (checkWin(meta.size, meta.endpoints, next)) finish(next);
    },
    [commit, finish],
  );

  const handlePointerDown = useCallback(
    (cell: number) => {
      const meta = metaRef.current;
      if (meta.ended || dragRef.current) return;
      const num = meta.endpoints[cell];
      if (!num || num <= 0) return;
      dragRef.current = { num, start: cell, over: cell };
      commit(grabPath(pathsRef.current, num, cell));
      playMoveSound();
      triggerHaptic(12);
    },
    [commit],
  );

  const releaseDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const target = cellFromPoint(clientX, clientY);
      if (target >= 0) enterCell(target);
      dragRef.current = null;
      const path = pathsRef.current[drag.num] ?? [];
      if (path.length === 0) return;
      const droppedOutside = target < 0;
      const tappedWithPath = target === drag.start && path.length >= 3;
      if (droppedOutside || tappedWithPath) {
        commit(clearPath(pathsRef.current, drag.num));
        setResets(value => value + 1);
        playClearSound();
        triggerHaptic(18);
      }
    },
    [cellFromPoint, commit, enterCell],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => enterCell(cellFromPoint(event.clientX, event.clientY));
    const up = (event: PointerEvent) => releaseDrag(event.clientX, event.clientY);
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
  }, [cellFromPoint, enterCell, releaseDrag]);

  const restart = useCallback((next: Difficulty) => {
    const config = LEVELS[next];
    dragRef.current = null;
    solutionRef.current = undefined;
    pathsRef.current = {};
    setDifficulty(next);
    setSize(config.size);
    setEndpoints(generatePuzzle(config.size, config.pairs));
    setPaths({});
    setResets(0);
    setHintsUsed(0);
    setHintsLeft(MAX_HINTS);
    setElapsed(0);
    setEnded(false);
    setWon(false);
    setFinalScore(0);
  }, []);

  const handleClearAll = useCallback(() => {
    if (metaRef.current.ended) return;
    const drawn = countDrawnPaths(pathsRef.current);
    if (drawn === 0) return;
    commit({});
    setResets(value => value + drawn);
    playClearSound();
    triggerHaptic(25);
  }, [commit]);

  const handleHint = useCallback(() => {
    const meta = metaRef.current;
    if (meta.ended || meta.hintsLeft <= 0) return;
    const unsolved = uniqueNumbers(meta.endpoints).filter(
      num => !isNumberSolved(meta.endpoints, num, pathsRef.current[num]),
    );
    if (unsolved.length === 0) return;
    const target = unsolved[Math.floor(Math.random() * unsolved.length)];
    if (solutionRef.current === undefined) {
      solutionRef.current = solveBoard(meta.size, meta.endpoints, SOLVE_BUDGET);
    }
    const solution = solutionRef.current;
    let hint = solution ? solution[target] : undefined;
    if (!hint) hint = findAnyPath(meta.size, meta.endpoints, target) ?? undefined;
    if (!hint || hint.length < 2) return;
    const covered = new Set(hint);
    let next = pathsRef.current;
    for (const num of uniqueNumbers(meta.endpoints)) {
      if (num === target) continue;
      const path = next[num];
      if (path && path.some(cell => covered.has(cell))) next = clearPath(next, num);
    }
    next = { ...next, [target]: hint };
    commit(next);
    setHintsLeft(value => value - 1);
    setHintsUsed(value => value + 1);
    playScoreSound();
    triggerHaptic(30);
    if (checkWin(meta.size, meta.endpoints, next)) finish(next);
  }, [commit, finish]);

  const handleGiveUp = useCallback(() => {
    if (metaRef.current.ended) return;
    dragRef.current = null;
    setWon(false);
    setEnded(true);
    setFinalScore(0);
  }, []);

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
          <span
            className="flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold theme-text"
            style={{ background: 'var(--game-status-bg)' }}
          >
            <Eraser className="w-3.5 h-3.5 text-rose-400" />
            {resets}
          </span>
          <span
            className="flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold theme-text"
            style={{ background: 'var(--game-status-bg)' }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            {hintsLeft}
          </span>
        </div>
      }
    >
      <div className="w-full max-w-[430px] mx-auto flex flex-col items-center gap-2 px-1">
        <div
          className="flex items-center gap-1 p-1 rounded-2xl border theme-border w-full"
          style={{ background: 'var(--surface-soft)' }}
        >
          {DIFFICULTY_ORDER.map(level => {
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
                aria-label={`Độ khó ${config.label}, bàn ${config.size} nhân ${config.size}`}
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
          className="w-full rounded-3xl border p-1.5"
          style={{ background: 'var(--game-surface-bg)', borderColor: 'var(--game-surface-border)' }}
        >
          <div
            ref={gridRef}
            role="grid"
            aria-label="Bàn Numberlink"
            className="grid w-full game-touch-zone select-none"
            style={{
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              gridAutoRows: '1fr',
              aspectRatio: '1 / 1',
              touchAction: 'none',
            }}
            onPointerUp={event => releaseDrag(event.clientX, event.clientY)}
          >
            {Array.from({ length: size * size }, (_, cell) => {
              const num = endpoints[cell] ?? 0;
              const pipe = pipeCells.get(cell);
              const pipeColor = pipe ? colorOf(pipe.num).line : '';
              return (
                <div
                  key={cell}
                  role="gridcell"
                  aria-label={`Hàng ${Math.floor(cell / size) + 1}, cột ${(cell % size) + 1}${num > 0 ? `, số ${num}` : ''}`}
                  className="relative game-touch-zone"
                  style={{
                    background: 'var(--game-control-bg)',
                    border: '1px solid var(--game-control-border)',
                    touchAction: 'none',
                  }}
                  onPointerDown={event => {
                    event.preventDefault();
                    handlePointerDown(cell);
                  }}
                  onPointerEnter={() => enterCell(cell)}
                >
                  {pipe && !pipe.endpoint && (
                    <div className="absolute" style={{ inset: '-1px', opacity: pipe.solved ? 0.5 : 1 }}>
                      <div className="absolute" style={{ inset: '32%', background: pipeColor, borderRadius: '34%' }} />
                      {pipe.arms.map(side => (
                        <div key={side} style={armStyle(side, pipeColor)} />
                      ))}
                    </div>
                  )}
                  {num > 0 && (
                    <div
                      className="absolute flex items-center justify-center font-black"
                      style={{
                        inset: '14%',
                        background: colorOf(num).line,
                        color: colorOf(num).ink,
                        borderRadius: '26%',
                        opacity: solvedFlags[num] ? 0.55 : 1,
                        outline: solvedFlags[num] ? `2px solid ${colorOf(num).line}` : 'none',
                        outlineOffset: '-3px',
                        fontSize: 'clamp(10px, 3.2vw, 17px)',
                        lineHeight: 1,
                        zIndex: 2,
                      }}
                    >
                      {num}
                      {solvedFlags[num] && (
                        <span
                          className="absolute flex items-center justify-center font-black"
                          style={{
                            top: '-8%',
                            right: '-8%',
                            width: '38%',
                            height: '38%',
                            borderRadius: '50%',
                            background: '#0f172a',
                            color: '#4ade80',
                            fontSize: '8px',
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {numbers.map(num => (
            <span
              key={num}
              className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-bold"
              style={{
                background: solvedFlags[num] ? 'transparent' : 'var(--surface-soft)',
                borderColor: colorOf(num).line,
                color: solvedFlags[num] ? colorOf(num).line : 'var(--text-primary)',
              }}
            >
              {num}
              {solvedFlags[num] ? ' ✓' : ''}
            </span>
          ))}
        </div>

        <p className="text-[11px] theme-muted text-center leading-snug px-2">
          Kéo từ ô số để vẽ đường. Kéo ngược lại để lùi. Thả ra ngoài bàn để xóa đường đó.
        </p>

        <p className="text-xs font-bold theme-text text-center">
          Đã nối {solvedCount}/{numbers.length} số · phủ {coveredCells}/{size * size} ô
        </p>

        <div className="flex items-center justify-center gap-2 w-full">
          <button
            type="button"
            onClick={handleHint}
            disabled={hintsLeft <= 0 || ended || solvedCount === numbers.length}
            aria-label={`Gợi ý, còn ${hintsLeft} lượt, trừ ${HINT_PENALTY} điểm`}
            className={controlClass}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Gợi ý ({hintsLeft})
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={drawnCount === 0 || ended}
            aria-label="Xóa toàn bộ đường đã vẽ"
            className={controlClass}
          >
            <Eraser className="w-3.5 h-3.5" />
            Xóa số
          </button>
          <button
            type="button"
            onClick={handleGiveUp}
            disabled={ended}
            aria-label="Bỏ cuộc và kết thúc ván chơi"
            className={controlClass}
          >
            <Flag className="w-3.5 h-3.5" />
            Bỏ cuộc
          </button>
        </div>
      </div>
    </GameShell>
  );
};