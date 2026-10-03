import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { User, Bot, Users, RotateCcw } from 'lucide-react';

type Player = 'X' | 'O';
type Board = (Player | null)[];
type Mode = 'ai-easy' | 'ai-medium' | 'ai-hard' | 'pvp';

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

interface TicTacToeProps {
  onBackToHub: () => void;
}

export const TicTacToe: React.FC<TicTacToeProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('tictactoe')!;

  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [turn, setTurn] = useState<Player>('X');
  const [mode, setMode] = useState<Mode>('ai-hard');
  const [winner, setWinner] = useState<Player | 'DRAW' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });

  const checkWinner = (b: Board): { winner: Player | 'DRAW' | null; line: number[] | null } => {
    for (const combo of WINNING_COMBOS) {
      const [a, bIdx, c] = combo;
      if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) {
        return { winner: b[a], line: combo };
      }
    }
    if (b.every(cell => cell !== null)) {
      return { winner: 'DRAW', line: null };
    }
    return { winner: null, line: null };
  };

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn('X');
    setWinner(null);
    setWinningLine(null);
  }, []);

  // Minimax algorithm for unbeatable AI ('ai-hard')
  const minimax = (tempBoard: Board, depth: number, isMaximizing: boolean): number => {
    const { winner: result } = checkWinner(tempBoard);
    if (result === 'O') return 10 - depth;
    if (result === 'X') return depth - 10;
    if (result === 'DRAW') return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (!tempBoard[i]) {
          tempBoard[i] = 'O';
          const currentScore = minimax(tempBoard, depth + 1, false);
          tempBoard[i] = null;
          bestScore = Math.max(score, currentScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (!tempBoard[i]) {
          tempBoard[i] = 'X';
          const currentScore = minimax(tempBoard, depth + 1, true);
          tempBoard[i] = null;
          bestScore = Math.min(score, currentScore);
        }
      }
      return bestScore;
    }
  };

  // Find best move for AI
  const getAiMove = useCallback((currentBoard: Board, aiMode: Mode): number => {
    const available = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter((val): val is number => val !== null);

    if (available.length === 0) return -1;

    // Easy: Pure random
    if (aiMode === 'ai-easy') {
      return available[Math.floor(Math.random() * available.length)];
    }

    // Medium: Smart if winning or blocking, else random
    if (aiMode === 'ai-medium') {
      // 1. Can AI win?
      for (const idx of available) {
        const testBoard = [...currentBoard];
        testBoard[idx] = 'O';
        if (checkWinner(testBoard).winner === 'O') return idx;
      }
      // 2. Block player X
      for (const idx of available) {
        const testBoard = [...currentBoard];
        testBoard[idx] = 'X';
        if (checkWinner(testBoard).winner === 'X') return idx;
      }
      // 3. Take center
      if (available.includes(4)) return 4;
      // 4. Random
      return available[Math.floor(Math.random() * available.length)];
    }

    // Hard: Minimax
    let bestScore = -Infinity;
    let bestMove = available[0];

    for (const idx of available) {
      const testBoard = [...currentBoard];
      testBoard[idx] = 'O';
      const moveScore = minimax(testBoard, 0, false);
      if (moveScore > bestScore) {
        bestScore = moveScore;
        bestMove = idx;
      }
    }
    return bestMove;
  }, []);

  // Handle AI turn
  useEffect(() => {
    if (winner || turn !== 'O' || mode === 'pvp') return;

    const timer = setTimeout(() => {
      const move = getAiMove(board, mode);
      if (move !== -1) {
        const newBoard = [...board];
        newBoard[move] = 'O';
        setBoard(newBoard);
        playMoveSound();
        triggerHaptic(15);

        const outcome = checkWinner(newBoard);
        if (outcome.winner) {
          setWinner(outcome.winner);
          setWinningLine(outcome.line);
          if (outcome.winner === 'O') {
            setStats(s => ({ ...s, losses: s.losses + 1 }));
            playGameOverSound();
          } else if (outcome.winner === 'DRAW') {
            setStats(s => ({ ...s, draws: s.draws + 1 }));
          }
        } else {
          setTurn('X');
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [board, turn, winner, mode, getAiMove]);

  const handleCellClick = (index: number) => {
    if (board[index] || winner) return;
    if (mode !== 'pvp' && turn === 'O') return;

    playMoveSound();
    triggerHaptic(15);

    const newBoard = [...board];
    newBoard[index] = turn;
    setBoard(newBoard);

    const outcome = checkWinner(newBoard);
    if (outcome.winner) {
      setWinner(outcome.winner);
      setWinningLine(outcome.line);

      if (outcome.winner === 'X') {
        playClearSound();
        setScore(s => s + 100);
        setStats(s => ({ ...s, wins: s.wins + 1 }));
      } else if (outcome.winner === 'O') {
        setStats(s => ({ ...s, losses: s.losses + 1 }));
        playGameOverSound();
      } else {
        setStats(s => ({ ...s, draws: s.draws + 1 }));
      }
    } else {
      setTurn(turn === 'X' ? 'O' : 'X');
    }
  };

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={winner !== null && winner !== 'DRAW'}
      isPaused={false}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={winner === 'X'}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        {/* Mode Selector */}
 <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4 w-full">
          {[
            { id: 'ai-easy', label: 'AI Dễ' },
            { id: 'ai-medium', label: 'AI Vừa' },
            { id: 'ai-hard', label: 'AI Khó (Minimax)' },
            { id: 'pvp', label: '2 Người' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setMode(item.id as Mode);
                resetGame();
              }}
 className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition ${
                mode === item.id
                  ? 'bg-indigo-600 text-white '
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Turn & Status Header */}
 <div className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl mb-4">
 <div className="flex items-center gap-2">
 <span className="text-xs text-slate-400 font-medium">Lượt đánh:</span>
            <span
 className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                turn === 'X'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              {turn === 'X' ? 'Người chơi (X)' : mode === 'pvp' ? 'Người chơi (O)' : 'Máy tính (O)'}
            </span>
          </div>

          {winner && (
 <span className="text-xs font-bold text-amber-400 animate-pulse">
              {winner === 'DRAW' ? 'Hòa cờ!' : `${winner} Thắng cuộc!`}
            </span>
          )}
        </div>

        {/* 3x3 Board */}
 <div className="relative p-3.5 bg-slate-900 border border-slate-800 rounded-3xl w-full aspect-square">
 <div className="grid grid-cols-3 gap-3 w-full h-full">
            {board.map((cell, idx) => {
              const isWinningCell = winningLine?.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
 className={`rounded-2xl flex items-center justify-center text-4xl sm:text-5xl font-black transition-all duration-150 select-none cursor-pointer game-btn-press ${
                    isWinningCell
                      ? 'bg-amber-400 text-slate-950   scale-105 z-10'
                      : cell
                      ? cell === 'X'
                        ? 'bg-slate-800/90 text-indigo-400 border border-indigo-500/30'
                        : 'bg-slate-800/90 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-950/70 border border-slate-800 hover:bg-slate-800/40'
                  }`}
                >
                  {cell}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Footer */}
 <div className="mt-4 grid grid-cols-3 gap-2 w-full text-center">
 <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Thắng (X)</span>
 <span className="text-sm font-bold text-emerald-400">{stats.wins}</span>
          </div>
 <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Hòa</span>
 <span className="text-sm font-bold text-amber-400">{stats.draws}</span>
          </div>
 <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Thua (O)</span>
 <span className="text-sm font-bold text-rose-400">{stats.losses}</span>
          </div>
        </div>
      </div>
    </GameShell>
  );
};
