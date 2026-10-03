import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trophy } from 'lucide-react';

type Board = number[][];

interface Game2048Props {
  onBackToHub: () => void;
}

const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  2: { bg: '#94a3b8', text: 'text-slate-900' },
  4: { bg: '#64748b', text: 'text-slate-900' },
  8: { bg: '#d97706', text: 'text-slate-950' },
  16: { bg: '#c2410c', text: 'text-white' },
  32: { bg: '#be123c', text: 'text-white' },
  64: { bg: '#991b1b', text: 'text-white' },
  128: { bg: '#ca8a04', text: 'text-slate-950' },
  256: { bg: '#4d7c0f', text: 'text-slate-950' },
  512: { bg: '#15803d', text: 'text-white' },
  1024: { bg: '#0e7490', text: 'text-slate-950' },
  2048: { bg: '#6d28d9', text: 'text-white' },
  4096: { bg: '#9d174d', text: 'text-white' },
};

const FALLBACK_TILE = { bg: '#4338ca', text: 'text-white font-black' };

/** Flat fill for a tile value (0 renders the empty well). */
function tileSurface(val: number): React.CSSProperties {
  if (val === 0) {
    return { background: 'rgba(2,6,23,0.8)' };
  }
  return { background: (TILE_COLORS[val] || FALLBACK_TILE).bg };
}

const tileText = (val: number): string => (TILE_COLORS[val] || FALLBACK_TILE).text;

