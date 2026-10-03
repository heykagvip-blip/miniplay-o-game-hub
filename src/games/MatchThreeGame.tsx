import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playBounceSound,
  playClearSound,
  playMoveSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';
import {
  createParticleSystem,
  createShake,
  drawVignette,
  isLightTheme,
  linearGradient,
  radialGradient,
  roundRectPath,
} from '../utils/gameArt';
import { Gem, Layers, Sparkles, Zap } from 'lucide-react';

const COLS = 8;
const ROWS = 8;
const CELL = 60;
const W = COLS * CELL;
const H = ROWS * CELL;

const START_TYPES = 5;
const MAX_TYPES = 6;
const MOVES_PER_LEVEL = 25;
const MOVE_BONUS_PER_LEVEL = 5;
const FINAL_LEVEL = 10;
const LOW_MOVES = 5;
const GEM_POINTS = 30;
const GROUP_BONUS_STEP = 60;

const SWAP_TIME = 0.15;
const REVERT_TIME = 0.18;
const SHUFFLE_TIME = 0.6;
const LEVEL_TIME = 1.05;

const DEFAULT_HINT = 'Chạm một viên ngọc rồi chạm viên cạnh để hoán đổi';

interface Cell {
  r: number;
  c: number;
}

type Phase = 'idle' | 'swap' | 'revert' | 'clear' | 'fall' | 'shuffle' | 'level' | 'over';

interface MatchGroup {
  cells: Cell[];
}

interface SwapAnim {
  a: Cell;
  b: Cell;
  dr: number;
  dc: number;
}

interface FloatLabel {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Game {
  grid: number[][];
  offY: number[][];
  types: number;
  moves: number;
  level: number;
  combo: number;
  phase: Phase;
  t: number;
  sel: Cell | null;
  cursor: Cell;
  swap: SwapAnim | null;
  clearing: boolean[][];
  groups: MatchGroup[];
  labels: FloatLabel[];
}

interface GemStyle {
  name: string;
  light: string;
  mid: string;
  dark: string;
  ink: string;
  hue: number;
}

const GEM_STYLES: GemStyle[] = [
  { name: 'Hồng', light: '#fde7f3', mid: '#f472b6', dark: '#9d174d', ink: '#4a0416', hue: 330 },
  { name: 'Cam', light: '#ffedd5', mid: '#fb923c', dark: '#9a3412', ink: '#431407', hue: 26 },
  { name: 'Vàng', light: '#fef9c3', mid: '#facc15', dark: '#a16207', ink: '#422006', hue: 48 },
  { name: 'Ngọc lục', light: '#dcfce7', mid: '#4ade80', dark: '#15803d', ink: '#052e16', hue: 142 },
  { name: 'Lam', light: '#dbeafe', mid: '#60a5fa', dark: '#1d4ed8', ink: '#172554', hue: 214 },
  { name: 'Tím', light: '#ede9fe', mid: '#c084fc', dark: '#7e22ce', ink: '#3b0764', hue: 282 },
];

const cellX = (c: number): number => c * CELL + CELL / 2;
const cellY = (r: number): number => r * CELL + CELL / 2;
const inBounds = (p: Cell): boolean => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS;
const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const easeInOut = (v: number): number => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);
const clearDuration = (level: number): number => Math.max(0.1, 0.26 - (level - 1) * 0.03);
const fallDuration = (level: number): number => Math.max(0.11, 0.24 - (level - 1) * 0.02);

const makeMask = (): boolean[][] =>
  Array.from({ length: ROWS }, () => new Array<boolean>(COLS).fill(false));

/** Fills a board without any pre-made run of three. */
const makeGrid = (types: number): number[][] => {
  const grid: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const banned = new Set<number>();
      if (c >= 2 && row[c - 1] === row[c - 2]) banned.add(row[c - 1]);
      if (r >= 2 && grid[r - 1][c] === grid[r - 2][c]) banned.add(grid[r - 1][c]);
      let t = Math.floor(Math.random() * types);
      let guard = 0;
      while (banned.has(t) && guard++ < 20) t = Math.floor(Math.random() * types);
      row.push(t);
    }
    grid.push(row);
  }
  return grid;
};

