import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { RotateCw, ArrowDown, ArrowLeft, ArrowRight, ChevronsDown } from 'lucide-react';

const COLS = 10;
const ROWS = 20;

// Tetromino definitions
const TETROMINOES: Record<string, { shape: number[][]; color: string }> = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: '#06b6d4', // Cyan
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#3b82f6', // Blue
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#f97316', // Orange
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#eab308', // Yellow
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: '#22c55e', // Green
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#a855f7', // Purple
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: '#ef4444', // Red
  },
};

const TETROMINO_KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Flat fill for a tetromino cell. */
function cellStyle(color: string): React.CSSProperties {
  return {
    background: color,
  };
}

interface Piece {
  key: string;
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

interface TetrisGameProps {
  onBackToHub: () => void;
}

export const TetrisGame: React.FC<TetrisGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('tetris')!;

  const [grid, setGrid] = useState<string[][]>(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(''))
  );
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPieceKey, setNextPieceKey] = useState<string>('T');
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const currentPieceRef = useRef<Piece | null>(null);
  currentPieceRef.current = currentPiece;

  const gridRef = useRef<string[][]>(grid);
  gridRef.current = grid;

  const getRandomPiece = useCallback((key?: string): Piece => {
    const k = key || TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
    const def = TETROMINOES[k];
    return {
      key: k,
      shape: def.shape.map(row => [...row]),
      color: def.color,
      x: Math.floor((COLS - def.shape[0].length) / 2),
      y: 0,
    };
  }, []);

  const checkCollision = useCallback((piece: Piece, g: string[][], offsetX = 0, offsetY = 0): boolean => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] !== 0) {
          const newX = piece.x + c + offsetX;
          const newY = piece.y + r + offsetY;

          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          if (newY >= 0 && g[newY][newX] !== '') {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const resetGame = useCallback(() => {
    const newGrid = Array(ROWS).fill(null).map(() => Array(COLS).fill(''));
    const nextKey = TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
    const firstPiece = getRandomPiece();

    setGrid(newGrid);
    setCurrentPiece(firstPiece);
    setNextPieceKey(nextKey);
    setScore(0);
    setLines(0);
    setLevel(1);
    setIsGameOver(false);
    setIsPaused(false);
  }, [getRandomPiece]);

  // Initial spawn
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const lockPiece = useCallback((piece: Piece) => {
    const newGrid = gridRef.current.map(row => [...row]);

    // Stamp piece
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] !== 0) {
          const ny = piece.y + r;
          const nx = piece.x + c;
          if (ny < 0) {
            setIsGameOver(true);
            return;
          }
          newGrid[ny][nx] = piece.color;
        }
      }
    }

    // Check full lines
    let clearedCount = 0;
    const filteredGrid = newGrid.filter(row => {
      const isFull = row.every(cell => cell !== '');
      if (isFull) clearedCount++;
      return !isFull;
    });

    while (filteredGrid.length < ROWS) {
      filteredGrid.unshift(Array(COLS).fill(''));
    }

    if (clearedCount > 0) {
      playClearSound();
      triggerHaptic(30);
      const points = [0, 100, 300, 500, 800][clearedCount] || 800;
      setScore(s => s + points * level);
      setLines(l => {
        const nextLines = l + clearedCount;
        setLevel(Math.floor(nextLines / 10) + 1);
        return nextLines;
      });
    } else {
      playMoveSound();
      triggerHaptic(15);
    }

    setGrid(filteredGrid);

    // Spawn next piece
    const nextP = getRandomPiece(nextPieceKey);
    const newNextKey = TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
    setNextPieceKey(newNextKey);

    if (checkCollision(nextP, filteredGrid)) {
      setIsGameOver(true);
    } else {
      setCurrentPiece(nextP);
    }
  }, [checkCollision, getRandomPiece, level, nextPieceKey]);

  const moveHorizontal = useCallback((dir: number) => {
    const p = currentPieceRef.current;
    if (!p || isGameOver || isPaused) return;

    if (!checkCollision(p, gridRef.current, dir, 0)) {
      playMoveSound();
      setCurrentPiece(prev => prev ? { ...prev, x: prev.x + dir } : null);
    }
  }, [checkCollision, isGameOver, isPaused]);

  const rotatePiece = useCallback(() => {
    const p = currentPieceRef.current;
    if (!p || isGameOver || isPaused) return;

    // Transpose and reverse rows
    const rotated = p.shape[0].map((_, index) =>
      p.shape.map(row => row[index]).reverse()
    );

    const testPiece: Piece = { ...p, shape: rotated };

    // Basic wall kick check (offset 0, +1, -1, +2, -2)
    const kicks = [0, 1, -1, 2, -2];
    for (const offset of kicks) {
      if (!checkCollision(testPiece, gridRef.current, offset, 0)) {
        playMoveSound();
        triggerHaptic(15);
        setCurrentPiece({
          ...testPiece,
          x: p.x + offset,
        });
        return;
      }
    }
  }, [checkCollision, isGameOver, isPaused]);

  const dropDown = useCallback(() => {
    const p = currentPieceRef.current;
    if (!p || isGameOver || isPaused) return;

    if (!checkCollision(p, gridRef.current, 0, 1)) {
      setCurrentPiece(prev => prev ? { ...prev, y: prev.y + 1 } : null);
    } else {
      lockPiece(p);
    }
  }, [checkCollision, isGameOver, isPaused, lockPiece]);

  const hardDrop = useCallback(() => {
    const p = currentPieceRef.current;
    if (!p || isGameOver || isPaused) return;

    let dropDistance = 0;
    while (!checkCollision(p, gridRef.current, 0, dropDistance + 1)) {
      dropDistance++;
    }

    const droppedPiece = { ...p, y: p.y + dropDistance };
    setScore(s => s + dropDistance * 2);
    lockPiece(droppedPiece);
  }, [checkCollision, isGameOver, isPaused, lockPiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        moveHorizontal(-1);
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        moveHorizontal(1);
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        rotatePiece();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        dropDown();
      } else if (e.code === 'Space') {
        e.preventDefault();
        hardDrop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveHorizontal, rotatePiece, dropDown, hardDrop]);

  // Game fall interval loop
  useEffect(() => {
    if (isGameOver || isPaused) return;
    const speed = Math.max(100, 750 - (level - 1) * 65);
    const interval = setInterval(dropDown, speed);
    return () => clearInterval(interval);
  }, [dropDown, isGameOver, isPaused, level]);

  // Calculate Ghost Piece position
  let ghostY = currentPiece ? currentPiece.y : 0;
  if (currentPiece) {
    while (!checkCollision(currentPiece, grid, 0, ghostY - currentPiece.y + 1)) {
      ghostY++;
    }
  }

  // Next piece preview matrix
  const nextDef = TETROMINOES[nextPieceKey];

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
 <div className="flex items-center gap-2">
 <div className="tetris-status-pill px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5 text-slate-400">
            <span>Cấp:</span>
 <span className="font-bold text-indigo-400">{level}</span>
          </div>
 <div className="tetris-status-pill px-2.5 py-1 rounded-xl border text-xs hidden sm:flex items-center gap-1.5 text-slate-400">
            <span>Hàng:</span>
 <span className="font-bold text-emerald-400">{lines}</span>
          </div>
        </div>
      }
    >
 <div className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-lg mx-auto w-full">
        {/* Main Tetris Grid */}
 <div className="tetris-board-frame relative p-2.5 rounded-2xl border ">
          <div
 className="tetris-board grid grid-cols-10 gap-0.5 p-1.5 rounded-xl border w-[240px] sm:w-[270px]"
            style={{ aspectRatio: '10/20' }}
          >
            {grid.map((row, r) =>
              row.map((cellColor, c) => {
                let displayColor = cellColor;
                let isGhost = false;

                // Check active piece
                if (currentPiece) {
                  const pr = r - currentPiece.y;
                  const pc = c - currentPiece.x;
                  if (
                    pr >= 0 &&
                    pr < currentPiece.shape.length &&
                    pc >= 0 &&
                    pc < currentPiece.shape[pr].length &&
                    currentPiece.shape[pr][pc] !== 0
                  ) {
                    displayColor = currentPiece.color;
                  } else {
                    // Check ghost piece
                    const gr = r - ghostY;
                    if (
                      gr >= 0 &&
                      gr < currentPiece.shape.length &&
                      pc >= 0 &&
                      pc < currentPiece.shape[gr].length &&
                      currentPiece.shape[gr][pc] !== 0 &&
                      !displayColor
                    ) {
                      isGhost = true;
                    }
                  }
                }

                return (
                  <div
                    key={`${r}-${c}`}
 className={`aspect-square rounded-[3px] ${
                      displayColor
                        ? ''
                        : isGhost
                        ? 'border border-dashed border-indigo-400/40 bg-indigo-500/10'
                        : 'tetris-cell-empty'
                    }`}
                    style={displayColor ? cellStyle(displayColor) : undefined}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Side Panel: Next piece preview & controls summary */}
 <div className="flex flex-row md:flex-col items-center gap-3 w-full md:w-36 justify-between md:justify-start">
          {/* Next Piece Box */}
 <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl w-32 text-center">
 <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
              Khối tiếp theo
            </span>
 <div className="flex items-center justify-center h-16">
              <div
 className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${nextDef.shape[0].length}, minmax(0, 1fr))`,
                }}
              >
                {nextDef.shape.map((row, r) =>
                  row.map((val, c) => (
                    <div
                      key={`next-${r}-${c}`}
 className="w-4 h-4 rounded-sm"
                      style={val ? cellStyle(nextDef.color) : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick stats box */}
 <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl w-32 text-center hidden md:block">
 <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Đã xóa
            </span>
 <span className="text-xl font-black text-emerald-400">{lines} hàng</span>
          </div>
        </div>
      </div>

      {/* Intuitive On-Screen Controls Pad */}
 <div className="mt-4 flex flex-col items-center gap-2.5 w-full max-w-xs">
        {/* Row 1: Left & Right */}
 <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              moveHorizontal(-1);
            }}
 className="game-control-button py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 font-bold text-sm game-btn-press flex items-center justify-center gap-2 select-none"
            aria-label="Sang trái"
          >
 <ArrowLeft className="w-5 h-5" />
            <span>Trái</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              moveHorizontal(1);
            }}
 className="game-control-button py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 font-bold text-sm game-btn-press flex items-center justify-center gap-2 select-none"
            aria-label="Sang phải"
          >
            <span>Phải</span>
 <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Row 2: Soft Drop & Rotate */}
 <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              dropDown();
            }}
 className="game-control-button py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 font-bold text-sm game-btn-press flex items-center justify-center gap-2 select-none"
            aria-label="Rơi nhanh"
          >
 <ArrowDown className="w-5 h-5 text-indigo-400" />
            <span>Rơi nhanh</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              rotatePiece();
            }}
 className="game-control-button py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 font-bold text-sm game-btn-press flex items-center justify-center gap-2 select-none"
            aria-label="Xoay khối"
          >
 <RotateCw className="w-5 h-5 text-amber-400" />
            <span>Xoay</span>
          </button>
        </div>

        {/* Row 3: Hard Drop */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            hardDrop();
          }}
 className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 border border-indigo-500 text-white font-bold text-sm game-btn-press flex items-center justify-center gap-2 select-none"
          aria-label="Rơi tức thì"
        >
 <ChevronsDown className="w-5 h-5" />
          <span>Thả rơi tức thì (Hard Drop)</span>
        </button>
      </div>
    </GameShell>
  );
};