export const Game2048: React.FC<Game2048Props> = ({ onBackToHub }) => {
  const gameMeta = getGameById('2048')!;

  const [board, setBoard] = useState<Board>(() => [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [keepPlayingAfterWin, setKeepPlayingAfterWin] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Spawn random tile (90% chance of 2, 10% chance of 4)
  const spawnTile = useCallback((currentBoard: Board): Board => {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length === 0) return currentBoard;

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[randomCell.r][randomCell.c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  }, []);

  const resetGame = useCallback(() => {
    let emptyBoard: Board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    emptyBoard = spawnTile(emptyBoard);
    emptyBoard = spawnTile(emptyBoard);
    setBoard(emptyBoard);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setHasWon(false);
    setKeepPlayingAfterWin(false);
  }, [spawnTile]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Check if any moves remain
  const checkGameOver = (currentBoard: Board): boolean => {
    // Check empty cells
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) return false;
        // Check adjacent horizontal
        if (c < 3 && currentBoard[r][c] === currentBoard[r][c + 1]) return false;
        // Check adjacent vertical
        if (r < 3 && currentBoard[r][c] === currentBoard[r + 1][c]) return false;
      }
    }
    return true;
  };

  // Slide and merge one row to the left
  const slideAndMergeRow = (row: number[]): { newRow: number[]; points: number; won: boolean } => {
    // Filter non-zero
    const filtered = row.filter(val => val !== 0);
    const result: number[] = [];
    let points = 0;
    let won = false;
    let i = 0;

    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const mergedVal = filtered[i] * 2;
        result.push(mergedVal);
        points += mergedVal;
        if (mergedVal === 2048) won = true;
        i += 2;
      } else {
        result.push(filtered[i]);
        i += 1;
      }
    }

    while (result.length < 4) {
      result.push(0);
    }

    return { newRow: result, points, won };
  };

  const move = useCallback((direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => {
    if (isGameOver || isPaused) return;

    let pointsGained = 0;
    let reached2048 = false;
    let boardChanged = false;
    let newBoard: Board = board.map(row => [...row]);

    if (direction === 'LEFT') {
      for (let r = 0; r < 4; r++) {
        const { newRow, points, won } = slideAndMergeRow(board[r]);
        newBoard[r] = newRow;
        pointsGained += points;
        if (won) reached2048 = true;
        if (newRow.some((val, c) => val !== board[r][c])) boardChanged = true;
      }
    } else if (direction === 'RIGHT') {
      for (let r = 0; r < 4; r++) {
        const reversed = [...board[r]].reverse();
        const { newRow, points, won } = slideAndMergeRow(reversed);
        newBoard[r] = newRow.reverse();
        pointsGained += points;
        if (won) reached2048 = true;
        if (newBoard[r].some((val, c) => val !== board[r][c])) boardChanged = true;
      }
    } else if (direction === 'UP') {
      for (let c = 0; c < 4; c++) {
        const col = [board[0][c], board[1][c], board[2][c], board[3][c]];
        const { newRow, points, won } = slideAndMergeRow(col);
        pointsGained += points;
        if (won) reached2048 = true;
        for (let r = 0; r < 4; r++) {
          newBoard[r][c] = newRow[r];
          if (newBoard[r][c] !== board[r][c]) boardChanged = true;
        }
      }
    } else if (direction === 'DOWN') {
      for (let c = 0; c < 4; c++) {
        const col = [board[3][c], board[2][c], board[1][c], board[0][c]];
        const { newRow, points, won } = slideAndMergeRow(col);
        pointsGained += points;
        if (won) reached2048 = true;
        const finalCol = newRow.reverse();
        for (let r = 0; r < 4; r++) {
          newBoard[r][c] = finalCol[r];
          if (newBoard[r][c] !== board[r][c]) boardChanged = true;
        }
      }
    }

    if (!boardChanged) return;

    if (pointsGained > 0) {
      playClearSound();
      triggerHaptic(20);
    } else {
      playMoveSound();
      triggerHaptic(10);
    }

    setScore(s => s + pointsGained);

    // Spawn new tile
    const boardWithSpawn = spawnTile(newBoard);
    setBoard(boardWithSpawn);

    if (reached2048 && !hasWon && !keepPlayingAfterWin) {
      setHasWon(true);
    }

    if (checkGameOver(boardWithSpawn)) {
      setIsGameOver(true);
    }
  }, [board, isGameOver, isPaused, hasWon, keepPlayingAfterWin, spawnTile]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        move('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        move('RIGHT');
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        move('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        move('DOWN');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const threshold = 35; // minimum px for swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) move('RIGHT');
        else move('LEFT');
      }
    } else {
      if (Math.abs(diffY) > threshold) {
        if (diffY > 0) move('DOWN');
        else move('UP');
      }
    }
  };

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={hasWon && !keepPlayingAfterWin}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        {/* Win Banner */}
        {hasWon && !keepPlayingAfterWin && (
 <div className="mb-3 w-full p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-center animate-in zoom-in-95">
 <span className="text-sm font-bold text-indigo-300">
              🎉 Bạn đã chạm mốc 2048!
            </span>
            <button
              onClick={() => setKeepPlayingAfterWin(true)}
 className="mt-1 block mx-auto text-xs text-white underline hover:text-indigo-200"
            >
              Tiếp tục chơi để nâng cao điểm số →
            </button>
          </div>
        )}

        {/* 2048 Board Container */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
 className="relative p-3 rounded-3xl border border-slate-800 w-full max-w-[340px] sm:max-w-[360px] aspect-square game-touch-zone"
          style={{
            background: '#020617',
          }}
        >
          <div
 className="grid grid-cols-4 gap-2.5 w-full h-full"
            style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}
          >
            {board.map((row, r) =>
              row.map((val, c) => {
                return (
                  <div
                    key={`${r}-${c}`}
 className={`rounded-2xl flex items-center justify-center font-bold transition-all duration-100 select-none ${
                      val === 0 ? 'border border-slate-800/40' : 'scale-100'
                    }`}
                    style={tileSurface(val)}
                  >
                    {val > 0 && (
                      <span
 className={`${tileText(val)} ${
                          val >= 1000
                            ? 'text-lg sm:text-xl'
                            : val >= 100
                            ? 'text-xl sm:text-2xl'
                            : 'text-2xl sm:text-3xl'
                        }`}
                      >
                        {val}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile On-Screen D-Pad */}
 <div className="mt-4 flex flex-col items-center gap-1.5 md:hidden">
          <button
            onClick={() => move('UP')}
 className="w-14 h-11 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
 <ArrowUp className="w-5 h-5" />
          </button>
 <div className="flex items-center gap-6">
            <button
              onClick={() => move('LEFT')}
 className="w-14 h-11 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
            >
 <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => move('RIGHT')}
 className="w-14 h-11 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
            >
 <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => move('DOWN')}
 className="w-14 h-11 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
 <ArrowDown className="w-5 h-5" />
          </button>
        </div>
      </div>
    </GameShell>
  );
};
