import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Bot, RotateCcw, Users } from 'lucide-react';

const P1 = 1;
const P2 = 2;
const CELL = 40;
const PAD = 16;
const P1_COLOR = '#6366f1';
const P2_COLOR = '#f59e0b';
const THREAT_COLOR = '#fbbf24';

const LEVELS: { id: string; label: string; dots: number }[] = [
  { id: 'easy', label: 'Dễ', dots: 4 },
  { id: 'normal', label: 'Trung bình', dots: 5 },
  { id: 'hard', label: 'Khó', dots: 6 },
];

export interface DotsLayout {
  rows: number;
  cols: number;
  boxRows: number;
  boxCols: number;
  edgeCount: number;
  boxEdges: number[][];
  edgeBoxes: number[][];
  isHorizontal: boolean[];
  x1: number[];
  y1: number[];
  x2: number[];
  y2: number[];
  midX: number[];
  midY: number[];
  boxX: number[];
  boxY: number[];
}

export interface EdgeResult {
  owners: number[];
  boxes: number[];
  gained: number[];
  erased: boolean;
}

export const buildLayout = (rows: number, cols: number): DotsLayout => {
  const boxRows = rows - 1;
  const boxCols = cols - 1;
  const hCount = rows * (cols - 1);
  const edgeCount = hCount + (rows - 1) * cols;
  const edgeBoxes: number[][] = Array.from({ length: edgeCount }, () => []);
  const isHorizontal: boolean[] = new Array(edgeCount).fill(false);
  const x1: number[] = new Array(edgeCount).fill(0);
  const y1: number[] = new Array(edgeCount).fill(0);
  const x2: number[] = new Array(edgeCount).fill(0);
  const y2: number[] = new Array(edgeCount).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const e = r * (cols - 1) + c;
      isHorizontal[e] = true;
      x1[e] = c * CELL;
      y1[e] = r * CELL;
      x2[e] = (c + 1) * CELL;
      y2[e] = r * CELL;
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const e = hCount + r * cols + c;
      x1[e] = c * CELL;
      y1[e] = r * CELL;
      x2[e] = c * CELL;
      y2[e] = (r + 1) * CELL;
    }
  }

  const boxEdges: number[][] = [];
  const boxX: number[] = [];
  const boxY: number[] = [];
  for (let r = 0; r < boxRows; r++) {
    for (let c = 0; c < boxCols; c++) {
      const top = r * (cols - 1) + c;
      const bottom = (r + 1) * (cols - 1) + c;
      const left = hCount + r * cols + c;
      const right = hCount + r * cols + c + 1;
      boxEdges.push([top, right, bottom, left]);
      boxX.push(c * CELL);
      boxY.push(r * CELL);
      [top, right, bottom, left].forEach(edge => {
        edgeBoxes[edge].push(boxEdges.length - 1);
      });
    }
  }

  const midX = x1.map((v, i) => (v + x2[i]) / 2);
  const midY = y1.map((v, i) => (v + y2[i]) / 2);

  return {
    rows,
    cols,
    boxRows,
    boxCols,
    edgeCount,
    boxEdges,
    edgeBoxes,
    isHorizontal,
    x1,
    y1,
    x2,
    y2,
    midX,
    midY,
    boxX,
    boxY,
  };
};

const filledOf = (layout: DotsLayout, owners: number[], box: number) =>
  layout.boxEdges[box].reduce((n, e) => n + (owners[e] !== 0 ? 1 : 0), 0);

const freeEdges = (layout: DotsLayout, owners: number[]) => {
  const out: number[] = [];
  for (let e = 0; e < layout.edgeCount; e++) if (owners[e] === 0) out.push(e);
  return out;
};

export const canEraseEdge = (layout: DotsLayout, owners: number[], boxes: number[], player: number, edge: number) =>
  owners[edge] === player && layout.edgeBoxes[edge].every(b => boxes[b] === 0);

