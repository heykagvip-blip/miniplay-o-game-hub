import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';

type Stone = 0 | 1 | 2;
type Player = 1 | 2;
type Difficulty = 'easy' | 'medium' | 'hard';

const SIZE = 15;
const CELLS = SIZE * SIZE;
const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];
const WIN_LEN = 5;
const STEP = 100 / SIZE;
const BLACK = '#0f172a';
const WHITE = '#f8fafc';
const STARTS: [number, number][] = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];

const SHAPE_FIVE = 10000000;
const SHAPE_OPEN_FOUR = 1200000;
const SHAPE_FOUR = 120000;
const SHAPE_OPEN_THREE = 30000;
const SHAPE_THREE = 3000;
const SHAPE_OPEN_TWO = 500;
const SHAPE_TWO = 50;
const SHAPE_ONE = 5;
const DEFENSE_WEIGHT = 0.92;
const NEIGHBOUR_BONUS = 240;
const URGENCY_FOUR = 240000;

const DIFFICULTY_LABELS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Dễ' },
  { key: 'medium', label: 'Trung bình' },
  { key: 'hard', label: 'Khó' },
];

const emptyBoard = (): Stone[] => new Array<Stone>(CELLS).fill(0);

const cellAt = (board: Stone[], r: number, c: number): number => {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return -1;
  return board[r * SIZE + c];
};

const countStones = (board: Stone[]): number => {
  let n = 0;
  for (let i = 0; i < CELLS; i += 1) if (board[i] !== 0) n += 1;
  return n;
};

const lineShape = (board: Stone[], r: number, c: number, dr: number, dc: number, player: Stone) => {
  let count = 0;
  let ends = 0;
  let rr = r + dr;
  let cc = c + dc;
  while (cellAt(board, rr, cc) === player) {
    count += 1;
    rr += dr;
    cc += dc;
  }
  if (cellAt(board, rr, cc) === 0) ends += 1;
  rr = r - dr;
  cc = c - dc;
  while (cellAt(board, rr, cc) === player) {
    count += 1;
    rr -= dr;
    cc -= dc;
  }
  if (cellAt(board, rr, cc) === 0) ends += 1;
  return { count, ends };
};

const shapeValue = (count: number, ends: number): number => {
  const total = count + 1;
  if (total >= WIN_LEN) return SHAPE_FIVE;
  if (total === 4) return ends === 2 ? SHAPE_OPEN_FOUR : SHAPE_FOUR;
  if (total === 3) return ends === 2 ? SHAPE_OPEN_THREE : SHAPE_THREE;
  if (total === 2) return ends === 2 ? SHAPE_OPEN_TWO : SHAPE_TWO;
  return SHAPE_ONE * ends;
};

const threatAt = (board: Stone[], r: number, c: number, player: Stone) => {
  const dirs: number[] = [];
  let score = 0;
  let win = false;
  let unstoppable = false;
  for (let d = 0; d < DIRS.length; d += 1) {
    const shape = lineShape(board, r, c, DIRS[d][0], DIRS[d][1], player);
    const value = shapeValue(shape.count, shape.ends);
    dirs.push(value);
    score += value;
    if (shape.count + 1 >= WIN_LEN) win = true;
    if (shape.count + 1 === 4 && shape.ends === 2) unstoppable = true;
    if (shape.count + 1 >= 5) unstoppable = true;
  }
  let fours = 0;
  let threes = 0;
  for (let d = 0; d < dirs.length; d += 1) {
    if (dirs[d] >= SHAPE_FOUR) fours += 1;
    else if (dirs[d] >= SHAPE_OPEN_THREE) threes += 1;
  }
  return { score, win, unstoppable, double: fours >= 2 || (fours >= 1 && threes >= 1) };
};

const defenceUrgency = (threat: number): number => {
  if (threat >= SHAPE_FOUR) return URGENCY_FOUR;
  return 0;
};

const filledNeighbours = (board: Stone[], r: number, c: number): number => {
  let n = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      if (cellAt(board, r + dr, c + dc) !== 0) n += 1;
    }
  }
  return n;
};

const centreBias = (r: number, c: number, weight: number): number => {
  if (weight <= 0) return 0;
  const mid = (SIZE - 1) / 2;
  const dist = Math.max(Math.abs(r - mid), Math.abs(c - mid));
  return weight * (mid - dist);
};

