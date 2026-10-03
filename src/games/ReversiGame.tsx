import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playBounceSound, triggerHaptic } from '../utils/sound';
import { Bot, Lightbulb, Undo2, User } from 'lucide-react';

type Cell = 0 | 1 | 2;

type Board = Cell[];

type Difficulty = 'easy' | 'medium' | 'hard';

interface Level {
  label: string;
  depth: number;
  positional: number;
  mobility: number;
  frontier: number;
  corner: number;
  disc: number;
  jitter: number;
}

const LEVELS: Record<Difficulty, Level> = {
  easy: { label: 'Dễ', depth: 1, positional: 0.15, mobility: 0, frontier: 0, corner: 10, disc: 0, jitter: 90 },
  medium: { label: 'Trung bình', depth: 1, positional: 1, mobility: 9, frontier: 6, corner: 60, disc: 8, jitter: 0 },
  hard: { label: 'Khó', depth: 2, positional: 1, mobility: 10, frontier: 7, corner: 60, disc: 5, jitter: 0 },
};

const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

const DR = [-1, -1, -1, 0, 0, 1, 1, 1];
const DC = [-1, 0, 1, -1, 1, -1, 0, 1];
const CORNERS = [0, 7, 56, 63];
const TOTAL_SQUARES = 64;

function other(player: Cell): Cell {
  return player === 1 ? 2 : 1;
}

function createInitialBoard(): Board {
  const board: Board = new Array(TOTAL_SQUARES).fill(0);
  board[3 * 8 + 3] = 1;
  board[4 * 8 + 4] = 1;
  board[3 * 8 + 4] = 2;
  board[4 * 8 + 3] = 2;
  return board;
}

function countDiscs(board: Board): [number, number] {
  let black = 0;
  let white = 0;
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    if (board[i] === 1) black++;
    else if (board[i] === 2) white++;
  }
  return [black, white];
}

function flipsFrom(board: Board, index: number, player: Cell): number[] {
  if (board[index] !== 0) return [];
  const r = (index / 8) | 0;
  const c = index % 8;
  const foe = other(player);
  const found: number[] = [];
  for (let d = 0; d < 8; d++) {
    const run: number[] = [];
    let nr = r + DR[d];
    let nc = c + DC[d];
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr * 8 + nc] === foe) {
      run.push(nr * 8 + nc);
      nr += DR[d];
      nc += DC[d];
    }
    if (run.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr * 8 + nc] === player) {
      for (const sq of run) found.push(sq);
    }
  }
  return found;
}

function legalMoves(board: Board, player: Cell): number[] {
  const moves: number[] = [];
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    if (board[i] !== 0) continue;
    if (flipsFrom(board, i, player).length > 0) moves.push(i);
  }
  return moves;
}

function applyMove(board: Board, index: number, player: Cell): { board: Board; flipped: number[] } | null {
  const flipped = flipsFrom(board, index, player);
  if (flipped.length === 0) return null;
  const next = board.slice();
  next[index] = player;
  for (const sq of flipped) next[sq] = player;
  return { board: next, flipped };
}

function isTerminal(board: Board): boolean {
  if (board.every((v) => v !== 0)) return true;
  return legalMoves(board, 1).length === 0 && legalMoves(board, 2).length === 0;
}

function frontierCount(board: Board, player: Cell): number {
  let n = 0;
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    if (board[i] !== player) continue;
    const r = (i / 8) | 0;
    const c = i % 8;
    for (let d = 0; d < 8; d++) {
      const nr = r + DR[d];
      const nc = c + DC[d];
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      if (board[nr * 8 + nc] === 0) {
        n++;
        break;
      }
    }
  }
  return n;
}

function evaluate(board: Board, me: Cell, level: Level): number {
  if (isTerminal(board)) {
    const [black, white] = countDiscs(board);
    const diff = me === 1 ? black - white : white - black;
    return diff >= 0 ? 100000 + diff * 100 : -100000 + diff * 100;
  }
  const foe = other(me);
  let score = 0;
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    if (board[i] === me) score += WEIGHTS[i];
    else if (board[i] === foe) score -= WEIGHTS[i];
  }
  score *= level.positional;
  const [black, white] = countDiscs(board);
  const mine = me === 1 ? black : white;
  const theirs = me === 1 ? white : black;
  score += (mine - theirs) * level.disc;
  score += (legalMoves(board, me).length - legalMoves(board, foe).length) * level.mobility;
  score += (frontierCount(board, foe) - frontierCount(board, me)) * level.frontier;
  for (const corner of CORNERS) {
    const occupant = board[corner];
    if (occupant === me) score += level.corner;
    else if (occupant === foe) score -= level.corner + 10;
    else {
      const r = (corner / 8) | 0;
      const c = corner % 8;
      const r2 = r === 0 ? 1 : 6;
      const c2 = c === 0 ? 1 : 6;
      if (board[r2 * 8 + c] === foe) score -= level.corner / 4;
      if (board[r * 8 + c2] === foe) score -= level.corner / 4;
      if (board[r2 * 8 + c2] === foe) score -= level.corner / 2;
    }
  }
  return score;
}