const findMatches = (grid: number[][]): MatchGroup[] => {
  const groups: MatchGroup[] = [];
  for (let r = 0; r < ROWS; r++) {
    let start = 0;
    for (let c = 1; c <= COLS; c++) {
      const same = c < COLS && grid[r][c] >= 0 && grid[r][c] === grid[r][start];
      if (same) continue;
      if (c - start >= 3) {
        const cells: Cell[] = [];
        for (let k = start; k < c; k++) cells.push({ r, c: k });
        groups.push({ cells });
      }
      start = c;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let start = 0;
    for (let r = 1; r <= ROWS; r++) {
      const same = r < ROWS && grid[r][c] >= 0 && grid[r][c] === grid[start][c];
      if (same) continue;
      if (r - start >= 3) {
        const cells: Cell[] = [];
        for (let k = start; k < r; k++) cells.push({ r: k, c });
        groups.push({ cells });
      }
      start = r;
    }
  }
  return groups;
};

/** Folds runs that touch (L, T and cross shapes) into one group so cells are never scored twice. */
const mergeGroups = (groups: MatchGroup[]): MatchGroup[] => {
  if (groups.length <= 1) return groups;
  const owner = new Map<number, number>();
  groups.forEach((grp, gi) => grp.cells.forEach((p) => owner.set(p.r * COLS + p.c, gi)));
  const parent = groups.map((_, i) => i);
  const root = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    let c = i;
    while (parent[c] !== c) {
      const next = parent[c];
      parent[c] = r;
      c = next;
    }
    return r;
  };
  groups.forEach((grp, gi) => {
    grp.cells.forEach((p) => {
      const neighbours: Cell[] = [
        { r: p.r - 1, c: p.c },
        { r: p.r + 1, c: p.c },
        { r: p.r, c: p.c - 1 },
        { r: p.r, c: p.c + 1 },
      ];
      neighbours.forEach((n) => {
        if (!inBounds(n)) return;
        const gj = owner.get(n.r * COLS + n.c);
        if (gj === undefined) return;
        const a = root(gi);
        const b = root(gj);
        if (a !== b) parent[b] = a;
      });
    });
  });
  const merged = new Map<number, Set<number>>();
  groups.forEach((grp, gi) => {
    const key = root(gi);
    const set = merged.get(key) ?? new Set<number>();
    grp.cells.forEach((p) => set.add(p.r * COLS + p.c));
    merged.set(key, set);
  });
  return [...merged.values()].map((cells) => ({
    cells: [...cells].map((k) => ({ r: Math.floor(k / COLS), c: k % COLS })),
  }));
};

const hasMove = (grid: number[][]): boolean => {
  const test = grid.map((row) => [...row]);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const partners: Cell[] = [
        { r, c: c + 1 },
        { r: r + 1, c },
      ];
      for (const p of partners) {
        if (!inBounds(p)) continue;
        const a = test[r][c];
        const b = test[p.r][p.c];
        test[r][c] = b;
        test[p.r][p.c] = a;
        const found = findMatches(test).length > 0;
        test[r][c] = a;
        test[p.r][p.c] = b;
        if (found) return true;
      }
    }
  }
  return false;
};

const reshuffleGrid = (grid: number[][], types: number): number[][] => {
  const flat: number[] = [];
  grid.forEach((row) => row.forEach((t) => flat.push(t)));
  for (let attempt = 0; attempt < 40; attempt++) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = flat[i];
      flat[i] = flat[j];
      flat[j] = tmp;
    }
    const next: number[][] = [];
    for (let r = 0; r < ROWS; r++) next.push(flat.slice(r * COLS, r * COLS + COLS));
    if (findMatches(next).length === 0 && hasMove(next)) return next;
  }
  let fallback = makeGrid(types);
  for (let guard = 0; guard < 40 && !hasMove(fallback); guard += 1) {
    fallback = makeGrid(types);
  }
  return fallback;
};

/** Compacts every column downward and records how far each gem has to travel. */
const collapse = (g: Game): void => {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    let lastDist = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      const type = g.grid[r][c];
      if (type < 0) continue;
      const dist = r - write;
      g.grid[write][c] = type;
      g.offY[write][c] = dist > 0 ? -dist * CELL : 0;
      lastDist = dist > 0 ? dist : lastDist;
      write -= 1;
    }
    while (write >= 0) {
      const dist = lastDist + 1;
      let type = Math.floor(Math.random() * g.types);
      if (g.grid[write + 1] && g.grid[write + 1][c] === type && type === (g.grid[write + 2] ? g.grid[write + 2][c] : -1)) {
        type = (type + 1) % g.types;
      }
      g.grid[write][c] = type;
      g.offY[write][c] = -dist * CELL;
      lastDist = dist;
      write -= 1;
    }
  }
};

