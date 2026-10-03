import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playMoveSound,
  playClearSound,
  playBounceSound,
  triggerHaptic,
} from '../utils/sound';
import { Lightbulb, SkipForward, Undo2 } from 'lucide-react';

type Stone = 0 | 1 | 2;
type Color = 1 | 2;

const SIZE = 9;
const CELLS = SIZE * SIZE;
const STEP = 100 / SIZE;
const KOMI = 6.5;
const HUMAN: Color = 1;
const AI: Color = 2;
const AI_DELAY_MS = 350;
const HINT_MS = 2400;

const NEIGHBOURS: number[][] = (() => {
  const list: number[][] = [];
  for (let i = 0; i < CELLS; i += 1) list.push([]);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const idx = r * SIZE + c;
      if (r > 0) list[idx].push(idx - SIZE);
      if (r < SIZE - 1) list[idx].push(idx + SIZE);
      if (c > 0) list[idx].push(idx - 1);
      if (c < SIZE - 1) list[idx].push(idx + 1);
    }
  }
  return list;
})();

const STAR_POINTS: number[] = [];
for (const row of [2, 4, 6]) {
  for (const col of [2, 4, 6]) STAR_POINTS.push(row * SIZE + col);
}

interface Group {
  stones: number[];
  liberties: number[];
}

const other = (color: Color): Color => (color === 1 ? 2 : 1);

const emptyBoard = (): Stone[] => new Array<Stone>(CELLS).fill(0);

const sameBoard = (a: Stone[], b: Stone[]): boolean => {
  for (let i = 0; i < CELLS; i += 1) if (a[i] !== b[i]) return false;
  return true;
};

const groupAt = (board: Stone[], idx: number): Group => {
  const color = board[idx];
  const stones: number[] = [];
  const liberties: number[] = [];
  const seen = new Set<number>();
  const seenLibs = new Set<number>();
  const stack = [idx];
  seen.add(idx);
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    stones.push(cur);
    const adj = NEIGHBOURS[cur];
    for (let i = 0; i < adj.length; i += 1) {
      const n = adj[i];
      if (board[n] === 0) {
        if (!seenLibs.has(n)) {
          seenLibs.add(n);
          liberties.push(n);
        }
      } else if (board[n] === color && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
};

interface MoveResult {
  board: Stone[];
  captured: number;
  suicide: boolean;
}

const playStone = (board: Stone[], idx: number, color: Color): MoveResult => {
  const next = board.slice();
  next[idx] = color;
  let captured = 0;
  const foe = other(color);
  const adj = NEIGHBOURS[idx];
  for (let i = 0; i < adj.length; i += 1) {
    const n = adj[i];
    if (next[n] !== foe) continue;
    const group = groupAt(next, n);
    if (group.liberties.length > 0) continue;
    for (let k = 0; k < group.stones.length; k += 1) next[group.stones[k]] = 0;
    captured += group.stones.length;
  }
  const own = groupAt(next, idx);
  if (own.liberties.length === 0) return { board: next, captured, suicide: true };
  return { board: next, captured, suicide: false };
};

const wouldRecreate = (result: Stone[], koBoard: Stone[] | null): boolean =>
  koBoard !== null && sameBoard(result, koBoard);

const candidateMoves = (board: Stone[], koBoard: Stone[] | null, color: Color): number[] => {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i += 1) {
    if (board[i] !== 0) continue;
    const res = playStone(board, i, color);
    if (res.suicide) continue;
    if (wouldRecreate(res.board, koBoard)) continue;
    out.push(i);
  }
  return out;
};

const isEyeLike = (board: Stone[], idx: number, color: Color): boolean => {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const foe = other(color);
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      const outside = rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE;
      if (outside) continue;
      const value = board[rr * SIZE + cc];
      if (value === foe) return false;
      if (value === 0 && (dr === 0 || dc === 0)) return false;
    }
  }
  return true;
};