let rngState = 123456789;

function nextRandom(): number {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}

function chooseMove(board: Board, me: Cell, level: Level): number | null {
  const moves = legalMoves(board, me);
  if (moves.length === 0) return null;

  for (const move of moves) {
    const res = applyMove(board, move, me);
    if (!res) continue;
    if (isTerminal(res.board)) {
      const [black, white] = countDiscs(res.board);
      if ((me === 1 ? black : white) > (me === 1 ? white : black)) return move;
    }
  }

  let bestMove: number | null = null;
  let bestValue = -Infinity;
  for (const move of moves) {
    const res = applyMove(board, move, me);
    if (!res) continue;
    const foe = other(me);
    let value: number;
    if (level.depth >= 2) {
      const replies = legalMoves(res.board, foe);
      if (replies.length === 0) {
        value = evaluate(res.board, me, level) + 4000;
      } else {
        let worst = Infinity;
        for (const reply of replies) {
          const res2 = applyMove(res.board, reply, foe);
          const value2 = res2 ? evaluate(res2.board, me, level) : evaluate(res.board, me, level);
          if (value2 < worst) worst = value2;
        }
        value = worst;
      }
    } else {
      value = evaluate(res.board, me, level);
    }
    value += nextRandom() * level.jitter;
    if (bestMove === null || value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }
  return bestMove;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export const ReversiGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [turn, setTurn] = useState<Cell>(1);
  const [history, setHistory] = useState<Board[]>([]);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [vsAI, setVsAI] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [hint, setHint] = useState<number | null>(null);
  const [message, setMessage] = useState('Bạn đi quân Đen. Hãy chọn một ô hợp lệ.');
  const [aiThinking, setAiThinking] = useState(false);
  const [cursor, setCursor] = useState<number>(27);
  const timerRef = useRef<number | null>(null);

  const [black, white] = useMemo(() => countDiscs(board), [board]);
  const available = useMemo(() => legalMoves(board, turn), [board, turn]);
  const ended = isTerminal(board);
  const won = black > white;
  const score = black * 25 + (ended && won ? 200 : 0) + (vsAI ? 100 : 0);
  const humanTurn = !vsAI || turn === 1;

  const restart = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    rngState = 123456789 + Math.floor(nextRandom() * 100000);
    setBoard(createInitialBoard());
    setTurn(1);
    setHistory([]);
    setLastMove(null);
    setFlipped([]);
    setHint(null);
    setCursor(27);
    setAiThinking(false);
    setMessage('Bạn đi quân Đen. Hãy chọn một ô hợp lệ.');
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0 || aiThinking) return;
    const steps = vsAI ? Math.min(2, history.length) : 1;
    const remaining = history.slice(0, history.length - steps);
    setHistory(remaining);
    setBoard(remaining.length > 0 ? remaining[remaining.length - 1] : createInitialBoard());
    setTurn(remaining.length % 2 === 0 ? 1 : 2);
    setLastMove(null);
    setFlipped([]);
    setHint(null);
    setMessage('Đã hoàn tác nước đi trước.');
    playBounceSound();
  }, [aiThinking, history, vsAI]);

  const commitMove = useCallback((index: number, player: Cell) => {
    const res = applyMove(board, index, player);
    if (!res) return false;
    setHistory((prev) => [...prev, board]);
    setBoard(res.board);
    setLastMove(index);
    setFlipped(res.flipped);
    setHint(null);
    setMessage(`Lật ${res.flipped.length} quân.`);
    if (res.flipped.length >= 3) playScoreSound();
    else playMoveSound();
    triggerHaptic(res.flipped.length >= 3 ? 25 : 15);
    return true;
  }, [board]);

  const handleSquare = useCallback((index: number) => {
    if (ended || aiThinking) return;
    if (!humanTurn) return;
    setCursor(index);
    if (available.indexOf(index) === -1) {
      setMessage('Nước đi không hợp lệ tại ô này.');
      setHint(null);
      playBounceSound();
      return;
    }
    commitMove(index, turn);
    setTurn(other(turn));
  }, [aiThinking, available, commitMove, ended, humanTurn, turn]);

  const aiTurn = vsAI && turn === 2;

  useEffect(() => {
    if (!aiTurn || ended) return;
    setAiThinking(true);
    const level = LEVELS[difficulty];
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const picked = chooseMove(board, 2, level);
      const res = picked === null ? null : applyMove(board, picked, 2);
      if (res && picked !== null) {
        setHistory((prev) => [...prev, board]);
        setBoard(res.board);
        setLastMove(picked);
        setFlipped(res.flipped);
        setHint(null);
        if (res.flipped.length >= 3) playScoreSound();
        else playMoveSound();
        triggerHaptic(20);
      }
      setTurn(1);
      setAiThinking(false);
    }, 380);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setAiThinking(false);
    };
  }, [aiTurn, board, difficulty, ended]);

  useEffect(() => {
    if (ended || aiTurn || available.length > 0) return;
    const timer = window.setTimeout(() => setTurn(other(turn)), 550);
    return () => window.clearTimeout(timer);
  }, [aiTurn, available.length, ended, turn]);

  useEffect(() => {
    if (flipped.length === 0) return;
    const timer = window.setTimeout(() => setFlipped([]), 700);
    return () => window.clearTimeout(timer);
  }, [flipped]);

  useEffect(() => {
    if (ended) {
      setHint(null);
      setMessage(
        black > white
          ? `Kết thúc! Đen thắng ${black} - ${white}.`
          : white > black
            ? `Kết thúc! Trắng thắng ${white} - ${black}.`
            : `Kết thúc! Hòa ${black} - ${white}.`
      );
    } else if (available.length === 0) {
      setMessage(`${turn === 1 ? 'Đen' : 'Trắng'} không có nước đi, phải bỏ lượt.`);
    } else if (available.length <= 2) {
      setMessage(`Chỉ còn ${available.length} ô hợp lệ, cẩn thận!`);
    }
  }, [available.length, black, ended, turn, white]);

  const showHint = useCallback(() => {
    if (ended || !humanTurn || available.length === 0) return;
    const picked = chooseMove(board, turn, LEVELS.medium);
    if (picked === null) return;
    setHint(picked);
    setMessage(`Gợi ý: hãy đi vào ô ${String.fromCharCode(65 + (picked % 8))}${Math.floor(picked / 8) + 1}.`);
    playMoveSound();
  }, [available.length, board, ended, humanTurn, turn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (ended || aiThinking) return;
      const r = (cursor / 8) | 0;
      const c = cursor % 8;
      if (event.key === 'ArrowUp') setCursor(((r + 7) % 8) * 8 + c);
      else if (event.key === 'ArrowDown') setCursor(((r + 1) % 8) * 8 + c);
      else if (event.key === 'ArrowLeft') setCursor(r * 8 + (c + 7) % 8);
      else if (event.key === 'ArrowRight') setCursor(r * 8 + (c + 1) % 8);
      else if (event.key === 'Enter' || event.key === ' ') handleSquare(cursor);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aiThinking, cursor, ended, handleSquare]);

  return (
    <GameShell
      game={getGameById('reversi')!}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="px-2.5 py-1 rounded-xl border theme-border text-[10px] font-bold theme-muted whitespace-nowrap" style={{ background: 'var(--surface-strong)' }}>
          {vsAI ? `AI ${LEVELS[difficulty].label}` : '2 người'} · Lượt {history.length + 1}
        </div>
      }
    >
      <div className="flex flex-col items-center w-full max-w-[440px] mx-auto px-1">
        <div className="w-full flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-2xl border theme-border" style={{ background: 'var(--game-status-bg)' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full border-2" style={{ background: '#111827', borderColor: '#4b5563' }} />
            <span className="text-sm font-black text-slate-200">{black}</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider theme-muted text-center">
            <div className="flex items-center justify-center gap-1">
              {turn === 1 ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
              {aiThinking ? 'AI đang nghĩ...' : turn === 1 ? 'Lượt Đen' : 'Lượt Trắng'}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-slate-200">{white}</span>
            <span className="w-6 h-6 rounded-full border-2" style={{ background: '#f1f5f9', borderColor: '#cbd5e1' }} />
          </div>
        </div>

        <div className="w-full aspect-square p-1.5 rounded-2xl border-2" style={{ background: '#14532d', borderColor: '#166534' }}>
          <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full">
            {board.map((cell, index) => {
              const r = (index / 8) | 0;
              const c = index % 8;
              const isLightSquare = (r + c) % 2 === 1;
              const isHint = hint === index;
              const isLast = lastMove === index;
              const isFlipped = flipped.indexOf(index) !== -1;
              const isTarget = available.indexOf(index) !== -1 && !ended && humanTurn;
              const isCursor = cursor === index && !ended;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSquare(index)}
                  disabled={ended || aiThinking}
                  aria-label={`${String.fromCharCode(65 + c)}${r + 1}`}
                  className="relative flex items-center justify-center select-none transition active:translate-y-[1px] disabled:active:translate-y-0"
                  style={{ background: isLightSquare ? '#3f8f52' : '#2f6b3f' }}
                >
                  {isCursor && (
                    <span className="absolute inset-0" style={{ outline: '2px solid #facc15', outlineOffset: '-2px' }} />
                  )}
                  {isTarget && !isHint && (
                    <span className="w-2 h-2 rounded-full opacity-70" style={{ background: '#bbf7d0' }} />
                  )}
                  {cell !== 0 && (
                    <span
                      className="w-[82%] h-[82%] rounded-full flex items-center justify-center transition-transform duration-200 animate-in zoom-in-95"
                      style={{
                        background: cell === 1 ? '#111827' : '#f8fafc',
                        border: cell === 1 ? '2px solid #4b5563' : '2px solid #cbd5e1',
                        outline: isHint ? '2px solid #facc15' : undefined,
                        outlineOffset: '1px',
                        transform: isLast || isFlipped ? 'scale(1.06)' : undefined,
                      }}
                    >
                      {cell === 1 && (
                        <span className="w-2 h-2 rounded-full" style={{ background: '#374151' }} />
                      )}
                    </span>
                  )}
                  {isHint && cell === 0 && (
                    <span className="absolute w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: '#facc15' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-2 mb-2 text-[11px] font-semibold text-center min-h-[16px]" style={{ color: message.indexOf('không hợp lệ') !== -1 ? '#fb7185' : 'var(--text-muted)' }}>
          {message}
        </p>

        <div className="w-full flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              setVsAI((v) => !v);
              setHint(null);
              setAiThinking(false);
            }}
            className="px-2.5 py-2 rounded-xl border theme-border text-[11px] font-bold transition game-btn-press flex items-center gap-1"
            style={{ background: vsAI ? 'var(--accent)' : 'var(--game-control-bg)', color: vsAI ? '#0f172a' : 'var(--text-primary)' }}
          >
            <Bot className="w-3.5 h-3.5" />
            {vsAI ? 'AI: Bật' : 'AI: Tắt'}
          </button>

          {vsAI && (
            <div className="flex items-center gap-0.5 px-1 py-1 rounded-xl border theme-border" style={{ background: 'var(--game-control-bg)' }}>
              {(Object.keys(LEVELS) as Difficulty[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    playMoveSound();
                    setDifficulty(key);
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold transition"
                  style={{ background: difficulty === key ? 'var(--accent)' : 'transparent', color: difficulty === key ? '#0f172a' : 'var(--text-muted)' }}
                >
                  {LEVELS[key].label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={showHint}
            disabled={ended || !humanTurn || available.length === 0}
            className="px-2.5 py-2 rounded-xl border theme-border text-[11px] font-bold transition game-btn-press flex items-center gap-1 disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)', color: 'var(--text-primary)' }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            Gợi ý
          </button>

          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0 || aiThinking}
            className="px-2.5 py-2 rounded-xl border theme-border text-[11px] font-bold transition game-btn-press flex items-center gap-1 disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)', color: 'var(--text-primary)' }}
          >
            <Undo2 className="w-3.5 h-3.5 text-indigo-400" />
            Hoàn tác
          </button>
        </div>

        <p className="mt-2 text-[10px] theme-muted text-center">
          Bàn tọa độ: dùng phím mũi tên để chọn ô, Enter để đặt quân.
        </p>
      </div>
    </GameShell>
  );
};