const makeGame = (): Game => {
  let grid = makeGrid(START_TYPES);
  let guard = 0;
  while (!hasMove(grid) && guard++ < 30) grid = makeGrid(START_TYPES);
  return {
    grid,
    offY: Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0)),
    types: START_TYPES,
    moves: MOVES_PER_LEVEL,
    level: 1,
    combo: 0,
    phase: 'idle',
    t: 0,
    sel: null,
    cursor: { r: 4, c: 4 },
    swap: null,
    clearing: makeMask(),
    groups: [],
    labels: [],
  };
};

const gemPath = (ctx: CanvasRenderingContext2D, type: number, r: number): void => {
  ctx.beginPath();
  if (type === 0) {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.84, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.84, 0);
    ctx.closePath();
  } else if (type === 1) {
    roundRectPath(ctx, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, r * 0.34);
  } else if (type === 2) {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (type === 3) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.44;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (type === 4) {
    ctx.moveTo(0, -r * 0.98);
    ctx.bezierCurveTo(r * 0.94, -r * 0.34, r * 0.8, r * 0.76, 0, r * 0.96);
    ctx.bezierCurveTo(-r * 0.8, r * 0.76, -r * 0.94, -r * 0.34, 0, -r * 0.98);
    ctx.closePath();
  } else {
    ctx.ellipse(0, 0, r * 0.78, r * 0.98, 0, 0, Math.PI * 2);
  }
};

/** Các đường cắt (facet) từ tâm ra mép để viên ngọc trông như đá quý thật. */
const FACET_ANGLES = [0, 1, 2, 3, 4, 5].map((i) => -Math.PI / 2 + (i * Math.PI) / 3);