const scoreCandidate = (
  board: Stone[],
  idx: number,
  color: Color,
  lastHumanMove: number | null,
): number => {
  const foe = other(color);
  const res = playStone(board, idx, color);
  if (res.suicide) return -Infinity;
  const adj = NEIGHBOURS[idx];
  let score = res.captured * 14;

  // A single group can touch the new stone on several sides, so score each
  // distinct group only once.
  const scored = new Set<number>();
  for (let i = 0; i < adj.length; i += 1) {
    const n = adj[i];
    const value = res.board[n];
    if (value === 0 || scored.has(n)) continue;
    const group = groupAt(res.board, n);
    for (let k = 0; k < group.stones.length; k += 1) scored.add(group.stones[k]);
    if (group.liberties.length !== 1) continue;
    if (value === foe) score += 11;
    else if (value === color) score += 16;
  }

  const own = groupAt(res.board, idx);
  score += Math.min(own.liberties.length, 5) * 2;

  if (lastHumanMove !== null && adj.indexOf(lastHumanMove) !== -1) score += 7;

  if (isEyeLike(board, idx, color)) score -= 9;

  const mid = (SIZE - 1) / 2;
  const dist = Math.abs(Math.floor(idx / SIZE) - mid) + Math.abs((idx % SIZE) - mid);
  score += (SIZE - dist) * 0.6;

  return score;
};

const chooseMove = (
  board: Stone[],
  color: Color,
  lastHumanMove: number | null,
  koBoard: Stone[] | null,
): number => {
  const legal = candidateMoves(board, koBoard, color);
  if (legal.length === 0) return -1;
  let best = -Infinity;
  for (let i = 0; i < legal.length; i += 1) {
    const value = scoreCandidate(board, legal[i], color, lastHumanMove);
    if (value > best) best = value;
  }
  const tied: number[] = [];
  for (let i = 0; i < legal.length; i += 1) {
    if (scoreCandidate(board, legal[i], color, lastHumanMove) >= best - 0.75) tied.push(legal[i]);
  }
  const pool = tied.length > 0 ? tied : legal;
  return pool[Math.floor(Math.random() * pool.length)];
};

interface Territory {
  black: number;
  white: number;
  owner: Stone[];
}

const scoreArea = (board: Stone[]): Territory => {
  const owner: Stone[] = new Array<Stone>(CELLS).fill(0);
  let black = 0;
  let white = 0;
  const seen = new Set<number>();
  for (let i = 0; i < CELLS; i += 1) {
    if (board[i] === 1) {
      black += 1;
      continue;
    }
    if (board[i] === 2) {
      white += 1;
      continue;
    }
    if (seen.has(i)) continue;
    const region: number[] = [];
    const stack = [i];
    seen.add(i);
    let touchesBlack = false;
    let touchesWhite = false;
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      region.push(cur);
      const adj = NEIGHBOURS[cur];
      for (let k = 0; k < adj.length; k += 1) {
        const n = adj[k];
        if (board[n] === 0) {
          if (!seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        } else if (board[n] === 1) touchesBlack = true;
        else touchesWhite = true;
      }
    }
    let side: Stone = 0;
    if (touchesBlack && !touchesWhite) side = 1;
    else if (touchesWhite && !touchesBlack) side = 2;
    if (side !== 0) {
      for (let k = 0; k < region.length; k += 1) {
        owner[region[k]] = side;
        if (side === 1) black += 1;
        else white += 1;
      }
    }
  }
  return { black, white, owner };
};

interface Snapshot {
  board: Stone[];
  turn: Color;
  passStreak: number;
  koBoard: Stone[] | null;
  takenHuman: number;
  takenAi: number;
  lastMove: number | null;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export const GoGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [board, setBoard] = useState<Stone[]>(() => emptyBoard());
  const [turn, setTurn] = useState<Color>(HUMAN);
  const [passStreak, setPassStreak] = useState(0);
  const [koBoard, setKoBoard] = useState<Stone[] | null>(null);
  const [takenHuman, setTakenHuman] = useState(0);
  const [takenAi, setTakenAi] = useState(0);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [scored, setScored] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const [hintNonce, setHintNonce] = useState(0);
  const [cursor, setCursor] = useState(4 * SIZE + 4);
  const [note, setNote] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const aiTimer = useRef<number | null>(null);

