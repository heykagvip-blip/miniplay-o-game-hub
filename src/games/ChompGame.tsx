import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Bot, Users, RotateCcw, Undo2, Skull } from 'lucide-react';

type ChompMode = 'pvp' | 'ai';
type ChompSizeId = 'small' | 'medium' | 'large';

interface ChompSnapshot {
  rows: number[];
  turn: number;
  movesUsed: number;
}

interface ChompSize {
  id: ChompSizeId;
  label: string;
  R: number;
  C: number;
}

const CHOMP_SIZES: ChompSize[] = [
  { id: 'small', label: 'Nhỏ 3×4', R: 3, C: 4 },
  { id: 'medium', label: 'Vừa 5×6', R: 5, C: 6 },
  { id: 'large', label: 'Lớn 6×8', R: 6, C: 8 },
];

export function createInitialRows(R: number, C: number): number[] {
  return Array.from({ length: R }, () => C);
}

export function isPoisonCell(r: number, c: number): boolean {
  return r === 0 && c === 0;
}

export function applyChompMove(rows: number[], r: number, c: number): number[] {
  const next = rows.slice();
  for (let i = r; i < next.length; i++) {
    const limit = i === 0 ? Math.max(c, 1) : c;
    if (next[i] > limit) next[i] = limit;
  }
  return next;
}

export function legalChompMoves(rows: number[]): Array<[number, number]> {
  const moves: Array<[number, number]> = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r]; c++) {
      if (isPoisonCell(r, c)) continue;
      moves.push([r, c]);
    }
  }
  return moves;
}

export function isOnlyPoisonLeft(rows: number[]): boolean {
  if (rows.length === 0 || rows[0] !== 1) return false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] !== 0) return false;
  }
  return true;
}

export function countRemaining(rows: number[]): number {
  let total = 0;
  for (const v of rows) total += v;
  return total;
}

export function isSymmetricShape(rows: number[]): boolean {
  const width = rows[0] || 0;
  if (width !== rows.length) return false;
  for (let j = 0; j < width; j++) {
    let height = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] > j) height++;
    }
    if (height !== rows[j]) return false;
  }
  return true;
}

export function isTwoRowPPosition(rows: number[]): boolean {
  return rows.length === 2 && rows[1] >= 1 && rows[0] === rows[1] + 1;
}

export function isNimSumZero(rows: number[]): boolean {
  let xor = 0;
  for (const v of rows) {
    if (v > 0) xor ^= v - 1;
  }
  return xor === 0;
}

export function isFullRectangle(rows: number[]): boolean {
  return (
    rows.length > 0 &&
    rows[0] >= 2 &&
    countRemaining(rows) >= 2 &&
    rows.every(v => v === rows[0])
  );
}

export function isMirrorL(rows: number[]): boolean {
  return (
    rows.length >= 2 &&
    rows[0] === rows.length &&
    rows.every((v, i) => i === 0 || v === 1)
  );
}

export function opponentCanWinImmediately(rows: number[]): boolean {
  const replies = legalChompMoves(rows);
  for (const reply of replies) {
    if (isOnlyPoisonLeft(applyChompMove(rows, reply[0], reply[1]))) return true;
  }
  return false;
}

function opponentHasStrongReply(rows: number[]): boolean {
  const replies = legalChompMoves(rows);
  for (const reply of replies) {
    const after = applyChompMove(rows, reply[0], reply[1]);
    if (isMirrorL(after) || isTwoRowPPosition(after)) return true;
  }
  return false;
}