export const playEdge = (
  layout: DotsLayout,
  owners: number[],
  boxes: number[],
  player: number,
  edge: number,
): EdgeResult | null => {
  if (edge < 0 || edge >= layout.edgeCount) return null;
  const nextOwners = owners.slice();

  if (owners[edge] === player) {
    if (!canEraseEdge(layout, owners, boxes, player, edge)) return null;
    nextOwners[edge] = 0;
    return { owners: nextOwners, boxes, gained: [], erased: true };
  }
  if (owners[edge] !== 0) return null;

  nextOwners[edge] = player;
  const nextBoxes = boxes.slice();
  const gained: number[] = [];
  layout.edgeBoxes[edge].forEach(b => {
    if (nextBoxes[b] === 0 && filledOf(layout, nextOwners, b) === 4) {
      nextBoxes[b] = player;
      gained.push(b);
    }
  });
  return { owners: nextOwners, boxes: nextBoxes, gained, erased: false };
};

export const isThreatBox = (layout: DotsLayout, owners: number[], boxes: number[], box: number) => {
  if (boxes[box] !== 0) return false;
  const drawn = layout.boxEdges[box].filter(e => owners[e] !== 0);
  if (drawn.length !== 2) return false;
  return owners[drawn[0]] !== owners[drawn[1]];
};

interface EdgeEval {
  next: number[];
  f1: number[];
  f2: number[];
  f3: number[];
  f4: number[];
}

const evalEdge = (layout: DotsLayout, owners: number[], boxes: number[], edge: number): EdgeEval => {
  const next = owners.slice();
  next[edge] = P2;
  const f1: number[] = [];
  const f2: number[] = [];
  const f3: number[] = [];
  const f4: number[] = [];
  layout.edgeBoxes[edge].forEach(b => {
    if (boxes[b] !== 0) return;
    const n = filledOf(layout, next, b);
    if (n === 1) f1.push(b);
    else if (n === 2) f2.push(b);
    else if (n === 3) f3.push(b);
    else if (n === 4) f4.push(b);
  });
  return { next, f1, f2, f3, f4 };
};

const chainSize = (layout: DotsLayout, owners: number[], boxes: number[], start: number) => {
  const isSingle = (b: number) => boxes[b] === 0 && filledOf(layout, owners, b) === 3;
  const seen = new Set<number>([start]);
  const stack = [start];
  let size = 1;
  while (stack.length > 0) {
    const b = stack.pop() as number;
    const br = Math.floor(b / layout.boxCols);
    const bc = b % layout.boxCols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = br + dr;
        const c = bc + dc;
        if (r < 0 || r >= layout.boxRows || c < 0 || c >= layout.boxCols) continue;
        const nb = r * layout.boxCols + c;
        if (seen.has(nb) || !isSingle(nb)) continue;
        seen.add(nb);
        stack.push(nb);
        size += 1;
      }
    }
  }
  return size;
};

const compareKeys = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};

export const chooseAiMove = (layout: DotsLayout, owners: number[], boxes: number[]): number => {
  const free = freeEdges(layout, owners);
  if (free.length === 0) return -1;
  if (free.length === 1) return free[0];

  let captureMove = -1;
  let captureCount = 0;
  let captureOpen = Infinity;
  let captureChain = 0;

  const candidates: { e: number; eval: EdgeEval }[] = free.map(e => ({ e, eval: evalEdge(layout, owners, boxes, e) }));

  for (const c of candidates) {
    if (c.eval.f4.length === 0) continue;
    const chain = c.eval.f4.reduce((m, b) => Math.max(m, chainSize(layout, c.eval.next, boxes, b)), 0);
    const better =
      c.eval.f4.length > captureCount ||
      (c.eval.f4.length === captureCount &&
        (c.eval.f3.length < captureOpen ||
          (c.eval.f3.length === captureOpen && chain > captureChain)));
    if (better) {
      captureMove = c.e;
      captureCount = c.eval.f4.length;
      captureOpen = c.eval.f3.length;
      captureChain = chain;
    }
  }
  if (captureCount > 0) return captureMove;

  type Cand = { e: number; k: number[] };
  const safe: Cand[] = [];
  const risky: Cand[] = [];

  for (const c of candidates) {
    const openNeighbours = layout.edgeBoxes[c.e].reduce((n, b) => n + (boxes[b] === 0 ? 1 : 0), 0);
    if (c.eval.f3.length === 0) {
      const ownTwos = c.eval.f2.reduce(
        (n, b) => n + (layout.boxEdges[b].some(x => owners[x] === P2) ? 1 : 0),
        0,
      );
      safe.push({ e: c.e, k: [-c.eval.f2.length, -ownTwos, openNeighbours, Math.random()] });
    } else {
      const chain = c.eval.f3.reduce((m, b) => Math.max(m, chainSize(layout, c.eval.next, boxes, b)), 0);
      risky.push({ e: c.e, k: [c.eval.f3.length, chain, openNeighbours, Math.random()] });
    }
  }

  const pool = safe.length > 0 ? safe : risky;
  let best = pool[0];
  for (const c of pool) if (compareKeys(c.k, best.k) < 0) best = c;
  return best.e;
};

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;
const DEFAULT_LEVEL = 'normal';
const DEFAULT_AI_DELAY = 420;