  const snapshot = useCallback((): Snapshot => {
    return {
      board,
      turn,
      passStreak,
      koBoard,
      takenHuman,
      takenAi,
      lastMove,
    };
  }, [board, koBoard, lastMove, passStreak, takenAi, takenHuman, turn]);

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setTurn(HUMAN);
    setPassStreak(0);
    setKoBoard(null);
    setTakenHuman(0);
    setTakenAi(0);
    setLastMove(null);
    setHistory([]);
    setMoveCount(0);
    setScored(false);
    setHint(null);
    setCursor(4 * SIZE + 4);
    setNote(null);
    setScore(0);
    setIsPaused(false);
  }, []);

  const area = useMemo(() => scoreArea(board), [board]);
  const stones = useMemo(() => {
    let n = 0;
    for (let i = 0; i < CELLS; i += 1) if (board[i] !== 0) n += 1;
    return n;
  }, [board]);

  // Chinese area scoring: komi compensates the second player, so it is added
  // to White's total, never Black's.
  const blackTotal = area.black;
  const whiteTotal = area.white + KOMI;
  const victory = scored && blackTotal > whiteTotal;

  const applyMove = useCallback(
    (current: Stone[], idx: number, color: Color, from: Snapshot) => {
      const res = playStone(current, idx, color);
      if (res.suicide) return false;
      if (wouldRecreate(res.board, from.koBoard)) return false;
      setHistory((prev) => [...prev, from]);
      setBoard(res.board);
      setKoBoard(current);
      setLastMove(idx);
      setHint(null);
      setMoveCount((v) => v + 1);
      setPassStreak(0);
      setTurn(other(color));
      if (res.captured > 0) {
        if (color === HUMAN) {
          setTakenHuman((v) => v + res.captured);
          setScore((v) => v + res.captured * 10);
          setNote(`Bạn bắt được ${res.captured} quân Trắng.`);
          playClearSound();
        } else {
          setTakenAi((v) => v + res.captured);
          setNote(`Máy bắt được ${res.captured} quân Đen của bạn.`);
          playClearSound();
        }
        triggerHaptic(25);
      } else {
        setNote(null);
        playMoveSound();
        triggerHaptic(15);
      }
      return true;
    },
    [],
  );

  const applyPass = useCallback(
    (color: Color, from: Snapshot) => {
      setHistory((prev) => [...prev, from]);
      setHint(null);
      setLastMove(null);
      setTurn(other(color));
      const streak = from.passStreak + 1;
      setPassStreak(streak);
      playBounceSound();
      triggerHaptic(12);
      if (streak >= 2) {
        setScored(true);
        const final = scoreArea(from.board);
        if (final.black > final.white + KOMI) {
          setScore((v) => v + 100 + Math.round((final.black - (final.white + KOMI)) * 10));
          setNote('Hai bên đã bỏ lượt — bạn chiếm thắng chất điểm.');
        } else {
          setNote('Hai bên đã bỏ lượt — chấm điểm.');
        }
      } else {
        setNote(color === HUMAN ? 'Bạn bỏ lượt.' : 'Máy bỏ lượt.');
      }
    },
    [],
  );

  const pass = useCallback(() => {
    if (scored || turn !== HUMAN) return;
    applyPass(HUMAN, snapshot());
  }, [applyPass, scored, snapshot, turn]);

  const undo = useCallback(() => {
    if (history.length === 0 || turn !== HUMAN || scored) return;
    if (aiTimer.current !== null) {
      window.clearTimeout(aiTimer.current);
      aiTimer.current = null;
    }
    let stack = history;
    let restored: Snapshot | null = null;
    while (stack.length > 0) {
      const snap = stack[stack.length - 1];
      stack = stack.slice(0, -1);
      restored = snap;
      if (snap.turn === HUMAN) break;
    }
    if (!restored) return;
    setHistory(stack);
    setBoard(restored.board);
    setTurn(HUMAN);
    setPassStreak(restored.passStreak);
    setKoBoard(restored.koBoard);
    setTakenHuman(restored.takenHuman);
    setTakenAi(restored.takenAi);
    setLastMove(restored.lastMove);
    setHint(null);
    setNote('Đã hoàn tác nước đi trước.');
    playBounceSound();
    triggerHaptic(15);
  }, [history, scored, turn]);

  const showHint = useCallback(() => {
    if (scored || turn !== HUMAN) return;
    const from = snapshot();
    const picked = chooseMove(from.board, HUMAN, from.lastMove, from.koBoard);
    if (picked < 0) {
      setHint(null);
      setNote('Bạn không có nước hợp lệ, hãy bỏ lượt.');
      playBounceSound();
      return;
    }
    setHint(picked);
    setHintNonce((v) => v + 1);
    setNote(`Gợi ý: nên đi tại ${String.fromCharCode(65 + (picked % SIZE))}${Math.floor(picked / SIZE) + 1}.`);
    playMoveSound();
  }, [scored, snapshot, turn]);

  useEffect(() => {
    if (hint === null) return;
    const id = window.setTimeout(() => setHint(null), HINT_MS);
    return () => window.clearTimeout(id);
  }, [hint, hintNonce]);

  const removeOwnStone = useCallback(
    (idx: number) => {
      if (scored || turn !== HUMAN) return;
      const from = snapshot();
      const group = groupAt(from.board, idx);
      if (group.liberties.length !== 1) return;
      const next = from.board.slice();
      for (let i = 0; i < group.stones.length; i += 1) next[group.stones[i]] = 0;
      setHistory((prev) => [...prev, from]);
      setBoard(next);
      setKoBoard(null);
      setLastMove(idx);
      setHint(null);
      setPassStreak(0);
      setNote(`Bạn đã nhấc ${group.stones.length} quân ra khỏi bàn.`);
      playClearSound();
      triggerHaptic(20);
    },
    [scored, snapshot, turn],
  );

  const handlePoint = useCallback(
    (idx: number) => {
      if (scored || turn !== HUMAN) return;
      setCursor(idx);
      if (board[idx] === HUMAN) {
        removeOwnStone(idx);
        return;
      }
      if (board[idx] !== 0) return;
      const from = snapshot();
      const res = playStone(from.board, idx, HUMAN);
      if (res.suicide) {
        setNote('Nước đi này là tự cắt (tự bóp) — không hợp lệ.');
        setHint(null);
        playBounceSound();
        return;
      }
      if (wouldRecreate(res.board, from.koBoard)) {
        setNote('Bị cấm đơn giản (ko) — bạn không thể đi lại vào điểm vừa bị bắt.');
        setHint(null);
        playBounceSound();
        return;
      }
      applyMove(from.board, idx, HUMAN, from);
    },
    [applyMove, board, removeOwnStone, scored, snapshot, turn],
  );

  useEffect(() => {
    if (turn !== AI || scored || isPaused) return;
    const from: Snapshot = {
      board,
      turn,
      passStreak,
      koBoard,
      takenHuman,
      takenAi,
      lastMove,
    };
    aiTimer.current = window.setTimeout(() => {
      aiTimer.current = null;
      const picked = chooseMove(from.board, AI, from.lastMove, from.koBoard);
      if (picked < 0) {
        applyPass(AI, from);
        return;
      }
      applyMove(from.board, picked, AI, from);
    }, AI_DELAY_MS);
    return () => {
      if (aiTimer.current !== null) {
        window.clearTimeout(aiTimer.current);
        aiTimer.current = null;
      }
    };
  }, [applyMove, applyPass, board, isPaused, koBoard, lastMove, passStreak, scored, takenAi, takenHuman, turn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (scored || isPaused) return;
      const key = event.key;
      if (key !== 'u' && key !== 'U' && key !== 'h' && key !== 'H' && key !== 'p' && key !== 'P') {
        const r = Math.floor(cursor / SIZE);
        const c = cursor % SIZE;
        if (key === 'ArrowUp') setCursor(Math.max(0, r - 1) * SIZE + c);
        else if (key === 'ArrowDown') setCursor(Math.min(SIZE - 1, r + 1) * SIZE + c);
        else if (key === 'ArrowLeft') setCursor(r * SIZE + Math.max(0, c - 1));
        else if (key === 'ArrowRight') setCursor(r * SIZE + Math.min(SIZE - 1, c + 1));
        else if (key === 'Enter' || key === ' ') handlePoint(cursor);
        else return;
        event.preventDefault();
        return;
      }
      event.preventDefault();
      if (key === 'u' || key === 'U') undo();
      else if (key === 'h' || key === 'H') showHint();
      else pass();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, handlePoint, isPaused, pass, scored, showHint, undo]);

  useEffect(() => () => {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
  }, []);

  const statusText = scored
    ? blackTotal > whiteTotal
      ? `Kết thúc! Bạn thắng ${blackTotal.toFixed(1)} – ${whiteTotal.toFixed(1)}`
      : blackTotal < whiteTotal
        ? `Kết thúc! Máy thắng ${whiteTotal.toFixed(1)} – ${blackTotal.toFixed(1)}`
        : `Kết thúc! Hòa ${blackTotal.toFixed(1)} – ${whiteTotal.toFixed(1)}`
    : isPaused
      ? 'Đã tạm dừng.'
      : passStreak === 1
        ? 'Bạn vừa bỏ lượt — máy sẽ quyết định.'
        : turn === HUMAN
          ? 'Đến lượt bạn (Đen)'
          : 'Máy đang nghĩ…';

  const statusColor = scored
    ? victory
      ? '#22c55e'
      : blackTotal === whiteTotal
        ? '#f59e0b'
        : '#ef4444'
    : isPaused
      ? '#f59e0b'
      : turn === HUMAN
        ? 'var(--accent)'
        : '#f59e0b';

  const lines = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < SIZE; i += 1) out.push((i / (SIZE - 1)) * 100);
    return out;
  }, []);

  const cells = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < CELLS; i += 1) out.push(i);
    return out;
  }, []);

  return (
    <GameShell
      game={getGameById('go')!}
      score={score}
      isGameOver={scored}
      isVictory={victory}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(value => !value)}
      onRestart={reset}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div
          className="px-2.5 py-1 rounded-xl border theme-border flex items-center gap-1.5 whitespace-nowrap"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">9×9</span>
          <span className="text-xs font-black theme-text">{stones} quân</span>
          <span className="text-[10px] font-bold theme-muted">
            Đen {blackTotal.toFixed(1)} · Trắng {whiteTotal.toFixed(1)}
          </span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-2 w-full px-1">
        <div
          className="w-full max-w-[520px] px-3 py-2 rounded-2xl border theme-border flex items-center gap-2 flex-wrap"
          style={{ background: 'var(--game-status-bg)' }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{
              background: turn === HUMAN ? '#0f172a' : '#f8fafc',
              outline: `2px solid ${statusColor}`,
            }}
          />
          <span className="text-[11px] sm:text-xs font-bold" style={{ color: statusColor }}>
            {statusText}
          </span>
          <span className="ml-auto flex items-center gap-2.5 text-[10px] font-bold theme-muted">
            <span>Lượt {moveCount + 1}</span>
            <span>Bắt: {takenHuman} / {takenAi}</span>
          </span>
        </div>

        <div
          className="w-full max-w-[520px] rounded-3xl border theme-border p-2 sm:p-3"
          style={{ background: 'var(--game-surface-bg)' }}
        >
          <div
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
              {STAR_POINTS.map((idx) => (
                <span
                  key={idx}
                  className="absolute rounded-full"
                  style={{
                    left: `${((idx % SIZE) / (SIZE - 1)) * 100}%`,
                    top: `${(Math.floor(idx / SIZE) / (SIZE - 1)) * 100}%`,
                    width: 5,
                    height: 5,
                    transform: 'translate(-50%, -50%)',
                    background: 'var(--text-muted)',
                    opacity: 0.65,
                  }}
                />
              ))}
            </div>

            {cells.map((idx) => {
              const r = Math.floor(idx / SIZE);
              const c = idx % SIZE;
              const value = board[idx];
              const isLast = lastMove === idx;
              const isHint = hint === idx;
              const isTerritory = value === 0 && area.owner[idx] !== 0;
              const isCursor = cursor === idx;
              const playable = !scored && turn === HUMAN && (value === 0 || value === HUMAN);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePoint(idx)}
                  onFocus={() => setCursor(idx)}
                  aria-label={`Điểm ${String.fromCharCode(65 + c)}${r + 1}${
                    value === 1 ? ', đen' : value === 2 ? ', trắng' : ', trống'
                  }`}
                  className="absolute p-0 border-0 bg-transparent outline-none transition active:translate-y-[1px]"
                  style={{
                    left: `${c * STEP}%`,
                    top: `${r * STEP}%`,
                    width: `${STEP}%`,
                    height: `${STEP}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: playable ? 'pointer' : 'default',
                  }}
                >
                  {value !== 0 ? (
                    <span
                      className="block rounded-full animate-in zoom-in-95"
                      style={{
                        width: '76%',
                        height: '76%',
                        background: value === 1 ? '#0f172a' : '#f8fafc',
                        outline: isHint
                          ? '2px solid #facc15'
                          : `1px solid ${value === 1 ? 'rgba(148,163,184,0.45)' : '#94a3b8'}`,
                        boxShadow: isLast ? '0 0 0 2px var(--accent)' : undefined,
                      }}
                    />
                  ) : null}
                  {value === 0 && isTerritory ? (
                    <span
                      className="absolute block rounded-full"
                      style={{
                        width: '30%',
                        height: '30%',
                        background: 'var(--text-muted)',
                        opacity: 0.45,
                      }}
                    />
                  ) : null}
                  {value === 0 && isHint ? (
                    <span
                      className="absolute block rounded-full"
                      style={{
                        width: '76%',
                        height: '76%',
                        border: '2px dashed #facc15',
                      }}
                    />
                  ) : null}
                  {isCursor && !isLast && value === 0 ? (
                    <span
                      className="absolute block rounded-full"
                      style={{
                        width: '76%',
                        height: '76%',
                        outline: '2px solid var(--accent)',
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <p
          className="text-[11px] font-semibold text-center min-h-[16px] max-w-[520px]"
          style={{ color: note ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          {note ?? `Chấm điểm kiểu Trung Quốc · Komi ${KOMI} cho Trắng · Đen ${blackTotal.toFixed(1)} – Trắng ${whiteTotal.toFixed(1)} (ước lượng)`}
        </p>

        <div className="w-full max-w-[520px] flex items-center gap-1.5">
          <button
            type="button"
            onClick={showHint}
            disabled={scored || turn !== HUMAN}
            className="px-2.5 py-2 rounded-xl border theme-border text-[11px] font-bold transition game-btn-press flex items-center gap-1 disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)', borderColor: 'var(--game-control-border)', color: 'var(--text-primary)' }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            Gợi ý
          </button>

          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0 || turn !== HUMAN || scored}
            className="px-2.5 py-2 rounded-xl border theme-border text-[11px] font-bold transition game-btn-press flex items-center gap-1 disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)', borderColor: 'var(--game-control-border)', color: 'var(--text-primary)' }}
          >
            <Undo2 className="w-3.5 h-3.5 text-indigo-400" />
            Hoàn tác
          </button>

          <button
            type="button"
            onClick={pass}
            disabled={scored || turn !== HUMAN}
            className="px-2.5 py-2 rounded-xl border theme-border text-[11px] font-bold transition game-btn-press flex items-center gap-1 disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)', borderColor: 'var(--game-control-border)', color: 'var(--text-primary)' }}
          >
            <SkipForward className="w-3.5 h-3.5 text-teal-400" />
            Bỏ lượt
          </button>
        </div>

        <p className="text-[10px] theme-muted text-center leading-snug max-w-[520px]">
          Bấm giao điểm trống để đặt quân Đen · Bấm quân Đen chỉ còn 1 hơi thở để nhấc ra · Hai bên bỏ lượt là chấm điểm.
          <br />
          Phím mũi tên chọn điểm, Enter đặt quân, U hoàn tác, H gợi ý, P bỏ lượt.
        </p>
      </div>
    </GameShell>
  );
};