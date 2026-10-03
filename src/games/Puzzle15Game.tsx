import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Clock, MousePointerClick, Shuffle } from 'lucide-react';

interface Puzzle15GameProps {
  onBackToHub: () => void;
}

export const Puzzle15Game: React.FC<Puzzle15GameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('puzzle-15')!;

  const [board, setBoard] = useState<number[]>(() =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]
  );
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Check if solved: 1 to 15 in order, last is 0
  const checkWin = (b: number[]): boolean => {
    for (let i = 0; i < 15; i++) {
      if (b[i] !== i + 1) return false;
    }
    return b[15] === 0;
  };

  // Shuffle by making 160 random valid moves from solved state to guarantee solvability
  const shuffleBoard = useCallback(() => {
    const cur = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    let blankIdx = 15;

    for (let i = 0; i < 160; i++) {
      const validNeighbors: number[] = [];
      const row = Math.floor(blankIdx / 4);
      const col = blankIdx % 4;

      if (row > 0) validNeighbors.push(blankIdx - 4); // Up
      if (row < 3) validNeighbors.push(blankIdx + 4); // Down
      if (col > 0) validNeighbors.push(blankIdx - 1); // Left
      if (col < 3) validNeighbors.push(blankIdx + 1); // Right

      const swapIdx = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      [cur[blankIdx], cur[swapIdx]] = [cur[swapIdx], cur[blankIdx]];
      blankIdx = swapIdx;
    }

    setBoard(cur);
    setMoves(0);
    setTimer(0);
    setIsTimerRunning(false);
    setIsGameOver(false);
    setScore(0);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    shuffleBoard();
  }, [shuffleBoard]);

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && !isGameOver && !isPaused) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isGameOver, isPaused]);

  const slideTile = useCallback((index: number) => {
    if (isGameOver || isPaused) return;

    const blankIdx = board.indexOf(0);
    const row = Math.floor(index / 4);
    const col = index % 4;
    const blankRow = Math.floor(blankIdx / 4);
    const blankCol = blankIdx % 4;

    const isAdjacent =
      (Math.abs(row - blankRow) === 1 && col === blankCol) ||
      (Math.abs(col - blankCol) === 1 && row === blankRow);

    if (isAdjacent) {
      if (!isTimerRunning) setIsTimerRunning(true);

      playMoveSound();
      triggerHaptic(15);

      const nextBoard = [...board];
      [nextBoard[index], nextBoard[blankIdx]] = [nextBoard[blankIdx], nextBoard[index]];
      setBoard(nextBoard);
      setMoves(m => m + 1);

      if (checkWin(nextBoard)) {
        playClearSound();
        triggerHaptic(35);
        setIsGameOver(true);
        setIsTimerRunning(false);
        const finalScore = Math.max(100, 2000 - (moves + 1) * 15 - timer * 5);
        setScore(finalScore);
      }
    }
  }, [board, isGameOver, isPaused, isTimerRunning, moves, timer]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const blankIdx = board.indexOf(0);
      const row = Math.floor(blankIdx / 4);
      const col = blankIdx % 4;

      if (e.code === 'ArrowUp' && row < 3) {
        e.preventDefault();
        slideTile(blankIdx + 4);
      } else if (e.code === 'ArrowDown' && row > 0) {
        e.preventDefault();
        slideTile(blankIdx - 4);
      } else if (e.code === 'ArrowLeft' && col < 3) {
        e.preventDefault();
        slideTile(blankIdx + 1);
      } else if (e.code === 'ArrowRight' && col > 0) {
        e.preventDefault();
        slideTile(blankIdx - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [board, slideTile]);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={shuffleBoard}
      onBackToHub={onBackToHub}
      isVictory={isGameOver}
      gameCustomStats={
 <div className="flex items-center gap-2">
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-slate-400">
 <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />
 <span className="font-bold text-white">{moves}</span>
          </div>
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-slate-400">
 <Clock className="w-3.5 h-3.5 text-amber-400" />
 <span className="font-bold text-white">{timer}s</span>
          </div>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        {/* Shuffle CTA button */}
 <div className="w-full flex items-center justify-between mb-3 px-1">
 <span className="text-xs text-slate-400">
            Sắp xếp các ô số từ 1 đến 15
          </span>
          <button
            onClick={shuffleBoard}
 className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:translate-y-[2px] "
            style={{
              background: '#3730a3',
              border: '1px solid rgba(129,140,248,0.6)',
              color: '#e0e7ff',
            }}
          >
 <Shuffle className="w-3.5 h-3.5" />
            <span>Trộn lại</span>
          </button>
        </div>

        {/* 4x4 Grid Board */}
        <div
 className="relative p-3 rounded-3xl w-full aspect-square game-touch-zone"
          style={{
            background: '#020617',
            border: '1px solid rgba(51,65,85,0.9)',
          }}
        >
 <div className="grid grid-cols-4 gap-2.5 w-full h-full">
            {board.map((val, idx) => {
              const isBlank = val === 0;
              const isCorrectPosition = val === idx + 1;

              return (
                <button
                  key={`tile-${idx}`}
                  disabled={isBlank}
                  onClick={() => slideTile(idx)}
 className={`rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-black transition-all duration-150 select-none cursor-pointer game-btn-press ${
                    isBlank ? 'opacity-0 pointer-events-none' : ''
                  }`}
                  style={
                    isBlank
                      ? { background: 'rgba(2,6,23,0.6)' }
                      : isCorrectPosition
                        ? {
                            background: '#059669',
                            border: '1px solid rgba(110,231,183,0.7)',
                            color: '#fff',
                          }
                        : {
                            background: '#1e293b',
                            border: '1px solid rgba(71,85,105,0.9)',
                            color: '#f1f5f9',
                          }
                  }
                >
                  {!isBlank && val}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </GameShell>
  );
};
