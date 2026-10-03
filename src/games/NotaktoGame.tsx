import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Bot, Users, Undo2, Skull } from 'lucide-react';

type Mode = 'pvp' | 'ai';
type SizeId = 'small' | 'medium' | 'large';

interface Size {
  id: SizeId;
  label: string;
  n: number;
}

interface Snapshot {
  cells: number[];
  moves: number;
  lastIndex: number;
  ended: boolean;
  loser: number;
}

const SIZES: Size[] = [
  { id: 'small', label: 'Dễ 3', n: 3 },
  { id: 'medium', label: 'Trung bình 5', n: 5 },
  { id: 'large', label: 'Khó 7', n: 7 },
];

const memo = new Map<string, boolean>();

export function emptyCells(n: number): number[] {
  return Array(n).fill(0);
}

export function runsFromCells(cells: number[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const c of cells) {
    if (c === 0) run += 1;
    else {
      if (run > 0) runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  runs.sort((a, b) => a - b);
  return runs;
}

export function isWinning(pos: number[]): boolean {
  if (pos.length === 0) return true;
  const key = pos.join(',');
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  for (let i = 0; i < pos.length; i++) {
    const len = pos[i];
    for (let s = 0; s < len; s++) {
      const rest = pos.slice();
      rest.splice(i, 1);
      if (s > 0) rest.push(s);
      if (len - 1 - s > 0) rest.push(len - 1 - s);
      rest.sort((a, b) => a - b);
      if (!isWinning(rest)) {
        memo.set(key, true);
        return true;
      }
    }
  }
  memo.set(key, false);
  return false;
}

export function emptyCellsOf(cells: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === 0) out.push(i);
  return out;
}

export function chooseAIMove(cells: number[]): number {
  const cands = emptyCellsOf(cells);
  if (cands.length === 0) return -1;
  for (const i of cands) {
    const next = cells.slice();
    next[i] = 1;
    if (!isWinning(runsFromCells(next))) return i;
  }
  return cands[Math.floor(Math.random() * cands.length)];
}

export const NotaktoGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [size, setSize] = useState<SizeId>('small');
  const [mode, setMode] = useState<Mode>('ai');
  const [cells, setCells] = useState<number[]>(() => emptyCells(3));
  const [moves, setMoves] = useState(0);
  const [lastIndex, setLastIndex] = useState(-1);
  const [ended, setEnded] = useState(false);
  const [loser, setLoser] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);

  const n = cells.length;
  const turn = (moves % 2) + 1;
  const won = ended && loser === 2;

  const restart = useCallback((nextSize?: SizeId, nextMode?: Mode) => {
    const id = nextSize ?? size;
    setSize(id);
    if (nextMode) setMode(nextMode);
    setCells(emptyCells(SIZES.find((s) => s.id === id)!.n));
    setMoves(0);
    setLastIndex(-1);
    setEnded(false);
    setLoser(0);
    setHistory([]);
  }, [size]);

  const play = useCallback((index: number) => {
    if (ended || cells[index] !== 0) return;
    const player = (moves % 2) + 1;
    const next = cells.slice();
    next[index] = 1;
    const full = next.every((c) => c !== 0);
    setHistory((h) => [...h, { cells, moves, lastIndex, ended, loser }]);
    setCells(next);
    setMoves(moves + 1);
    setLastIndex(index);
    setEnded(full);
    setLoser(full ? player : 0);
    playMoveSound();
    triggerHaptic();
    if (full) playScoreSound();
  }, [cells, moves, lastIndex, ended, loser]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const back = history.length >= 2 ? 2 : 1;
    const snap = history[history.length - back];
    setCells(snap.cells);
    setMoves(snap.moves);
    setLastIndex(snap.lastIndex);
    setEnded(snap.ended);
    setLoser(snap.loser);
    setHistory(history.slice(0, history.length - back));
    playMoveSound();
  }, [history]);

  useEffect(() => {
    if (mode !== 'ai' || ended || (moves % 2) + 1 !== 2) return;
    const t = setTimeout(() => {
      const idx = chooseAIMove(cells);
      if (idx >= 0) play(idx);
    }, 320);
    return () => clearTimeout(t);
  }, [mode, ended, moves, cells, play]);

  const score = useMemo(() => {
    if (!ended) return Math.max(0, 600 - moves * 15);
    return Math.max(30, 600 - moves * 15) + (mode === 'ai' && won ? 200 : 0);
  }, [ended, moves, mode, won]);

  const playerName = (p: number) => (mode === 'ai' ? (p === 1 ? 'Bạn' : 'Máy') : `Người chơi ${p}`);

  const endText = ended
    ? loser === 1
      ? 'Bạn đã đặt X cuối cùng và thua!'
      : mode === 'ai'
        ? 'Máy đặt X cuối cùng — bạn thắng!'
        : 'Người chơi 2 đặt X cuối cùng — Người chơi 1 thắng!'
    : '';

  return (
    <GameShell
      game={getGameById('notakto')!}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={() => restart()}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <span>Ô vuông: {n} · Nước: {moves}/{n}</span>
      }
    >
      <div className="flex w-full flex-col items-center gap-3">
        <p className="theme-muted text-center text-xs">
          Người đặt X cuối cùng sẽ thua. Ai đặt X hết hàng thì thua ngay.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => restart(s.id, mode)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:translate-y-[2px] ${
                size === s.id ? 'theme-panel-strong' : 'theme-panel-soft'
              }`}
              style={size === s.id ? { borderColor: 'var(--accent)' } : undefined}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => restart(size, mode === 'ai' ? 'pvp' : 'ai')}
            className="theme-panel-soft flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:translate-y-[2px]"
          >
            {mode === 'ai' ? <Bot size={14} /> : <Users size={14} />}
            {mode === 'ai' ? 'Đấu máy' : 'Hai người'}
          </button>
        </div>

        <div className="theme-panel-soft flex w-full flex-col items-center gap-1 rounded-xl border px-3 py-2">
          <span className="theme-text text-sm font-semibold">
            {ended ? `Kết thúc: ${playerName(loser)} thua` : `Lượt ${turn}: ${playerName(turn)}`}
          </span>
          <span className="theme-muted text-xs">Số nước đã đi: {moves} · Còn trống: {n - moves}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => play(i)}
              disabled={ended || c !== 0}
              aria-label={`Ô ${i + 1}`}
              className="flex h-14 w-14 items-center justify-center rounded-lg border-2 text-2xl font-black transition active:translate-y-[2px] disabled:opacity-100 sm:h-16 sm:w-16"
              style={{
                background: c === 1 ? 'var(--accent)' : 'var(--surface-soft)',
                borderColor: ended && i === lastIndex ? '#facc15' : 'var(--border-color)',
                color: c === 1 ? '#1c1226' : 'var(--text-primary)',
                outline: ended && i === lastIndex ? '2px solid #ef4444' : 'none',
              }}
            >
              {c === 1 ? 'X' : ''}
            </button>
          ))}
        </div>

        {ended && (
          <div className="theme-panel-soft flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold" style={{ color: '#ef4444' }}>
            <Skull size={16} />
            <span>{endText}</span>
          </div>
        )}

        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0 || ended}
          className="theme-panel-soft flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:translate-y-[2px] disabled:opacity-40"
        >
          <Undo2 size={14} />
          Hoàn tác 1 lượt (2 nước)
        </button>
      </div>
    </GameShell>
  );
};