import React, { useEffect, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playBounceSound,
  playClearSound,
  playMoveSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';

const PIT_COUNT = 12;
const STORE_A = 12;
const STORE_B = 13;
const STONES_PER_PIT = 4;
const SOW_MS = 170;
const AI_DEPTH = 3;

const A_RING = [STORE_A, 11, 10, 9, 8, 7, 6, 0, 1, 2, 3, 4, 5];
const B_RING = [STORE_B, 6, 7, 8, 9, 10, 11, 5, 4, 3, 2, 1, 0];
const RING = [A_RING, B_RING];
const SIDE = [
  [0, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11],
];

interface Board {
  pits: number[];
  stores: number[];
}

interface MoveOut {
  board: Board;
  sowPath: number[];
  lastCell: number;
  captured: number;
  extraTurn: boolean;
  swept: number;
  sweptStore: number;
  over: boolean;
  nextPlayer: number;
}

const createBoard = (): Board => ({
  pits: Array.from({ length: PIT_COUNT }, () => STONES_PER_PIT),
  stores: [0, 0],
});

const ownPit = (player: number, cell: number) =>
  cell < PIT_COUNT && (player === 0 ? cell < 6 : cell >= 6);

const opposite = (cell: number) => (cell < 6 ? cell + 6 : cell - 6);

// Explicit grid placement so the board always renders as 6 pits + store per row.
// Auto-flow overflowed here: the 7th pit wrapped into column 8 and the second
// store (row-span-2) could no longer fit, creating a phantom third row.
const pitGridArea = (cell: number) => {
  const isTopRow = cell >= 6;
  const col = (isTopRow ? cell - 6 : cell) + 2; // pits occupy columns 2..7
  return isTopRow ? `1 / ${col} / 2 / ${col + 1}` : `2 / ${col} / 3 / ${col + 1}`;
};

const storeGridArea = (side: number) => (side === 1 ? '1 / 1 / 3 / 2' : '1 / 8 / 3 / 9');

const cellValue = (board: Board, cell: number) =>
  cell < PIT_COUNT ? board.pits[cell] : board.stores[cell - PIT_COUNT];

const addCell = (board: Board, cell: number, delta: number): Board => {
  if (cell < PIT_COUNT) {
    const pits = board.pits.slice();
    pits[cell] += delta;
    return { pits, stores: board.stores };
  }
  const stores = board.stores.slice();
  stores[cell - PIT_COUNT] += delta;
  return { pits: board.pits, stores };
};

const sideTotal = (pits: number[], player: number) =>
  SIDE[player].reduce((sum, cell) => sum + pits[cell], 0);

const legalPits = (pits: number[], player: number) =>
  SIDE[player].filter(cell => pits[cell] > 0);

const playMove = (board: Board, player: number, pit: number): MoveOut | null => {
  if (pit < 0 || pit >= PIT_COUNT || board.pits[pit] <= 0) return null;
  if (!ownPit(player, pit)) return null;

  const stones = board.pits[pit];
  const ring = RING[player];
  const sowPath: number[] = [];
  let next = addCell(board, pit, -stones);
  let pos = ring.indexOf(pit);

  for (let k = 0; k < stones; k++) {
    pos = (pos + 1) % ring.length;
    const cell = ring[pos];
    next = addCell(next, cell, 1);
    sowPath.push(cell);
  }

  const lastCell = sowPath[stones - 1];
  const ownStore = player === 0 ? STORE_A : STORE_B;
  let captured = 0;
  let extraTurn = false;

  if (lastCell === ownStore) {
    extraTurn = true;
  } else if (ownPit(player, lastCell) && cellValue(next, lastCell) === 1) {
    const across = opposite(lastCell);
    const taken = next.pits[across];
    if (taken > 0) {
      captured = taken + 1;
      next = addCell(next, lastCell, -1);
      next = addCell(next, across, -taken);
      next = addCell(next, ownStore, captured);
    }
  }

  let swept = 0;
  let sweptStore = 0;
  let over = false;

  if (sideTotal(next.pits, player) === 0 || sideTotal(next.pits, 1 - player) === 0) {
    over = true;
    sweptStore = sideTotal(next.pits, player) === 0 ? 1 - player : player;
    swept = sideTotal(next.pits, sweptStore);
    if (swept > 0) {
      const pits = next.pits.slice();
      const stores = next.stores.slice();
      SIDE[sweptStore].forEach(cell => {
        pits[cell] = 0;
      });
      stores[sweptStore] += swept;
      next = { pits, stores };
    }
  }

  return {
    board: next,
    sowPath,
    lastCell,
    captured,
    extraTurn,
    swept,
    sweptStore,
    over,
    nextPlayer: over || extraTurn ? player : 1 - player,
  };
};

const ringDistance = (player: number, cell: number) => {
  const ring = RING[player];
  const index = ring.indexOf(cell);
  return index < 0 ? 99 : (ring.length - index) % ring.length;
};

const tierOf = (out: MoveOut, player: number, originDist: number) => {
  if (out.captured > 0) return 0;
  if (out.lastCell === (player === 0 ? STORE_A : STORE_B)) return 1;
  if (ringDistance(player, out.lastCell) < originDist) return 2;
  return 3;
};

const evaluate = (board: Board, player: number) =>
  (board.stores[player] - board.stores[1 - player]) * 20 +
  (sideTotal(board.pits, player) - sideTotal(board.pits, 1 - player));

const leafValue = (out: MoveOut, player: number) =>
  evaluate(out.board, player) + out.captured * 0.5 + (out.extraTurn ? 0.5 : 0);

const moveValue = (board: Board, player: number, pit: number, depth: number): number => {
  const out = playMove(board, player, pit);
  if (!out) return -Infinity;
  if (depth <= 0) return leafValue(out, player);
  if (out.over) return evaluate(out.board, player);
  const reply = bestValue(out.board, out.nextPlayer, depth - 1);
  return out.nextPlayer === player ? reply : -reply;
};

const bestValue = (board: Board, player: number, depth: number): number => {
  const legal = legalPits(board.pits, player);
  let best = -Infinity;
  for (const pit of legal) {
    const value = moveValue(board, player, pit, depth);
    if (value > best) best = value;
  }
  return best === -Infinity ? evaluate(board, player) : best;
};

const chooseMove = (board: Board, player: number): number => {
  const legal = legalPits(board.pits, player);
  let best = -1;
  let bestTier = 9;
  let bestValue = -Infinity;
  for (const pit of legal) {
    const out = playMove(board, player, pit);
    if (!out) continue;
    const tier = tierOf(out, player, ringDistance(player, pit));
    if (tier > bestTier) continue;
    const value = moveValue(board, player, pit, AI_DEPTH);
    if (tier < bestTier || value > bestValue) {
      bestTier = tier;
      bestValue = value;
      best = pit;
    }
  }
  return best;
};

export const MancalaGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('mancala')!;
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [player, setPlayer] = useState(0);
  const [lastCell, setLastCell] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [vsAI, setVsAI] = useState(true);
  const [moves, setMoves] = useState(0);
  const timers = useRef<number[]>([]);

  const storeA = board.stores[0];
  const storeB = board.stores[1];
  const score = storeA * 100 + (storeA > storeB ? 300 : 0) + (vsAI ? 100 : 0);
  const won = storeA > storeB;

  const nameOf = (who: number) => (who === 0 ? 'Bạn' : vsAI ? 'Máy' : 'Người 2');

  const clearTimers = () => {
    timers.current.forEach(id => window.clearTimeout(id));
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const restart = () => {
    clearTimers();
    setBoard(createBoard());
    setPlayer(0);
    setLastCell(null);
    setNote(null);
    setBusy(false);
    setEnded(false);
    setMoves(0);
  };

  const runMove = (pit: number) => {
    if (busy || ended) return;
    const out = playMove(board, player, pit);
    if (!out) return;

    setBusy(true);
    setNote(null);
    setMoves(value => value + 1);
    setBoard(addCell(board, pit, -board.pits[pit]));
    setLastCell(null);
    playMoveSound();
    triggerHaptic(12);

    const finish = () => {
      later(() => {
        setBoard(out.board);
        setLastCell(out.lastCell);
        setBusy(false);
        if (out.over) {
          setEnded(true);
          if (out.swept > 0) setNote(`${nameOf(out.sweptStore)} quét ${out.swept} quân vào kho.`);
          playClearSound();
          return;
        }
        setPlayer(out.nextPlayer);
        if (out.captured > 0) {
          playScoreSound();
          setNote(`${nameOf(player)} ăn được ${out.captured} quân!`);
        } else if (out.extraTurn) {
          playScoreSound();
          setNote(`${nameOf(player)} rơi vào kho, được đi tiếp!`);
        } else {
          setNote(null);
        }
      }, out.captured > 0 || out.swept > 0 ? 360 : 220);
    };

    const path = out.sowPath;
    let index = 0;
    const step = () => {
      if (index >= path.length) {
        finish();
        return;
      }
      const cell = path[index];
      index += 1;
      setBoard(prev => addCell(prev, cell, 1));
      setLastCell(cell);
      if (index < path.length) playBounceSound();
      later(step, SOW_MS);
    };
    later(step, 150);
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!vsAI || ended || busy || player !== 1) return;
    const id = window.setTimeout(() => {
      const pit = chooseMove(board, 1);
      if (pit >= 0) runMove(pit);
    }, 480);
    return () => window.clearTimeout(id);
  }, [vsAI, ended, busy, player, board]);

  const tapPit = (cell: number) => {
    if (busy || ended) return;
    if (vsAI && player === 1) return;
    if (cell < PIT_COUNT && ownPit(player, cell) && board.pits[cell] > 0) runMove(cell);
  };

  const statusText = ended
    ? storeA === storeB
      ? `Hòa! ${storeA} – ${storeB}.`
      : `${won ? 'Bạn thắng' : `${nameOf(1)} thắng`} ${storeA} – ${storeB}.`
    : busy
      ? 'Đang rải quân…'
      : vsAI && player === 1
        ? 'Máy đang nghĩ…'
        : `Lượt của ${nameOf(player)} — chọn một hố thuộc hàng của bạn.`;

  const renderPit = (cell: number) => {
    const count = cellValue(board, cell);
    const side = cell < 6 ? 0 : 1;
    const mine = player === side;
    const playable =
      !busy && !ended && mine && (!vsAI || player === 0) && count > 0;
    const isLast = lastCell === cell;
    return (
      <button
        key={cell}
        type="button"
        onClick={() => tapPit(cell)}
        disabled={!playable}
        aria-label={`Hố ${side === 0 ? 'A' : 'B'}${side === 0 ? cell + 1 : cell - 5}: ${count} quân`}
        title={`${side === 0 ? 'A' : 'B'}${side === 0 ? cell + 1 : cell - 5} — ${count} quân`}
        className="w-full aspect-square rounded-full border text-xs font-black transition duration-150 active:translate-y-[2px]"
        style={{
          gridArea: pitGridArea(cell),
          background: isLast ? 'rgba(250, 204, 21, 0.22)' : 'var(--game-control-bg)',
          borderColor: isLast ? '#facc15' : 'var(--game-control-border)',
          outline: isLast ? '2px solid #facc15' : 'none',
          color: isLast ? '#fde68a' : count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          opacity: mine ? 1 : 0.7,
        }}
      >
        {count}
      </button>
    );
  };

  const renderStore = (side: number) => {
    const isLast = lastCell === (side === 0 ? STORE_A : STORE_B);
    const active = player === side;
    return (
      <div
        className="w-full rounded-2xl border-2 grid place-items-center content-center gap-0.5"
        style={{
          gridArea: storeGridArea(side),
          background: side === 0 ? '#4f46e5' : '#0d9488',
          borderColor: isLast ? '#facc15' : side === 0 ? '#4338ca' : '#0f766e',
        }}
        title={`Kho ${side === 0 ? 'A' : 'B'}: ${board.stores[side]} quân`}
      >
        <span className="text-[9px] font-black uppercase text-white/80 leading-none">
          {side === 0 ? 'A' : 'B'}
        </span>
        <span className="text-lg font-black text-white leading-none">{board.stores[side]}</span>
        <span
          className="text-[8px] font-bold text-center leading-tight"
          style={{ color: active ? '#fde68a' : 'rgba(255,255,255,0.7)' }}
        >
          {nameOf(side)}
        </span>
      </div>
    );
  };

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
        <span className="text-[11px] theme-muted whitespace-nowrap">
          <span className="text-indigo-400 font-bold">{storeA}</span> –{' '}
          <span className="text-teal-400 font-bold">{storeB}</span> · {moves} nước
        </span>
      }
    >
      <div className="flex flex-col items-center gap-3 w-full px-1">
        <p className="text-sm font-bold theme-text text-center">{statusText}</p>
        <p className="text-[11px] theme-muted text-center leading-snug">
          Rơi quân cuối vào kho của bạn để đi tiếp. Rơi vào hố trống đối diện hố có quân để ăn.
        </p>

        <div className="w-full max-w-[440px]">
          <div
            className="rounded-3xl p-2.5 sm:p-3"
            style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-color)' }}
          >
            <div className="grid grid-cols-8 grid-rows-2 gap-1.5 sm:gap-2">
              {renderStore(1)}
              {[6, 7, 8, 9, 10, 11].map(renderPit)}
              {[0, 1, 2, 3, 4, 5].map(renderPit)}
              {renderStore(0)}
            </div>
          </div>
        </div>

        {note && (
          <p
            className="text-xs font-bold text-center animate-in fade-in duration-200"
            style={{ color: 'var(--accent)' }}
          >
            {note}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              setVsAI(value => !value);
            }}
            disabled={ended}
            className="px-3 py-1.5 rounded-xl border theme-border theme-text text-xs font-bold transition active:translate-y-[2px] disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)' }}
          >
            {vsAI ? 'Chế độ: vs Máy' : 'Chế độ: 2 người'}
          </button>
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              restart();
            }}
            className="px-3 py-1.5 rounded-xl border theme-border theme-text text-xs font-bold transition active:translate-y-[2px]"
            style={{ background: 'var(--game-control-bg)' }}
          >
            Chia lại
          </button>
        </div>
      </div>
    </GameShell>
  );
};