interface Candidate {
  idx: number;
  shape: number;
  extra: number;
  rank: number;
  own: number;
  foe: number;
  win: boolean;
  blockWin: boolean;
  unstoppable: boolean;
  double: boolean;
}

const evaluateMove = (board: Stone[], idx: number, player: Player, centre: number): Candidate => {
  const foe: Player = player === 1 ? 2 : 1;
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const own = threatAt(board, r, c, player);
  const foeThreat = threatAt(board, r, c, foe);
  const shape = own.score + DEFENSE_WEIGHT * foeThreat.score + defenceUrgency(foeThreat.score);
  const extra = NEIGHBOUR_BONUS * filledNeighbours(board, r, c) + centreBias(r, c, centre);
  return {
    idx,
    shape,
    extra,
    rank: shape * 100000 + extra,
    own: own.score,
    foe: foeThreat.score,
    win: own.win,
    blockWin: foeThreat.win,
    unstoppable: own.unstoppable,
    double: own.double,
  };
};

const hasNearbyStone = (board: Stone[], r: number, c: number, range: number): boolean => {
  for (let dr = -range; dr <= range; dr += 1) {
    for (let dc = -range; dc <= range; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      if (cellAt(board, r + dr, c + dc) > 0) return true;
    }
  }
  return false;
};

const candidateCells = (board: Stone[], radius: number): number[] => {
  const stones = countStones(board);
  if (stones === 0) {
    const mid = (SIZE - 1) / 2;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) out.push((mid + dr) * SIZE + (mid + dc));
    }
    return out;
  }
  const near: number[] = [];
  const rest: number[] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r * SIZE + c] !== 0) continue;
      if (hasNearbyStone(board, r, c, radius)) near.push(r * SIZE + c);
      else rest.push(r * SIZE + c);
    }
  }
  return near.length > 0 ? near : rest;
};

const bestReplyScore = (board: Stone[], player: Player): number => {
  const cells = candidateCells(board, 1);
  let best = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const idx = cells[i];
    const own = threatAt(board, Math.floor(idx / SIZE), idx % SIZE, player);
    if (own.win) return SHAPE_FIVE;
    if (own.score > best) best = own.score;
  }
  return best;
};

const pickRandom = (list: number[]): number => list[Math.floor(Math.random() * list.length)];

const byRank = (a: Candidate, b: Candidate) => b.rank - a.rank;

const topTied = (pool: Candidate[], limit: number): Candidate[] => {
  let best = -Infinity;
  for (let i = 0; i < pool.length; i += 1) if (pool[i].rank > best) best = pool[i].rank;
  const out: Candidate[] = [];
  for (let i = 0; i < pool.length && out.length < limit; i += 1) {
    if (pool[i].rank >= best - 0.5) out.push(pool[i]);
  }
  return out;
};

const chooseMove = (board: Stone[], player: Player, difficulty: Difficulty): number => {
  const stones = countStones(board);
  const centre = stones <= 2 ? 30 : stones <= 6 ? 8 : 0;
  const cells = candidateCells(board, 2);
  if (cells.length === 0) return -1;
  const evals: Candidate[] = cells.map((idx) => evaluateMove(board, idx, player, centre));
  const winning = evals.filter((e) => e.win);
  if (winning.length > 0) return pickRandom(winning.map((e) => e.idx));
  const blocking = evals.filter((e) => e.blockWin);
  const pool = blocking.length > 0 ? blocking : evals;

  if (difficulty === 'easy') {
    return pickRandom(pool.slice().sort(byRank).slice(0, 5).map((e) => e.idx));
  }

  if (difficulty === 'medium') {
    return pickRandom(topTied(pool, 6).map((e) => e.idx));
  }

  const shortlist = topTied(pool, 8);
  const replies = shortlist.map((cand) => {
    const probe = board.slice();
    probe[cand.idx] = player;
    const reply = bestReplyScore(probe, player === 1 ? 2 : 1);
    probe[cand.idx] = 0;
    return { cand, reply };
  });
  const safe = replies.filter((item) => item.cand.unstoppable || item.reply < SHAPE_OPEN_FOUR);
  const finalists = safe.length > 0 ? safe : replies;
  let bestValue = -Infinity;
  const best: number[] = [];
  for (let i = 0; i < finalists.length; i += 1) {
    const cand = finalists[i].cand;
    let value = cand.shape;
    if (cand.double) value += SHAPE_FOUR;
    const jittered = value + Math.random() * 400;
    if (jittered > bestValue + 0.5) {
      bestValue = jittered;
      best.length = 0;
      best.push(cand.idx);
    } else if (jittered > bestValue - 0.5) {
      best.push(cand.idx);
    }
  }
  return pickRandom(best);
};