const drawGem = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  type: number,
  radius: number,
  alpha: number,
  spin: number
): void => {
  if (radius <= 0.6 || alpha <= 0.02) return;
  const style = GEM_STYLES[type];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(spin);

  // bóng đổ dưới viên
  ctx.fillStyle = 'rgba(4, 2, 12, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.56, radius * 0.68, radius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // thân viên ngọc: gradient nhiều lớp cho sắc độ sâu
  gemPath(ctx, type, radius);
  ctx.fillStyle = radialGradient(ctx, -radius * 0.34, -radius * 0.42, radius * 0.1, 0, 0, radius * 1.12, [
    [0, style.light],
    [0.4, style.mid],
    [0.82, style.dark],
    [1, style.ink],
  ]);
  ctx.fill();

  ctx.save();
  ctx.clip();

  // MẶT BÀN bên trong: thu nhỏ chính hình dạng đã vẽ -> tạo cảm giác đá được mài
  ctx.save();
  ctx.scale(0.5, 0.5);
  gemPath(ctx, type, radius);
  ctx.restore();
  ctx.fillStyle = radialGradient(ctx, -radius * 0.18, -radius * 0.22, radius * 0.04, 0, 0, radius * 0.64, [
    [0, 'rgba(255,255,255,0.7)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fill();

  // các đường cắt facet chạy từ tâm mặt bàn ra mép viên
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = Math.max(0.6, radius * 0.05);
  ctx.beginPath();
  FACET_ANGLES.forEach((a) => {
    ctx.moveTo(Math.cos(a) * radius * 0.46, Math.sin(a) * radius * 0.46);
    ctx.lineTo(Math.cos(a) * radius * 1.05, Math.sin(a) * radius * 1.05);
  });
  ctx.stroke();

  // ánh sáng viền ở góc phải-dưới (rim light)
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = radius * 0.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.94, Math.PI * 0.08, Math.PI * 0.58);
  ctx.stroke();
  ctx.restore();

  // đường viền ngoài
  gemPath(ctx, type, radius);
  ctx.strokeStyle = style.ink;
  ctx.lineWidth = Math.max(1, radius * 0.075);
  ctx.stroke();

  // điểm sáng bên trong viên
  ctx.save();
  gemPath(ctx, type, radius);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.3, -radius * 0.46, radius * 0.3, radius * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(radius * 0.26, radius * 0.4, radius * 0.22, radius * 0.1, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // tia lấp lánh 4 cánh
  const sx = radius * 0.34;
  const sy = -radius * 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(sx, sy - radius * 0.3);
  ctx.quadraticCurveTo(sx + radius * 0.05, sy - radius * 0.05, sx + radius * 0.3, sy);
  ctx.quadraticCurveTo(sx + radius * 0.05, sy + radius * 0.05, sx, sy + radius * 0.3);
  ctx.quadraticCurveTo(sx - radius * 0.05, sy + radius * 0.05, sx - radius * 0.3, sy);
  ctx.quadraticCurveTo(sx - radius * 0.05, sy - radius * 0.05, sx, sy - radius * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

const drawBoard = (ctx: CanvasRenderingContext2D): void => {
  const light = isLightTheme();
  roundRectPath(ctx, 8, 8, W - 16, H - 16, 26);
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, H,
    light
      ? [[0, '#f5faff'], [1, '#d6e8fb']]
      : [[0, '#2b1e3c'], [1, '#160f22']]
  );
  ctx.fill();
  ctx.strokeStyle = light ? 'rgba(61, 154, 233, 0.5)' : 'rgba(181, 150, 217, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      roundRectPath(ctx, c * CELL + 5, r * CELL + 5, CELL - 10, CELL - 10, 14);
      const even = (r + c) % 2 === 0;
      ctx.fillStyle = even
        ? light
          ? 'rgba(255, 255, 255, 0.66)'
          : 'rgba(10, 5, 22, 0.38)'
        : light
          ? 'rgba(120, 165, 210, 0.16)'
          : 'rgba(255, 255, 255, 0.045)';
      ctx.fill();
    }
  }
};

const drawLabels = (ctx: CanvasRenderingContext2D, labels: FloatLabel[]): void => {
  labels.forEach((l) => {
    const k = l.life / l.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.8);
    ctx.font = `900 ${l.size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(8, 4, 20, 0.75)';
    ctx.strokeText(l.text, l.x, l.y - (1 - k) * 32);
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, l.x, l.y - (1 - k) * 32);
    ctx.restore();
  });
};

export const MatchThreeGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('match-three')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const fxRef = useRef<{ particles: ReturnType<typeof createParticleSystem>; shake: ReturnType<typeof createShake> } | null>(
    null
  );
  if (!fxRef.current) fxRef.current = { particles: createParticleSystem(280), shake: createShake() };
  if (!gameRef.current) gameRef.current = makeGame();

  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MOVES_PER_LEVEL);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [status, setStatus] = useState(DEFAULT_HINT);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const resetGame = useCallback(() => {
    gameRef.current = makeGame();
    fxRef.current?.particles.clear();
    fxRef.current?.shake.reset();
    setScore(0);
    setMoves(MOVES_PER_LEVEL);
    setLevel(1);
    setCombo(0);
    setStatus(DEFAULT_HINT);
    setIsGameOver(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const beginClear = useCallback((rawGroups: MatchGroup[]) => {
    const g = gameRef.current;
    if (!g) return;
    const fx = fxRef.current!;
    const groups = mergeGroups(rawGroups);
    g.groups = groups;
    g.clearing = makeMask();
    let points = 0;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    groups.forEach((grp) => {
      grp.cells.forEach((cell) => {
        g.clearing[cell.r][cell.c] = true;
      });
      const len = grp.cells.length;
      const bonus = len >= 4 ? (len - 3) * GROUP_BONUS_STEP : 0;
      points += len * GEM_POINTS * g.combo + bonus;
      const hue = GEM_STYLES[g.grid[grp.cells[0].r][grp.cells[0].c]].hue;
      let gx = 0;
      let gy = 0;
      grp.cells.forEach((cell) => {
        gx += cellX(cell.c);
        gy += cellY(cell.r);
        fx.particles.burst(cellX(cell.c), cellY(cell.r), 3, hue, 80);
      });
      gx /= len;
      gy /= len;
      sumX += gx;
      sumY += gy;
      count += 1;
      fx.shake.hit(len >= 4 ? 7 : 3);
    });

    const cx = count > 0 ? sumX / count : W / 2;
    const cy = count > 0 ? sumY / count : H / 2;
    g.labels.push({
      x: cx,
      y: cy,
      text: g.combo >= 2 ? `combo x${g.combo}!  +${points}` : `+${points}`,
      life: 0.8,
      maxLife: 0.8,
      size: g.combo >= 2 ? 26 : 22,
      color: g.combo >= 3 ? '#fbbf24' : g.combo >= 2 ? '#a7f3d0' : '#fef3c7',
    });
    setScore((s) => s + points);
    g.phase = 'clear';
    g.t = 0;
    playClearSound();
    triggerHaptic(g.combo >= 2 ? 45 : 22);
    if (g.combo >= 2) playScoreSound();
  }, []);

  const beginLevel = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const fx = fxRef.current!;
    g.level += 1;
    g.moves += MOVE_BONUS_PER_LEVEL;
    const addedType = g.types < MAX_TYPES;
    g.types = Math.min(MAX_TYPES, g.types + 1);
    g.phase = 'level';
    g.t = 0;
    g.sel = null;
    setLevel(g.level);
    setMoves(g.moves);
    setStatus(
      addedType
        ? `Lên màn ${g.level}! Thêm ${MOVE_BONUS_PER_LEVEL} lượt chơi và một loại ngọc mới.`
        : `Lên màn ${g.level}! Thêm ${MOVE_BONUS_PER_LEVEL} lượt chơi.`
    );
    g.labels.push({ x: W / 2, y: H / 2, text: `Màn ${g.level}`, life: LEVEL_TIME, maxLife: LEVEL_TIME, size: 40, color: '#fbbf24' });
    fx.shake.hit(9);
    for (let i = 0; i < 10; i++) fx.particles.burst(W / 2, H / 2, 6, 45 + i * 12, 150);
    playScoreSound();
    triggerHaptic(35);
  }, []);

  const beginShuffle = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.grid = reshuffleGrid(g.grid, g.types);
    g.phase = 'shuffle';
    g.t = 0;
    g.sel = null;
    setStatus('Không còn nước đi — đảo lại bảng!');
    playMoveSound();
    triggerHaptic(25);
  }, []);

  const endOfChain = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.combo = 0;
    setCombo(0);
    if (g.moves <= 0) {
      if (g.level >= FINAL_LEVEL) {
        g.phase = 'over';
        setStatus(`Hoàn thành màn ${FINAL_LEVEL}! Bạn đã thuộc hết mọi loại ngọc.`);
        setIsGameOver(true);
        return;
      }
      if (hasMove(g.grid)) {
        beginLevel();
      } else {
        g.phase = 'over';
        setStatus('Hết lượt và không còn nước đi nào tạo được bộ ba.');
        setIsGameOver(true);
      }
      return;
    }
    if (!hasMove(g.grid)) {
      beginShuffle();
      return;
    }
    g.phase = 'idle';
    g.t = 0;
    setStatus(g.moves <= LOW_MOVES ? `Chỉ còn ${g.moves} lượt — hãy tìm chuỗi dài để lên màn nhé!` : DEFAULT_HINT);
  }, [beginLevel, beginShuffle]);

  const commitSwap = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.swap) return;
    const { a, b } = g.swap;
    const type = g.grid[a.r][a.c];
    g.grid[a.r][a.c] = g.grid[b.r][b.c];
    g.grid[b.r][b.c] = type;
    g.t = 0;
    const groups = findMatches(g.grid);
    if (groups.length === 0) {
      g.phase = 'revert';
      fxRef.current?.shake.hit(6);
      playBounceSound();
      setStatus('Chưa khớp bộ ba — thử hướng khác nhé!');
    } else {
      g.moves -= 1;
      setMoves(g.moves);
      g.combo = 1;
      setCombo(1);
      beginClear(groups);
    }
  }, [beginClear]);

  const applyClear = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.groups.forEach((grp) =>
      grp.cells.forEach((cell) => {
        g.grid[cell.r][cell.c] = -1;
        g.clearing[cell.r][cell.c] = false;
      })
    );
    g.groups = [];
    collapse(g);
    g.phase = 'fall';
    g.t = 0;
  }, []);

  const commitFall = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g.offY[r][c] = 0;
    g.t = 0;
    playBounceSound();
    const groups = findMatches(g.grid);
    if (groups.length > 0) {
      g.combo += 1;
      setCombo(g.combo);
      beginClear(groups);
      return;
    }
    endOfChain();
  }, [beginClear, endOfChain]);

  const attemptSwap = useCallback(
    (from: Cell, to: Cell) => {
      const g = gameRef.current;
      if (!g || g.phase !== 'idle' || isPaused || isGameOver) return;
      g.swap = { a: from, b: to, dr: Math.sign(to.r - from.r), dc: Math.sign(to.c - from.c) };
      g.sel = null;
      g.phase = 'swap';
      g.t = 0;
      g.moves -= 1;
      setMoves(g.moves);
      playMoveSound();
      triggerHaptic(10);
    },
    [isPaused, isGameOver]
  );

  const pressCell = useCallback(
    (cell: Cell) => {
      const g = gameRef.current;
      if (!g || g.phase !== 'idle' || isPaused || isGameOver) return;
      g.cursor = cell;
      playMoveSound();
      triggerHaptic(8);
      if (!g.sel) {
        g.sel = cell;
        return;
      }
      if (sameCell(g.sel, cell)) {
        g.sel = null;
        return;
      }
      const dr = Math.abs(cell.r - g.sel.r);
      const dc = Math.abs(cell.c - g.sel.c);
      if (dr + dc === 1) attemptSwap(g.sel, cell);
      else g.sel = cell;
    },
    [attemptSwap, isPaused, isGameOver]
  );

  const moveCursor = useCallback(
    (dr: number, dc: number) => {
      const g = gameRef.current;
      if (!g || isPaused || isGameOver) return;
      g.cursor = {
        r: Math.min(ROWS - 1, Math.max(0, g.cursor.r + dr)),
        c: Math.min(COLS - 1, Math.max(0, g.cursor.c + dc)),
      };
      playMoveSound();
    },
    [isPaused, isGameOver]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g || g.phase !== 'idle' || isPaused || isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const cell = { r: Math.floor(y / CELL), c: Math.floor(x / CELL) };
    if (!inBounds(cell)) {
      g.sel = null;
      return;
    }
    pressCell(cell);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); moveCursor(-1, 0); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); moveCursor(1, 0); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); moveCursor(0, -1); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); moveCursor(0, 1); }
      else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const g = gameRef.current;
        if (g) pressCell(g.cursor);
      } else if (e.code === 'Escape') {
        const g = gameRef.current;
        if (g) g.sel = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveCursor, pressCell]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let last = performance.now();

    const update = (dt: number) => {
      const g = gameRef.current;
      if (!g) return;
      const fx = fxRef.current!;
      g.t += dt;
      fx.particles.update(dt);
      fx.shake.update(dt);
      g.labels = g.labels.filter((l) => {
        l.life -= dt;
        return l.life > 0;
      });

      if (g.phase === 'swap' && g.t >= SWAP_TIME) {
        commitSwap();
      } else if (g.phase === 'revert' && g.t >= REVERT_TIME) {
        if (g.swap) {
          const { a, b } = g.swap;
          const type = g.grid[a.r][a.c];
          g.grid[a.r][a.c] = g.grid[b.r][b.c];
          g.grid[b.r][b.c] = type;
          g.swap = null;
        }
        g.phase = 'idle';
        g.t = 0;
      } else if (g.phase === 'clear' && g.t >= clearDuration(g.level)) {
        applyClear();
      } else if (g.phase === 'fall') {
        const step = ((CELL * ROWS) / fallDuration(g.level)) * dt;
        let moving = false;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const o = g.offY[r][c];
            if (o === 0) continue;
            moving = true;
            const next = o > 0 ? o - step : o + step;
            g.offY[r][c] = Math.sign(next) !== Math.sign(o) || Math.abs(next) <= step ? 0 : next;
          }
        }
        if (!moving) commitFall();
      } else if (g.phase === 'shuffle' && g.t >= SHUFFLE_TIME) {
        if (hasMove(g.grid)) {
          g.phase = 'idle';
          g.t = 0;
          setStatus(DEFAULT_HINT);
        } else {
          g.grid = reshuffleGrid(g.grid, g.types);
          g.t = 0;
        }
      } else if (g.phase === 'level' && g.t >= LEVEL_TIME) {
        g.phase = 'idle';
        g.t = 0;
        setStatus(DEFAULT_HINT);
      }
    };

    const draw = (time: number) => {
      const light = isLightTheme();
      ctx.fillStyle = light ? '#dcecff' : '#0f0b13';
      ctx.fillRect(0, 0, W, H);
      const g = gameRef.current;
      if (!g) return;
      const fx = fxRef.current!;

      ctx.save();
      fx.shake.apply(ctx);
      drawBoard(ctx);

      let swapE = 0;
      let swapSign = 1;
      if (g.phase === 'swap') {
        swapE = easeInOut(clamp01(g.t / SWAP_TIME));
      } else if (g.phase === 'revert') {
        swapE = 1 - easeInOut(clamp01(g.t / REVERT_TIME));
        swapSign = -1;
      }
      const jitter = g.phase === 'revert' ? (Math.random() - 0.5) * fx.shake.value : 0;
      const revertScale = g.phase === 'revert' ? 1 + 0.16 * Math.sin(Math.PI * swapE) : 1;
      const clearE = g.phase === 'clear' ? easeInOut(clamp01(g.t / clearDuration(g.level))) : 0;
      const shuffleK = g.phase === 'shuffle' ? Math.sin(Math.PI * clamp01(g.t / SHUFFLE_TIME)) : 0;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const type = g.grid[r][c];
          if (type < 0) continue;
          let ox = 0;
          let oy = g.offY[r][c];
          if (g.swap) {
            if (r === g.swap.a.r && c === g.swap.a.c) {
              ox = g.swap.dc * swapE * CELL * swapSign;
              oy += g.swap.dr * swapE * CELL * swapSign;
            } else if (r === g.swap.b.r && c === g.swap.b.c) {
              ox = -g.swap.dc * swapE * CELL * swapSign;
              oy += -g.swap.dr * swapE * CELL * swapSign;
            }
          }
          if (jitter !== 0) {
            ox += jitter;
            oy += jitter * 0.7;
          }
          let radius = CELL * 0.34 * revertScale;
          let alpha = 1;
          let spin = 0;
          if (g.clearing[r][c]) {
            radius *= 1 - clearE;
            alpha = 1 - clearE;
            spin = clearE * 1.5;
          }
          if (shuffleK > 0) {
            radius *= 1 - 0.85 * shuffleK;
            alpha = 1 - 0.35 * shuffleK;
            spin = shuffleK * 2.4;
          }
          drawGem(ctx, cellX(c) + ox, cellY(r) + oy, type, radius, alpha, spin);
        }
      }

      if (g.sel) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 7);
        roundRectPath(ctx, g.sel.c * CELL + 7, g.sel.r * CELL + 7, CELL - 14, CELL - 14, 12);
        ctx.strokeStyle = `rgba(253, 224, 71, ${(0.45 + 0.5 * pulse).toFixed(3)})`;
        ctx.lineWidth = 2 + 2 * pulse;
        ctx.stroke();
        ctx.strokeStyle = `rgba(253, 224, 71, ${(0.16 * pulse).toFixed(3)})`;
        ctx.lineWidth = 7;
        ctx.stroke();
      }

      fx.particles.draw(ctx);
      drawLabels(ctx, g.labels);
      ctx.restore();
      drawVignette(ctx, W, H, light ? 0.1 : 0.32);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!isPaused && !isGameOver) update(dt);
      draw(now / 1000);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    isGameOver,
    isPaused,
    commitSwap,
    applyClear,
    commitFall,
  ]);

  const movesTone = moves <= 3 ? 'text-rose-400' : moves <= LOW_MOVES ? 'text-amber-400' : 'text-emerald-400';

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isVictory={isGameOver && level >= FINAL_LEVEL}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused((p) => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold ${movesTone}`}
            style={{ background: 'var(--game-status-bg)' }}
          >
            <Gem className="w-3.5 h-3.5" />
            {moves} lượt
          </span>
          <span
            className="flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold theme-text"
            style={{ background: 'var(--game-status-bg)' }}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Màn {level}
          </span>
          <span
            className={`flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold ${
              combo >= 2 ? 'text-amber-400' : 'theme-muted'
            }`}
            style={{ background: 'var(--game-status-bg)' }}
          >
            {combo >= 2 ? <Sparkles className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            x{Math.max(1, combo)}
          </span>
        </div>
      }
    >
      <div className="flex flex-col items-center w-full max-w-[480px] mx-auto">
        <div
          className="relative w-full rounded-3xl p-2 border theme-border"
          style={{ background: 'var(--surface-strong)', boxShadow: 'var(--game-surface-shadow)' }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={handlePointerDown}
            className="w-full block rounded-2xl game-touch-zone"
            style={{ aspectRatio: '1 / 1' }}
          />
        </div>
        <p className="mt-3 px-2 text-[11px] leading-snug theme-muted text-center">{status}</p>
        <p className="mt-1 text-[11px] theme-muted text-center hidden md:block">
          ← ↑ → ↓ chọn ô • Enter để chọn / hoán đổi • Esc để bỏ chọn • Gom 3 viên giống nhau theo hàng hoặc cột
        </p>
      </div>
    </GameShell>
  );
};