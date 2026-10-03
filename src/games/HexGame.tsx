import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';

type Player = 1 | 2;

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

const DIFFICULTIES: { label: string; size: number }[] = [
  { label: 'Dễ', size: 4 },
  { label: 'Trung bình', size: 6 },
  { label: 'Khó', size: 9 },
];

const P1_STONE = '#0f172a';
const P2_STONE = '#e2e8f0';
const P1_EDGE = '#3b82f6';
const P2_EDGE = '#f59e0b';
const EMPTY_CELL = 'rgba(148,163,184,0.22)';

const withAlpha = (hex: string, a: number): string => {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const cellX = (r: number, c: number): number => c + (r % 2 === 1 ? 0.5 : 0);
const cellY = (r: number): number => 0.75 * r;

const neighbors = (r: number, c: number, n: number): [number, number][] => {
  const raw: [number, number][] =
    r % 2 === 1
      ? [
          [r, c - 1],
          [r, c + 1],
          [r - 1, c],
          [r - 1, c + 1],
          [r + 1, c],
          [r + 1, c + 1],
        ]
      : [
          [r, c - 1],
          [r, c + 1],
          [r - 1, c - 1],
          [r - 1, c],
          [r + 1, c - 1],
          [r + 1, c],
        ];
  return raw.filter(([rr, cc]) => rr >= 0 && rr < n && cc >= 0 && cc < n);
};

const findWinChain = (board: number[], n: number, player: Player): number[] | null => {
  const prev = new Map<number, number | null>();
  const queue: number[] = [];
  for (let k = 0; k < n; k++) {
    const idx = player === 1 ? k : k * n;
    if (board[idx] === player && !prev.has(idx)) {
      prev.set(idx, null);
      queue.push(idx);
    }
  }
  let goal: number | null = null;
  for (let qi = 0; qi < queue.length && goal === null; qi++) {
    const idx = queue[qi];
    const r = Math.floor(idx / n);
    const c = idx % n;
    if ((player === 1 && r === n - 1) || (player === 2 && c === n - 1)) {
      goal = idx;
      break;
    }
    for (const [nr, nc] of neighbors(r, c, n)) {
      const ni = nr * n + nc;
      if (board[ni] === player && !prev.has(ni)) {
        prev.set(ni, idx);
        queue.push(ni);
      }
    }
  }
  if (goal === null) return null;
  const chain: number[] = [];
  let cur: number | null = goal;
  while (cur !== null) {
    chain.push(cur);
    cur = prev.has(cur) ? (prev.get(cur) as number | null) : null;
  }
  return chain;
};

const computeScore = (winner: Player, moves: number, n: number): number => {
  const sizeBonus = (n - 4) * 100;
  const speedBonus = Math.max(0, (n * n - moves) * 15);
  return winner === 1
    ? 400 + sizeBonus + speedBonus
    : 80 + Math.floor(sizeBonus / 2) + speedBonus;
};

interface LastMove {
  r: number;
  c: number;
  player: Player;
}

interface WinState {
  winner: Player;
  chain: number[];
}

interface CellEdgeProps {
  color: string;
  active: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const EdgeBar: React.FC<CellEdgeProps> = ({ color, active, position }) => {
  const common = {
    position: 'absolute' as const,
    background: color,
    opacity: active ? 1 : 0.35,
    borderRadius: 999,
  };
  if (position === 'top' || position === 'bottom') {
    return (
      <span
        style={{
          ...common,
          left: '15%',
          width: '70%',
          height: 3,
          [position]: -4,
        }}
      />
    );
  }
  return (
    <span
      style={{
        ...common,
        top: '25%',
        height: '50%',
        width: 3,
        [position]: -4,
      }}
    />
  );
};

export const HexGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [size, setSize] = useState(4);
  const [board, setBoard] = useState<number[]>(() => new Array(16).fill(0));
  const [turn, setTurn] = useState<Player>(1);
  const [moves, setMoves] = useState(0);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [win, setWin] = useState<WinState | null>(null);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [focused, setFocused] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const totalW = size + 0.5;
  const totalH = 0.75 * (size - 1) + 1;
  const sizeWPct = 100 / totalW;
  const sizeHPct = 100 / totalH;

  const reset = useCallback((nextSize: number) => {
    setSize(nextSize);
    setBoard(new Array(nextSize * nextSize).fill(0));
    setTurn(1);
    setMoves(0);
    setLastMove(null);
    setWin(null);
    setScore(0);
    setCursor([0, 0]);
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (win) return;
    const idx = r * size + c;
    if (lastMove && lastMove.r === r && lastMove.c === c) {
      const next = board.slice();
      next[idx] = 0;
      setBoard(next);
      setTurn(lastMove.player);
      setLastMove(null);
      setMoves((m) => Math.max(0, m - 1));
      playMoveSound();
      triggerHaptic(15);
      return;
    }
    if (board[idx] !== 0) return;
    const next = board.slice();
    next[idx] = turn;
    setBoard(next);
    setLastMove({ r, c, player: turn });
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    playMoveSound();
    triggerHaptic(20);
    const chain = findWinChain(next, size, turn);
    if (chain) {
      setWin({ winner: turn, chain });
      setScore(computeScore(turn, nextMoves, size));
      playScoreSound();
    } else {
      setTurn(turn === 1 ? 2 : 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const node = boardRef.current;
      if (!node || !node.contains(target)) return;
      const key = e.key;
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Enter' && key !== ' ') {
        return;
      }
      e.preventDefault();
      const [r, c] = cursor;
      if (key === 'ArrowUp') setCursor([Math.max(0, r - 1), c]);
      else if (key === 'ArrowDown') setCursor([Math.min(size - 1, r + 1), c]);
      else if (key === 'ArrowLeft') setCursor([r, Math.max(0, c - 1)]);
      else if (key === 'ArrowRight') setCursor([r, Math.min(size - 1, c + 1)]);
      else {
        setFocused(true);
        handleCellClick(r, c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cells = useMemo(() => {
    const out: { r: number; c: number; key: string }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) out.push({ r, c, key: `${r}-${c}` });
    }
    return out;
  }, [size]);

  const chainSet = useMemo(() => {
    const s = new Set<number>();
    if (win) win.chain.forEach((i) => s.add(i));
    return s;
  }, [win]);

  const p1Aim = 'TRÊN ↔ DƯỚI';
  const p2Aim = 'TRÁI ↔ PHẢI';

  const statusText = win
    ? win.winner === 1
      ? 'BẠN THẮNG! Đã nối xuyên ' + p1Aim
      : 'NGƯỜI 2 THẮNG! Đã nối xuyên ' + p2Aim
    : `Lượt ${turn === 1 ? 'Người 1 (bạn)' : 'Người 2'}: nối xuyên ${turn === 1 ? p1Aim : p2Aim}`;

  const statusColor = win
    ? win.winner === 1
      ? '#22c55e'
      : P2_EDGE
    : turn === 1
      ? P1_EDGE
      : P2_EDGE;

  return (
    <GameShell
      game={getGameById('hex')!}
      score={score}
      isGameOver={win !== null}
      isVictory={win !== null && win.winner === 1}
      isPaused={false}
      onRestart={() => reset(size)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div
          className="px-2.5 py-1 rounded-xl border theme-border flex items-center gap-1.5"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">Bàn</span>
          <span className="text-xs font-black theme-text">
            {size}×{size} · {moves} nước
          </span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-2.5 w-full px-1">
        <div
          className="flex items-center gap-1 p-1 rounded-2xl border theme-border"
          style={{ background: 'var(--game-control-bg)' }}
        >
          {DIFFICULTIES.map((d) => (
            <button
              key={d.size}
              type="button"
              onClick={() => {
                playMoveSound();
                if (d.size !== size) reset(d.size);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition game-btn-press ${
                d.size === size ? 'bg-indigo-600 text-white' : 'theme-text'
              }`}
            >
              {d.label} <span className="opacity-70">{d.size}×{d.size}</span>
            </button>
          ))}
        </div>

        <div
          className="w-full max-w-[520px] px-3 py-2 rounded-2xl border theme-border flex items-center gap-2"
          style={{ background: 'var(--game-status-bg)' }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ background: turn === 1 ? P1_STONE : P2_STONE, outline: `2px solid ${statusColor}` }}
          />
          <span className="text-[11px] sm:text-xs font-bold" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>

        <div
          className="w-full max-w-[520px] rounded-3xl border theme-border p-3 sm:p-4"
          style={{ background: 'var(--game-surface-bg)' }}
        >
          <div className="flex items-stretch gap-1.5">
            <div className="w-6 sm:w-7 shrink-0 flex items-center justify-center">
              <div
                className="flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2"
                style={{
                  borderColor: turn === 2 ? P2_EDGE : 'var(--border-color)',
                  background: turn === 2 ? withAlpha(P2_EDGE, 0.16) : 'transparent',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: P2_STONE, outline: `1px solid ${P2_EDGE}` }} />
                <span className="text-[9px] font-black theme-muted" style={{ writingMode: 'vertical-rl' }}>
                  ◀ TRÁI
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div
                className="flex items-center justify-center gap-1.5 rounded-lg border px-1.5 py-1"
                style={{
                  borderColor: turn === 1 ? P1_EDGE : 'var(--border-color)',
                  background: turn === 1 ? withAlpha(P1_EDGE, 0.16) : 'transparent',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: P1_STONE, outline: `1px solid ${P1_EDGE}` }} />
                <span className="text-[9px] font-black theme-muted">▲ TRÊN · Người 1</span>
              </div>

              <div
                ref={boardRef}
                tabIndex={0}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="relative w-full outline-none"
                style={{ aspectRatio: `${totalH} / ${totalW}` }}
              >
                {cells.map((cell) => {
                  const value = board[cell.r * size + cell.c];
                  const isTop = cell.r === 0;
                  const isBottom = cell.r === size - 1;
                  const isLeft = cell.c === 0;
                  const isRight = cell.c === size - 1;
                  const p1Edge = isTop || isBottom;
                  const p2Edge = isLeft || isRight;
                  const isWon = chainSet.has(cell.r * size + cell.c);
                  const isLast = lastMove !== null && lastMove.r === cell.r && lastMove.c === cell.c;
                  const isCursor = focused && cursor[0] === cell.r && cursor[1] === cell.c;
                  const bg = p1Edge
                    ? withAlpha(P1_EDGE, turn === 1 ? 0.3 : 0.12)
                    : p2Edge
                      ? withAlpha(P2_EDGE, turn === 2 ? 0.32 : 0.12)
                      : EMPTY_CELL;
                  const stone = isWon
                    ? 'var(--accent)'
                    : value === 1
                      ? P1_STONE
                      : P2_STONE;
                  const rim = isWon
                    ? 'var(--accent)'
                    : value === 1
                      ? withAlpha(P2_STONE, 0.55)
                      : withAlpha(P1_STONE, 0.55);
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => handleCellClick(cell.r, cell.c)}
                      onMouseEnter={() => setHover(cell.key)}
                      onMouseLeave={() => setHover((h) => (h === cell.key ? null : h))}
                      aria-label={`Hàng ${cell.r + 1}, cột ${cell.c + 1}`}
                      className="absolute aspect-square p-0 border-0 bg-transparent outline-none"
                      style={{
                        left: `${(cellX(cell.r, cell.c) * 100) / totalW}%`,
                        top: `${(cellY(cell.r) * 100) / totalH}%`,
                        width: `${sizeWPct}%`,
                        height: `${sizeHPct}%`,
                        outline: isCursor ? '2px solid var(--accent)' : 'none',
                        cursor: value === 0 || isLast ? 'pointer' : 'default',
                      }}
                    >
                      <span
                        className="absolute inset-0 block"
                        style={{ clipPath: HEX_CLIP, background: bg }}
                      />
                      {p1Edge ? (
                        <EdgeBar color={P1_EDGE} active={turn === 1} position={isTop ? 'top' : 'bottom'} />
                      ) : null}
                      {p2Edge ? (
                        <EdgeBar color={P2_EDGE} active={turn === 2} position={isLeft ? 'left' : 'right'} />
                      ) : null}
                      {value !== 0 ? (
                        <>
                          <span
                            className="absolute block"
                            style={{ clipPath: HEX_CLIP, background: rim, left: '11%', top: '11%', width: '78%', height: '78%' }}
                          />
                          <span
                            className="absolute block transition-opacity duration-150"
                            style={{ clipPath: HEX_CLIP, background: stone, left: '19%', top: '19%', width: '62%', height: '62%' }}
                          />
                          {isLast ? (
                            <span
                              className="absolute block rounded-full"
                              style={{
                                left: '45%',
                                top: '45%',
                                width: '10%',
                                height: '10%',
                                background: value === 1 ? P2_STONE : P1_STONE,
                              }}
                            />
                          ) : null}
                        </>
                      ) : null}
                      {value === 0 && hover === cell.key && !win ? (
                        <span
                          className="absolute block"
                          style={{
                            clipPath: HEX_CLIP,
                            background: turn === 1 ? P1_STONE : P2_STONE,
                            opacity: 0.3,
                            left: '19%',
                            top: '19%',
                            width: '62%',
                            height: '62%',
                          }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div
                className="flex items-center justify-center gap-1.5 rounded-lg border px-1.5 py-1"
                style={{
                  borderColor: turn === 1 ? P1_EDGE : 'var(--border-color)',
                  background: turn === 1 ? withAlpha(P1_EDGE, 0.16) : 'transparent',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: P1_STONE, outline: `1px solid ${P1_EDGE}` }} />
                <span className="text-[9px] font-black theme-muted">DƯỚI ▼ · Người 1</span>
              </div>
            </div>

            <div className="w-6 sm:w-7 shrink-0 flex items-center justify-center">
              <div
                className="flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2"
                style={{
                  borderColor: turn === 2 ? P2_EDGE : 'var(--border-color)',
                  background: turn === 2 ? withAlpha(P2_EDGE, 0.16) : 'transparent',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: P2_STONE, outline: `1px solid ${P2_EDGE}` }} />
                <span className="text-[9px] font-black theme-muted" style={{ writingMode: 'vertical-rl' }}>
                  PHẢI ▶
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playMoveSound();
            reset(size);
          }}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition game-btn-press"
        >
          Chơi lại
        </button>

        <p className="text-[10px] theme-muted text-center leading-snug">
          Người 1 nối cạnh trên với cạnh dưới · Người 2 nối cạnh trái với cạnh phải.
          <br />
          Chạm ô trống để đặt quân · Chạm quân vừa đặt (có chấm) để đi lại 1 nước.
        </p>
      </div>
    </GameShell>
  );
};