const findWinLine = (board: Stone[], idx: number, player: Player): number[] | null => {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  for (let d = 0; d < DIRS.length; d += 1) {
    const dr = DIRS[d][0];
    const dc = DIRS[d][1];
    const line = [idx];
    let rr = r + dr;
    let cc = c + dc;
    while (cellAt(board, rr, cc) === player) {
      line.push(rr * SIZE + cc);
      rr += dr;
      cc += dc;
    }
    rr = r - dr;
    cc = c - dc;
    while (cellAt(board, rr, cc) === player) {
      line.push(rr * SIZE + cc);
      rr -= dr;
      cc -= dc;
    }
    if (line.length >= WIN_LEN) return line;
  }
  return null;
};

interface MoveRecord {
  idx: number;
  player: Player;
}

interface PlayResult {
  board: Stone[];
  line: number[] | null;
  winner: Stone;
}

const playStone = (board: Stone[], idx: number, player: Player): PlayResult => {
  const next = board.slice();
  next[idx] = player;
  const line = findWinLine(next, idx, player);
  return { board: next, line, winner: line !== null ? player : 0 };
};

const StoneDot: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <span
    className="block rounded-full"
    style={{
      width: size,
      height: size,
      background: color,
      outline: `1px solid ${color === BLACK ? 'rgba(148,163,184,0.45)' : '#94a3b8'}`,
    }}
  />
);