export function chooseChompAiMove(rows: number[]): [number, number] {
  const moves = legalChompMoves(rows);
  if (moves.length === 0) return [0, 0];
  for (const move of moves) {
    if (isOnlyPoisonLeft(applyChompMove(rows, move[0], move[1]))) return move;
  }
  const before = countRemaining(rows);
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyChompMove(rows, move[0], move[1]);
    let score = 0;
    if (opponentCanWinImmediately(next)) score -= 1000000000;
    if (isMirrorL(next)) score += 1000000;
    if (isTwoRowPPosition(next)) score += 1000000;
    if (isNimSumZero(next)) score += 500000;
    if (isFullRectangle(next)) score -= 2000000;
    if (isSymmetricShape(next)) score += 200000;
    if (opponentHasStrongReply(next)) score -= 20000;
    score -= (before - countRemaining(next)) * 2;
    score += Math.random() * 3;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

export function computeChompScore(movesUsed: number, R: number, C: number, beatAi: boolean): number {
  const base = 1000;
  const par = R + C;
  const efficiency = Math.max(0, par - movesUsed + 2) * 40;
  const aiBonus = beatAi ? 250 : 0;
  return base + efficiency + aiBonus;
}

export function computeChompConsolation(movesUsed: number): number {
  return 25 + 15 * Math.ceil(movesUsed / 2);
}

interface ChompGameProps {
  onBackToHub: () => void;
}

export const ChompGame: React.FC<ChompGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('chomp')!;

  const [mode, setMode] = useState<ChompMode>('pvp');
  const [sizeId, setSizeId] = useState<ChompSizeId>('medium');
  const [dims, setDims] = useState<{ R: number; C: number }>({ R: 5, C: 6 });
  const [rows, setRows] = useState<number[]>(() => createInitialRows(5, 6));
  const [turn, setTurn] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [movesUsed, setMovesUsed] = useState(0);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<ChompSnapshot[]>([]);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const aiThinkingRef = useRef(false);

  const newGame = useCallback((R: number, C: number) => {
    setDims({ R, C });
    setRows(createInitialRows(R, C));
    setTurn(0);
    setWinner(null);
    setMovesUsed(0);
    setScore(0);
    setHistory([]);
    setHover(null);
  }, []);

  const restart = useCallback(() => {
    newGame(dims.R, dims.C);
  }, [dims, newGame]);

  const selectMode = (next: ChompMode) => {
    setMode(next);
    newGame(dims.R, dims.C);
  };

  const selectSize = (id: ChompSizeId, R: number, C: number) => {
    setSizeId(id);
    newGame(R, C);
  };

  const doMove = (r: number, c: number) => {
    if (winner !== null) return;
    if (mode === 'ai' && turn !== 0) return;
    if (r < 0 || r >= rows.length || c < 0 || c >= rows[r]) return;
    if (isPoisonCell(r, c)) return;
    setHistory(prev => [...prev, { rows, turn, movesUsed }]);
    const next = applyChompMove(rows, r, c);
    const used = movesUsed + 1;
    setRows(next);
    setMovesUsed(used);
    playMoveSound();
    triggerHaptic(12);
    if (isOnlyPoisonLeft(next)) {
      playClearSound();
      const winnerIdx = turn;
      setWinner(winnerIdx);
      const humanWon = mode === 'ai' ? winnerIdx === 0 : true;
      setScore(
        humanWon
          ? computeChompScore(used, dims.R, dims.C, mode === 'ai')
          : computeChompConsolation(used)
      );
      playScoreSound();
      triggerHaptic(40);
    } else {
      setTurn(1 - turn);
    }
  };

  const doMoveRef = useRef(doMove);
  doMoveRef.current = doMove;

  useEffect(() => {
    if (mode !== 'ai' || winner !== null || turn !== 1) return;
    aiThinkingRef.current = true;
    const timer = window.setTimeout(() => {
      const move = chooseChompAiMove(rows);
      aiThinkingRef.current = false;
      doMoveRef.current(move[0], move[1]);
    }, 550);
    return () => {
      window.clearTimeout(timer);
      aiThinkingRef.current = false;
    };
  }, [mode, winner, turn, rows]);

  const undo = () => {
    if (winner !== null || history.length === 0) return;
    if (mode === 'ai' && (turn !== 0 || aiThinkingRef.current)) return;
    const target = history.length >= 2 ? history.length - 2 : 0;
    const snap = history[target];
    setRows(snap.rows);
    setTurn(snap.turn);
    setMovesUsed(snap.movesUsed);
    setHistory(history.slice(0, target));
    setScore(0);
    setHover(null);
    playMoveSound();
  };

  const remaining = countRemaining(rows);
  const canHumanMove = winner === null && (mode === 'pvp' || turn === 0);
  const humanWon = winner === null ? false : mode === 'pvp' || winner === 0;

  const turnLabel =
    mode === 'pvp'
      ? `Người chơi ${turn + 1}`
      : turn === 0
        ? 'Bạn'
        : 'Máy tính';
  const turnColor =
    mode === 'pvp'
      ? turn === 0
        ? '#818cf8'
        : '#fb7185'
      : turn === 0
        ? '#818cf8'
        : '#fbbf24';

  let resultText = '';
  if (winner !== null) {
    if (mode === 'pvp') {
      resultText = `Người chơi ${winner + 1} thắng — đối thủ bị buộc phải ăn ô độc!`;
    } else if (winner === 0) {
      resultText = `Bạn thắng! Máy tính bị buộc ăn ô độc (+${score.toLocaleString('vi-VN')} điểm).`;
    } else {
      resultText = 'Máy tính thắng — bạn đã bị buộc ăn ô độc.';
    }
  }

  const cells: React.ReactNode[] = [];
  for (let r = dims.R - 1; r >= 0; r--) {
    for (let c = 0; c < rows[r]; c++) {
      const poison = isPoisonCell(r, c);
      const preview = canHumanMove && hover !== null && !poison && r >= hover[0] && c >= hover[1];
      const hovered = canHumanMove && hover !== null && hover[0] === r && hover[1] === c;
      const highlighted = preview || hovered;
      cells.push(
        <button
          key={`${r}-${c}`}
          type="button"
          aria-label={poison ? 'Ô độc' : `Ô hàng ${r + 1} cột ${c + 1}`}
          title={poison ? 'Ô độc — ai bị buộc ăn ô này thì thua' : 'Chạm để ăn ô này'}
          onClick={() => doMove(r, c)}
          onMouseEnter={() => {
            if (canHumanMove) setHover([r, c]);
          }}
          onMouseLeave={() => setHover(null)}
          className={`aspect-square w-full rounded-[4px] border transition-colors duration-100 select-none game-btn-press flex items-center justify-center ${
            poison ? 'animate-pulse' : ''
          }`}
          style={{
            background: poison ? '#dc2626' : highlighted ? '#f59e0b' : '#b45309',
            borderColor: poison ? '#7f1d1d' : highlighted ? '#fde68a' : '#78350f',
            outline: preview ? '2px solid #fde68a' : 'none',
            outlineOffset: -2,
            cursor: canHumanMove ? 'pointer' : 'default',
          }}
        >
          {poison && <Skull className="w-1/2 h-1/2 text-white" strokeWidth={2.5} />}
        </button>
      );
    }
  }

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={winner !== null}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      isVictory={humanWon}
      gameCustomStats={
        <div
          className="px-3 py-1 rounded-xl border theme-border flex items-center gap-2"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">Nước đi:</span>
          <span className="text-sm font-bold text-emerald-400">{movesUsed}</span>
        </div>
      }
    >
      <div className="w-full max-w-md mx-auto flex flex-col items-center gap-3 px-1 py-1">
        <div
          className="flex w-full rounded-2xl border theme-border p-1"
          style={{ background: 'var(--surface-soft)' }}
        >
          <button
            type="button"
            onClick={() => selectMode('pvp')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition game-btn-press ${
              mode === 'pvp' ? 'bg-indigo-600 text-white' : 'theme-text hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            2 Người
          </button>
          <button
            type="button"
            onClick={() => selectMode('ai')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition game-btn-press ${
              mode === 'ai' ? 'bg-indigo-600 text-white' : 'theme-text hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Đấu Máy
          </button>
        </div>

        <div
          className="flex w-full rounded-2xl border theme-border p-1"
          style={{ background: 'var(--surface-soft)' }}
        >
          {CHOMP_SIZES.map(size => (
            <button
              key={size.id}
              type="button"
              onClick={() => selectSize(size.id, size.R, size.C)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition game-btn-press ${
                sizeId === size.id ? 'bg-amber-500 text-slate-950' : 'theme-text hover:bg-white/5'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>

        <div className="w-full flex flex-wrap items-center justify-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border theme-border"
            style={{ background: 'var(--surface-strong)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Lượt:</span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-black"
              style={{
                background: `${turnColor}22`,
                color: turnColor,
                outline: `1px solid ${turnColor}66`,
              }}
            >
              {turnLabel}
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border theme-border"
            style={{ background: 'var(--surface-strong)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Còn lại:</span>
            <span className="text-sm font-black text-amber-400">{remaining} ô</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border theme-border"
            style={{ background: 'var(--surface-strong)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Bảng:</span>
            <span className="text-sm font-black text-sky-400">
              {dims.R}×{dims.C}
            </span>
          </div>
        </div>

        {mode === 'ai' && turn === 1 && winner === null && (
          <div className="text-[11px] font-semibold text-amber-400 animate-pulse">
            Máy tính đang suy nghĩ…
          </div>
        )}

        {winner !== null && (
          <div
            className="w-full px-3 py-2 rounded-xl border text-center text-xs font-bold"
            style={{
              background: humanWon ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)',
              borderColor: humanWon ? '#34d399' : '#f87171',
              color: humanWon ? '#34d399' : '#f87171',
            }}
          >
            {resultText}
          </div>
        )}

        <div
          className="w-full rounded-3xl border theme-border p-2.5 sm:p-3"
          style={{ background: 'var(--game-surface-bg)' }}
        >
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${dims.C}, minmax(0, 1fr))` }}
          >
            {cells}
          </div>
        </div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={winner !== null || history.length === 0 || (mode === 'ai' && turn !== 0)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border theme-border theme-panel-soft theme-text text-xs font-bold transition game-btn-press disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Hoàn tác cặp
          </button>
          <button
            type="button"
            onClick={restart}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border theme-border theme-panel-soft theme-text text-xs font-bold transition game-btn-press"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại
          </button>
        </div>

        <p className="text-[11px] theme-muted text-center leading-relaxed">
          Ô đỏ ☠ ở góc dưới trái là ô độc. Chọn một ô để ăn nó cùng mọi ô phía trên và bên phải.
          Ai bị buộc ăn ô độc thì thua.
        </p>
      </div>
    </GameShell>
  );
};