export const DotsAndBoxesGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('dots-and-boxes')!;

  const [levelId, setLevelId] = useState<string>(DEFAULT_LEVEL);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [vsAI, setVsAI] = useState(true);
  const [owners, setOwners] = useState<number[]>(() => new Array(buildLayout(DEFAULT_ROWS, DEFAULT_COLS).edgeCount).fill(0));
  const [boxes, setBoxes] = useState<number[]>(() => new Array((DEFAULT_ROWS - 1) * (DEFAULT_COLS - 1)).fill(0));
  const [turn, setTurn] = useState(P1);
  const [chain, setChain] = useState(0);
  const [moves, setMoves] = useState(0);
  const [ended, setEnded] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const layout = useMemo(() => buildLayout(rows, cols), [rows, cols]);

  const p1Boxes = boxes.reduce((n, b) => n + (b === P1 ? 1 : 0), 0);
  const p2Boxes = boxes.reduce((n, b) => n + (b === P2 ? 1 : 0), 0);
  const totalBoxes = boxes.length;
  const won = p1Boxes > p2Boxes;
  const score = ended ? p1Boxes * 100 + (won ? 300 : 0) + (vsAI ? 150 : 0) : 0;

  const newGame = useCallback((nextLevel: string, nextAI: boolean) => {
    const level = LEVELS.find(l => l.id === nextLevel) ?? LEVELS[1];
    setLevelId(level.id);
    setVsAI(nextAI);
    setRows(level.dots);
    setCols(level.dots);
    const nextLayout = buildLayout(level.dots, level.dots);
    setOwners(new Array(nextLayout.edgeCount).fill(0));
    setBoxes(new Array(nextLayout.boxRows * nextLayout.boxCols).fill(0));
    setTurn(P1);
    setChain(0);
    setMoves(0);
    setEnded(false);
    setHover(null);
  }, []);

  const restart = useCallback(() => {
    newGame(levelId, vsAI);
  }, [levelId, vsAI, newGame]);

  const applyMove = useCallback(
    (player: number, edge: number) => {
      const result = playEdge(layout, owners, boxes, player, edge);
      if (!result) return;
      setOwners(result.owners);
      setBoxes(result.boxes);
      playMoveSound();
      triggerHaptic(10);

      if (result.erased) {
        setMoves(m => m + 1);
        setEnded(false);
        setTurn(player === P1 ? P2 : P1);
        setChain(0);
        return;
      }

      if (result.gained.length > 0) {
        playScoreSound();
        triggerHaptic(result.gained.length > 1 ? 45 : 20);
        setMoves(m => m + 1);
        setChain(c => c + result.gained.length);
      } else {
        setMoves(m => m + 1);
        setChain(0);
      }

      const finished = result.boxes.every(b => b !== 0);
      if (finished) {
        setEnded(true);
        playClearSound();
        return;
      }
      if (result.gained.length === 0) setTurn(player === P1 ? P2 : P1);
    },
    [layout, owners, boxes],
  );

  const applyMoveRef = useRef(applyMove);
  applyMoveRef.current = applyMove;

  useEffect(() => {
    if (!vsAI || ended || turn !== P2) return;
    const timer = window.setTimeout(() => {
      const pick = chooseAiMove(layout, owners, boxes);
      if (pick >= 0) applyMoveRef.current(P2, pick);
    }, DEFAULT_AI_DELAY);
    return () => window.clearTimeout(timer);
  }, [vsAI, ended, turn, layout, owners, boxes]);

  const canInteract = !ended && (vsAI ? turn === P1 : true);
  const turnLabel = vsAI ? (turn === P1 ? 'Bạn' : 'Máy tính') : `Người ${turn}`;
  const turnColor = turn === P1 ? P1_COLOR : P2_COLOR;
  const boardWidth = (cols - 1) * CELL + PAD * 2;
  const boardHeight = (rows - 1) * CELL + PAD * 2;

  const players: { id: number; name: string; color: string; count: number }[] = [
    { id: P1, name: vsAI ? 'Bạn' : 'Người 1', color: P1_COLOR, count: p1Boxes },
    { id: P2, name: vsAI ? 'Máy tính' : 'Người 2', color: P2_COLOR, count: p2Boxes },
  ];

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
        <div className="px-3 py-1 rounded-xl border theme-border flex items-center gap-2" style={{ background: 'var(--surface-strong)' }}>
          <span className="text-[10px] uppercase font-bold theme-muted">Nước:</span>
          <span className="text-sm font-bold text-emerald-400">{moves}</span>
          <span className="text-[10px] theme-muted hidden sm:inline">Ô còn lại</span>
          <span className="text-sm font-bold text-sky-300">{totalBoxes - p1Boxes - p2Boxes}</span>
        </div>
      }
    >
      <div className="w-full mx-auto flex flex-col items-center gap-3 px-1 py-1" style={{ maxWidth: '34rem' }}>
        <div className="flex w-full rounded-2xl border theme-border p-1" style={{ background: 'var(--surface-soft)' }}>
          <button
            type="button"
            onClick={() => newGame(levelId, false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition game-btn-press ${
              !vsAI ? 'bg-indigo-600 text-white' : 'theme-text hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            2 Người
          </button>
          <button
            type="button"
            onClick={() => newGame(levelId, true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition game-btn-press ${
              vsAI ? 'bg-indigo-600 text-white' : 'theme-text hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Đấu Máy
          </button>
        </div>

        <div className="flex w-full rounded-2xl border theme-border p-1" style={{ background: 'var(--surface-soft)' }}>
          {LEVELS.map(level => (
            <button
              key={level.id}
              type="button"
              onClick={() => newGame(level.id, vsAI)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition game-btn-press ${
                levelId === level.id ? 'bg-amber-500 text-slate-950' : 'theme-text hover:bg-white/5'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>

        <div
          className="flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold"
          style={{
            background: ended ? 'var(--surface-strong)' : canInteract ? 'rgba(5,150,105,0.22)' : 'rgba(180,83,9,0.22)',
            borderColor: ended ? 'var(--border-color)' : canInteract ? '#047857' : '#854d0e',
            color: ended ? 'var(--text-muted)' : canInteract ? '#6ee7b7' : '#fde68a',
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: ended ? '#64748b' : turnColor }} />
          {ended
            ? won
              ? `Bạn thắng ${p1Boxes} - ${p2Boxes}!`
              : `Máy/đối thủ thắng ${p2Boxes} - ${p1Boxes}`
            : canInteract
              ? `Lượt ${turnLabel} — chạm giữa hai chấm để vẽ`
              : 'Máy tính đang suy nghĩ...'}
        </div>

        <div
          className="w-full rounded-3xl border p-2 sm:p-3"
          style={{ background: 'var(--game-surface-bg)', borderColor: 'var(--game-surface-border)' }}
        >
          <svg
            viewBox={`0 0 ${boardWidth} ${boardHeight}`}
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Bàn chấm và hộp"
          >
            {Array.from({ length: boxes.length }, (_, b) => {
              const owner = boxes[b];
              const color = owner === P1 ? P1_COLOR : P2_COLOR;
              const threat = !ended && isThreatBox(layout, owners, boxes, b);
              return (
                <g key={`box-${b}`}>
                  {owner !== 0 && (
                    <rect
                      x={layout.boxX[b] + 5}
                      y={layout.boxY[b] + 5}
                      width={CELL - 10}
                      height={CELL - 10}
                      rx={4}
                      fill={color}
                      fillOpacity={0.3}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  )}
                  {threat && (
                    <rect
                      x={layout.boxX[b] + 3}
                      y={layout.boxY[b] + 3}
                      width={CELL - 6}
                      height={CELL - 6}
                      rx={6}
                      fill="none"
                      stroke={THREAT_COLOR}
                      strokeWidth={2.5}
                      strokeDasharray="5 3"
                    />
                  )}
                </g>
              );
            })}

            {Array.from({ length: layout.edgeCount }, (_, e) => {
              const owner = owners[e];
              if (owner === 0) return null;
              return (
                <line
                  key={`edge-${e}`}
                  x1={layout.x1[e]}
                  y1={layout.y1[e]}
                  x2={layout.x2[e]}
                  y2={layout.y2[e]}
                  stroke={owner === P1 ? P1_COLOR : P2_COLOR}
                  strokeWidth={5.5}
                  strokeLinecap="round"
                />
              );
            })}

            {Array.from({ length: layout.edgeCount }, (_, e) => {
              if (owners[e] !== 0) return null;
              const h = layout.isHorizontal[e];
              const rx = h ? layout.x1[e] + CELL * 0.24 : layout.x1[e] - CELL * 0.22;
              const ry = h ? layout.y1[e] - CELL * 0.22 : layout.y1[e] + CELL * 0.24;
              const rw = h ? CELL * 0.52 : CELL * 0.44;
              const rh = h ? CELL * 0.44 : CELL * 0.52;
              return (
                <g key={`hit-${e}`}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={hover === e ? THREAT_COLOR : 'var(--accent)'}
                    fillOpacity={hover === e ? 0.18 : 0.07}
                    rx={3}
                  />
                  <circle
                    cx={layout.midX[e]}
                    cy={layout.midY[e]}
                    r={hover === e ? 4.6 : 3.2}
                    fill={hover === e ? THREAT_COLOR : 'var(--text-muted)'}
                    fillOpacity={hover === e ? 1 : 0.5}
                  />
                </g>
              );
            })}

            {Array.from({ length: layout.edgeCount }, (_, e) => (
              <rect
                key={`tap-${e}`}
                x={
                  layout.isHorizontal[e]
                    ? layout.x1[e] + CELL * 0.2
                    : layout.x1[e] - CELL * 0.24
                }
                y={
                  layout.isHorizontal[e]
                    ? layout.y1[e] - CELL * 0.24
                    : layout.y1[e] + CELL * 0.2
                }
                width={layout.isHorizontal[e] ? CELL * 0.6 : CELL * 0.48}
                height={layout.isHorizontal[e] ? CELL * 0.48 : CELL * 0.6}
                fill="transparent"
                className={canInteract ? 'cursor-pointer' : 'cursor-default'}
                onMouseEnter={() => setHover(e)}
                onMouseLeave={() => setHover(cur => (cur === e ? null : cur))}
                onClick={() => {
                  if (!canInteract) return;
                  setHover(null);
                  applyMove(turn, e);
                }}
              />
            ))}

            {Array.from({ length: rows * cols }, (_, d) => {
              const r = Math.floor(d / cols);
              const c = d % cols;
              return (
                <circle
                  key={`dot-${d}`}
                  cx={c * CELL}
                  cy={r * CELL}
                  r={2.8}
                  fill="var(--text-primary)"
                  fillOpacity={0.75}
                />
              );
            })}
          </svg>
        </div>

        <div className="w-full flex items-stretch gap-2">
          {players.map(p => (
            <div
              key={p.id}
              className="flex-1 rounded-2xl border px-3 py-2"
              style={{
                background: turn === p.id && !ended ? 'var(--surface-strong)' : 'transparent',
                borderColor: turn === p.id && !ended ? p.color : 'var(--border-color)',
                opacity: ended || turn === p.id ? 1 : 0.7,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="text-[11px] font-bold theme-text">{p.name}</span>
              </div>
              <div className="mt-0.5 text-xl font-black" style={{ color: p.color }}>
                {p.count}
                <span className="text-[10px] font-bold theme-muted"> / {totalBoxes}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] theme-muted leading-relaxed">
          Bấm giữa hai chấm để vẽ nét. Bấm lại nét của bạn để xoá.
          <br />
          <span style={{ color: THREAT_COLOR }}>Viền vàng</span> = ô đã có 2 cạnh khác chủ, bên còn lại chỉ cần thêm 1 nét là ăn.
          {chain > 1 && (
            <>
              <br />
              <span className="font-black text-emerald-400">Đang ăn chuỗi {chain} ô liên tiếp!</span>
            </>
          )}
        </p>

        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition game-btn-press"
          style={{ background: '#4f46e5' }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Ván mới
        </button>
      </div>
    </GameShell>
  );
};