export const GomokuGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [board, setBoard] = useState<Stone[]>(() => emptyBoard());
  const [turn, setTurn] = useState<Player>(1);
  const [history, setHistory] = useState<MoveRecord[]>([]);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [winner, setWinner] = useState<Stone>(0);
  const [vsAI, setVsAI] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number>(7 * SIZE + 7);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const stats = useMemo(() => {
    let black = 0;
    let white = 0;
    for (let i = 0; i < CELLS; i += 1) {
      if (board[i] === 1) black += 1;
      else if (board[i] === 2) white += 1;
    }
    const moves = black + white;
    const score = Math.max(50, winner === 1 ? 1000 - moves * 10 : moves * 10 + white * 3);
    return { black, white, moves, score };
  }, [board, winner]);

  const moves = stats.moves;
  const over = winner !== 0 || moves >= CELLS;

  const restart = useCallback(() => {
    setBoard(emptyBoard());
    setTurn(1);
    setHistory([]);
    setLastMove(null);
    setWinLine(null);
    setWinner(0);
    setCursor(7 * SIZE + 7);
    playMoveSound();
  }, []);

  const place = useCallback((current: Stone[], idx: number, player: Player) => {
    if (current[idx] !== 0) return;
    const result = playStone(current, idx, player);
    setBoard(result.board);
    setHistory((h) => [...h, { idx, player }]);
    setLastMove(idx);
    setWinLine(result.line);
    setWinner(result.winner);
    if (result.line) {
      playScoreSound();
      triggerHaptic(35);
      return;
    }
    playMoveSound();
    triggerHaptic(15);
    setTurn(player === 1 ? 2 : 1);
  }, []);

  useEffect(() => {
    if (!vsAI || over || turn !== 2) return;
    const snapshot = board;
    const timer = window.setTimeout(() => {
      const idx = chooseMove(snapshot, 2, difficulty);
      if (idx >= 0) place(snapshot, idx, 2);
    }, 380);
    return () => window.clearTimeout(timer);
  }, [board, turn, vsAI, over, difficulty, place]);

  const handleCellClick = (idx: number) => {
    if (over || board[idx] !== 0) return;
    if (vsAI && turn !== 1) return;
    place(board, idx, turn);
  };

  const handleUndo = useCallback(() => {
    if (over || history.length === 0) return;
    const drop = history.length >= 2 ? 2 : 1;
    const keep = history.slice(0, history.length - drop);
    const next = emptyBoard();
    keep.forEach((m) => {
      next[m.idx] = m.player;
    });
    setHistory(keep);
    setBoard(next);
    setWinLine(null);
    setWinner(0);
    setLastMove(keep.length > 0 ? keep[keep.length - 1].idx : null);
    setTurn(keep.length === 0 ? 1 : keep[keep.length - 1].player === 1 ? 2 : 1);
    playMoveSound();
    triggerHaptic(15);
  }, [history, over]);

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
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'u', 'U'];
      if (keys.indexOf(e.key) === -1) return;
      e.preventDefault();
      const r = Math.floor(cursor / SIZE);
      const c = cursor % SIZE;
      if (e.key === 'ArrowUp') setCursor(Math.max(0, r - 1) * SIZE + c);
      else if (e.key === 'ArrowDown') setCursor(Math.min(SIZE - 1, r + 1) * SIZE + c);
      else if (e.key === 'ArrowLeft') setCursor(r * SIZE + Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCursor(r * SIZE + Math.min(SIZE - 1, c + 1));
      else if (e.key === 'u' || e.key === 'U') handleUndo();
      else handleCellClick(cursor);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const winSet = useMemo(() => {
    const set = new Set<number>();
    if (winLine) winLine.forEach((i) => set.add(i));
    return set;
  }, [winLine]);

  const cells = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < CELLS; i += 1) out.push(i);
    return out;
  }, []);

  const lines = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < SIZE; i += 1) out.push((i / (SIZE - 1)) * 100);
    return out;
  }, []);

  const statusText = over
    ? winner === 0
      ? 'HÒA! Bàn cờ đã đầy mà không ai thắng.'
      : winner === 1
        ? 'BẠN THẮNG! Đã có 5 quân liền nhau.'
        : vsAI
          ? 'Máy đã thắng. Bấm “Đi lại” để thử lại.'
          : 'Người 2 (Trắng) thắng! Đã có 5 quân liền nhau.'
    : turn === 1
      ? vsAI
        ? 'Lượt của bạn — đặt quân Đen'
        : 'Lượt Người 1 — đặt quân Đen'
      : vsAI
        ? 'Máy đang suy nghĩ…'
        : 'Lượt Người 2 — đặt quân Trắng';

  const statusColor = over
    ? winner === 1
      ? '#22c55e'
      : winner === 0
        ? '#f59e0b'
        : '#ef4444'
    : turn === 1
      ? '#3b82f6'
      : '#f59e0b';

  const aiLabel = DIFFICULTY_LABELS.find((d) => d.key === difficulty)?.label ?? 'Trung bình';

  return (
    <GameShell
      game={getGameById('gomoku')!}
      score={stats.score}
      isGameOver={over}
      isVictory={winner === 1}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div
          className="px-2.5 py-1 rounded-xl border theme-border flex items-center gap-1.5"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">15×15</span>
          <span className="text-xs font-black theme-text">{moves} nước</span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-2 w-full px-1">
        <div className="w-full max-w-[560px] rounded-2xl border theme-border p-1.5 flex flex-wrap items-center gap-1.5" style={{ background: 'var(--game-control-bg)' }}>
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              setVsAI((v) => !v);
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition game-btn-press border ${
              vsAI ? 'bg-emerald-600 text-white border-emerald-500' : 'theme-panel-soft theme-text theme-border'
            }`}
          >
            {vsAI ? 'AI: Bật' : 'AI: Tắt'}
          </button>
          <div className="flex items-center gap-1">
            {DIFFICULTY_LABELS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  playMoveSound();
                  setDifficulty(d.key);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition game-btn-press ${
                  difficulty === d.key ? 'bg-indigo-600 text-white' : 'theme-panel-soft theme-text'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={handleUndo}
              disabled={over || history.length === 0}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold theme-panel-soft theme-text border theme-border transition game-btn-press disabled:opacity-40"
            >
              Đi lại
            </button>
            <button
              type="button"
              onClick={restart}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition game-btn-press"
            >
              Chơi lại
            </button>
          </div>
        </div>

        <div
          className="w-full max-w-[560px] px-3 py-2 rounded-2xl border theme-border flex items-center gap-2 flex-wrap"
          style={{ background: 'var(--game-status-bg)' }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{
              background: turn === 1 ? BLACK : WHITE,
              outline: `2px solid ${statusColor}`,
            }}
          />
          <span className="text-[11px] sm:text-xs font-bold" style={{ color: statusColor }}>
            {statusText}
          </span>
          <span className="ml-auto flex items-center gap-2.5 text-[10px] font-bold theme-muted">
            <span className="flex items-center gap-1">
              <StoneDot color={BLACK} size={9} />
              Đen {stats.black}
            </span>
            <span className="flex items-center gap-1">
              <StoneDot color={WHITE} size={9} />
              Trắng {stats.white}
            </span>
            <span>{vsAI ? `AI ${aiLabel}` : '2 người'}</span>
          </span>
        </div>

        <div
          className="w-full max-w-[560px] rounded-3xl border theme-border p-2 sm:p-3"
          style={{ background: 'var(--game-surface-bg)' }}
        >
          <div
            ref={boardRef}
            tabIndex={0}
            className="relative w-full outline-none select-none"
            style={{ aspectRatio: '1 / 1', touchAction: 'manipulation' }}
          >
            <div
              className="absolute pointer-events-none"
              style={{ left: `${STEP / 2}%`, right: `${STEP / 2}%`, top: `${STEP / 2}%`, bottom: `${STEP / 2}%` }}
            >
              {lines.map((pct) => (
                <React.Fragment key={pct}>
                  <span
                    className="absolute"
                    style={{
                      left: `${pct}%`,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      transform: 'translateX(-0.5px)',
                      background: 'var(--border-color)',
                    }}
                  />
                  <span
                    className="absolute"
                    style={{
                      top: `${pct}%`,
                      left: 0,
                      right: 0,
                      height: 1,
                      transform: 'translateY(-0.5px)',
                      background: 'var(--border-color)',
                    }}
                  />
                </React.Fragment>
              ))}
              {STARTS.map(([r, c]) => (
                <span
                  key={`${r}-${c}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${(c / (SIZE - 1)) * 100}%`,
                    top: `${(r / (SIZE - 1)) * 100}%`,
                    width: 5,
                    height: 5,
                    transform: 'translate(-50%, -50%)',
                    background: 'var(--text-muted)',
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>

            {cells.map((idx) => {
              const r = Math.floor(idx / SIZE);
              const c = idx % SIZE;
              const value = board[idx];
              const isWin = winSet.has(idx);
              const isLast = lastMove === idx;
              const isCursor = cursor === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCellClick(idx)}
                  onMouseEnter={() => setHover(idx)}
                  onMouseLeave={() => setHover((h) => (h === idx ? null : h))}
                  onFocus={() => setCursor(idx)}
                  aria-label={`Hàng ${r + 1}, cột ${c + 1}`}
                  className="absolute p-0 border-0 bg-transparent outline-none"
                  style={{
                    left: `${c * STEP}%`,
                    top: `${r * STEP}%`,
                    width: `${STEP}%`,
                    height: `${STEP}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: value === 0 && !over && (!vsAI || turn === 1) ? 'pointer' : 'default',
                  }}
                >
                  {value !== 0 ? (
                    <span
                      className="relative block rounded-full"
                      style={{
                        width: '78%',
                        height: '78%',
                        background: value === 1 ? BLACK : WHITE,
                        outline: isWin
                          ? '2px solid #facc15'
                          : `1px solid ${value === 1 ? 'rgba(148,163,184,0.45)' : '#94a3b8'}`,
                      }}
                    >
                      {isLast ? (
                        <span
                          className="absolute rounded-full"
                          style={{
                            left: '38%',
                            top: '38%',
                            width: '24%',
                            height: '24%',
                            background: value === 1 ? WHITE : BLACK,
                          }}
                        />
                      ) : null}
                    </span>
                  ) : null}
                  {value === 0 && hover === idx && !over && (!vsAI || turn === 1) ? (
                    <span
                      className="absolute block rounded-full"
                      style={{
                        width: '52%',
                        height: '52%',
                        background: turn === 1 ? BLACK : WHITE,
                        opacity: 0.32,
                      }}
                    />
                  ) : null}
                  {value === 0 && isCursor ? (
                    <span
                      className="absolute block rounded-full"
                      style={{
                        width: '78%',
                        height: '78%',
                        outline: '2px solid var(--accent)',
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] theme-muted text-center leading-snug">
          Người chơi quân Đen, đi trước. Ai có 5 quân liền nhau theo hàng, cột hoặc đường chéo
          là thắng.
          <br />
          Năm tròn là tâm bàn · Bàn đầy mà không có ai thắng thì hòa.
        </p>
      </div>
    </GameShell>
  );
};
