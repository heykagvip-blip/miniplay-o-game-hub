import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { Flag, Bomb, Clock, Settings, Sparkles } from 'lucide-react';

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

interface DifficultyConfig {
  id: string;
  label: string;
  rows: number;
  cols: number;
  mines: number;
}

const DIFFICULTIES: DifficultyConfig[] = [
  { id: 'easy', label: 'Dễ (8x8)', rows: 8, cols: 8, mines: 10 },
  { id: 'medium', label: 'Vừa (12x12)', rows: 12, cols: 12, mines: 20 },
  { id: 'hard', label: 'Khó (16x16)', rows: 16, cols: 16, mines: 40 },
  { id: 'custom', label: 'Tùy chỉnh', rows: 10, cols: 10, mines: 15 },
];

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400 font-bold',
  2: 'text-emerald-400 font-bold',
  3: 'text-rose-400 font-bold',
  4: 'text-purple-400 font-bold',
  5: 'text-amber-400 font-bold',
  6: 'text-cyan-400 font-bold',
  7: 'text-pink-400 font-bold',
  8: 'text-white font-black',
};

interface MinesweeperProps {
  onBackToHub: () => void;
}

export const Minesweeper: React.FC<MinesweeperProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('minesweeper')!;

  const [diffIndex, setDiffIndex] = useState(0);
  const [customConfig, setCustomConfig] = useState({ rows: 10, cols: 10, mines: 15 });
  const [showCustomModal, setShowCustomModal] = useState(false);

  const currentDiff = diffIndex === 3 ? { ...DIFFICULTIES[3], ...customConfig } : DIFFICULTIES[diffIndex];

  const [grid, setGrid] = useState<Cell[][]>([]);
  const [isFirstClick, setIsFirstClick] = useState(true);
  const [flagMode, setFlagMode] = useState(false); // Mobile flag toggle
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [score, setScore] = useState(0);
  const [bestTimes, setBestTimes] = useState<Record<string, number>>({});

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load best times
  useEffect(() => {
    try {
      const raw = localStorage.getItem('miniplay_minesweeper_best_times');
      if (raw) setBestTimes(JSON.parse(raw));
    } catch {}
  }, []);

  // Initialize empty grid
  const initBoard = useCallback(() => {
    const { rows, cols } = currentDiff;
    const newGrid: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setIsFirstClick(true);
    setTimer(0);
    setIsTimerRunning(false);
    setIsGameOver(false);
    setIsVictory(false);
    setScore(0);
  }, [currentDiff]);

  useEffect(() => {
    initBoard();
  }, [initBoard]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && !isGameOver && !isVictory) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isGameOver, isVictory]);

  // Place mines after first click
  const populateMines = (startR: number, startC: number, board: Cell[][]) => {
    const { rows, cols, mines } = currentDiff;
    let placed = 0;
    const maxMines = Math.min(mines, rows * cols - 9);

    while (placed < maxMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Avoid placing mine on or directly adjacent to first clicked cell
      const isTooClose = Math.abs(r - startR) <= 1 && Math.abs(c - startC) <= 1;

      if (!board[r][c].isMine && !isTooClose) {
        board[r][c].isMine = true;
        placed++;
      }
    }

    // Calculate neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                if (board[nr][nc].isMine) count++;
              }
            }
          }
          board[r][c].neighborMines = count;
        }
      }
    }
  };

  // Flood fill reveal empty neighbors
  const floodReveal = (r: number, c: number, board: Cell[][]) => {
    const { rows, cols } = currentDiff;
    const queue: [number, number][] = [[r, c]];

    while (queue.length > 0) {
      const [currR, currC] = queue.shift()!;
      const cell = board[currR][currC];

      if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;
      cell.isRevealed = true;

      if (cell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (!board[nr][nc].isRevealed && !board[nr][nc].isFlagged) {
                queue.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  };

  // Chord Reveal: When clicking on an already revealed number whose flag count matches the number, reveal remaining neighbors!
  const handleChord = (r: number, c: number, board: Cell[][]): boolean => {
    const cell = board[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return false;

    const { rows, cols } = currentDiff;
    let flaggedNeighbors = 0;
    const unflaggedNeighbors: [number, number][] = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          if (board[nr][nc].isFlagged) {
            flaggedNeighbors++;
          } else if (!board[nr][nc].isRevealed) {
            unflaggedNeighbors.push([nr, nc]);
          }
        }
      }
    }

    if (flaggedNeighbors === cell.neighborMines && unflaggedNeighbors.length > 0) {
      let hitMine = false;
      for (const [nr, nc] of unflaggedNeighbors) {
        if (board[nr][nc].isMine) {
          hitMine = true;
          board[nr][nc].isRevealed = true;
        } else {
          floodReveal(nr, nc, board);
        }
      }
      return hitMine;
    }
    return false;
  };

  const handleCellClick = (r: number, c: number) => {
    if (isGameOver || isVictory) return;

    const cell = grid[r][c];

    // If cell is already revealed, try chord reveal!
    if (cell.isRevealed) {
      const newGrid = grid.map(row => row.map(cl => ({ ...cl })));
      const hitMine = handleChord(r, c, newGrid);
      if (hitMine) {
        newGrid.forEach(row => row.forEach(cl => { if (cl.isMine) cl.isRevealed = true; }));
        setGrid(newGrid);
        setIsGameOver(true);
        playGameOverSound();
        triggerHaptic(50);
        return;
      }
      // Check win after chord
      evaluateBoardState(newGrid);
      return;
    }

    // If flag mode is on, toggle flag instead
    if (flagMode) {
      handleToggleFlag(r, c);
      return;
    }

    if (cell.isFlagged) return;

    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));

    // First click handling
    if (isFirstClick) {
      setIsFirstClick(false);
      setIsTimerRunning(true);
      populateMines(r, c, newGrid);
    }

    // Hit mine
    if (newGrid[r][c].isMine) {
      newGrid.forEach(row => {
        row.forEach(cl => {
          if (cl.isMine) cl.isRevealed = true;
        });
      });
      setGrid(newGrid);
      setIsGameOver(true);
      playGameOverSound();
      triggerHaptic(50);
      return;
    }

    // Safe reveal
    floodReveal(r, c, newGrid);
    playMoveSound();
    triggerHaptic(15);

    evaluateBoardState(newGrid);
  };

  const evaluateBoardState = (board: Cell[][]) => {
    let revealedCount = 0;
    const totalCells = currentDiff.rows * currentDiff.cols;
    const targetNonMines = totalCells - currentDiff.mines;

    board.forEach(row => {
      row.forEach(cl => {
        if (cl.isRevealed && !cl.isMine) revealedCount++;
      });
    });

    const currentScore = revealedCount * 10;
    setScore(currentScore);

    if (revealedCount === targetNonMines) {
      // Won!
      setIsVictory(true);
      setIsGameOver(true);
      setIsTimerRunning(false);
      playClearSound();
      const finalScore = currentScore + Math.max(100, 1000 - timer * 10);
      setScore(finalScore);

      // Save best time
      const diffKey = currentDiff.id;
      const prevBest = bestTimes[diffKey];
      if (!prevBest || timer < prevBest) {
        const nextBests = { ...bestTimes, [diffKey]: timer };
        setBestTimes(nextBests);
        try {
          localStorage.setItem('miniplay_minesweeper_best_times', JSON.stringify(nextBests));
        } catch {}
      }
    }

    setGrid(board);
  };

  const handleToggleFlag = (r: number, c: number, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isGameOver || isVictory) return;

    const cell = grid[r][c];
    if (cell.isRevealed) return;

    playMoveSound();
    triggerHaptic(15);

    const newGrid = grid.map(row => row.map(cl => ({ ...cl })));
    newGrid[r][c].isFlagged = !newGrid[r][c].isFlagged;
    setGrid(newGrid);
  };

  // Touch handlers for Long Press to Flag
  const handleTouchStart = (r: number, c: number) => {
    longPressTimerRef.current = setTimeout(() => {
      handleToggleFlag(r, c);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Count placed flags
  let flagCount = 0;
  grid.forEach(row => {
    row.forEach(cell => {
      if (cell.isFlagged) flagCount++;
    });
  });
  const remainingMines = Math.max(0, currentDiff.mines - flagCount);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={false}
      onRestart={initBoard}
      onBackToHub={onBackToHub}
      isVictory={isVictory}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto">
        {/* Difficulty switcher tabs */}
        <div
 className="p-1 flex flex-wrap items-center justify-center gap-1.5 mb-3"
          style={{
            background: 'rgba(2,6,23,0.9)',
            border: '1px solid rgba(51,65,85,0.9)',
            borderRadius: '1rem',
          }}
        >
          {DIFFICULTIES.map((diff, idx) => (
            <button
              key={diff.id}
              onClick={() => {
                setDiffIndex(idx);
                playMoveSound();
                if (diff.id === 'custom') setShowCustomModal(true);
              }}
 className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={
                diffIndex === idx
                  ? {
                      background: '#4338ca',
                      color: '#fff',
                    }
                  : {
                      color: '#94a3b8',
                    }
              }
            >
              {diff.label}
            </button>
          ))}
        </div>

        {/* Status Bar: Mines Counter, Face Emoji, Timer & Best Time */}
        <div
 className="flex items-center justify-between w-full max-w-sm px-4 py-2 mb-3 rounded-2xl"
          style={{
            background: 'rgba(2,6,23,0.95)',
            border: '1px solid rgba(51,65,85,0.9)',
          }}
        >
 <div className="flex items-center gap-1.5 text-rose-400 font-black text-sm">
 <Bomb className="w-4 h-4" />
            <span>{String(remainingMines).padStart(2, '0')}</span>
          </div>

          <button
            onClick={initBoard}
 className="text-2xl hover:scale-110 active:scale-95 transition-transform p-1"
            title="Chơi lại"
          >
            {isVictory ? '😎' : isGameOver ? '😵' : isTimerRunning ? '😮' : '😊'}
          </button>

 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1.5 text-amber-400 font-black text-sm">
 <Clock className="w-4 h-4" />
              <span>{String(timer).padStart(3, '0')}s</span>
            </div>

            {bestTimes[currentDiff.id] && (
 <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline" title="Thời gian nhanh nhất">
                ⭐ {bestTimes[currentDiff.id]}s
              </span>
            )}
          </div>
        </div>

        {/* Board Container */}
        <div
 className="p-2 sm:p-3 rounded-3xl overflow-auto max-w-full"
          style={{
            background: '#020617',
            border: '1px solid rgba(51,65,85,0.9)',
          }}
        >
          <div
 className="grid gap-1 select-none"
            style={{
              gridTemplateColumns: `repeat(${currentDiff.cols}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => handleToggleFlag(r, c, e)}
                  onTouchStart={() => handleTouchStart(r, c)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
 className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-150 active:scale-95 ${
                    cell.isRevealed
                      ? ''
                      : 'border-t border-slate-600 border-b-2 border-b-slate-950 text-white'
                  }`}
                  style={
                    cell.isRevealed
                      ? cell.isMine
                        ? {
                            background: '#b91c1c',
                          }
                        : {
                            background: 'rgba(2,6,23,0.95)',
                            border: '1px solid rgba(30,41,59,0.9)',
                          }
                      : {
                          background: '#334155',
                        }
                  }
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
 <Bomb className="w-4 h-4" />
                    ) : cell.neighborMines > 0 ? (
 <span className={NUMBER_COLORS[cell.neighborMines] || 'text-white'}>
                        {cell.neighborMines}
                      </span>
                    ) : null
                  ) : cell.isFlagged ? (
 <Flag className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Mobile Action Controls: Mode Switcher & Chord Info */}
 <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              setFlagMode(prev => !prev);
              playMoveSound();
              triggerHaptic(15);
            }}
 className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition game-btn-press ${
              flagMode
                ? 'bg-rose-600 text-white border-rose-500  '
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
 <Flag className={`w-4 h-4 ${flagMode ? 'fill-white' : ''}`} />
            <span>{flagMode ? 'Chế độ: ĐẶT CỜ 🚩' : 'Chế độ: MỞ Ô ⛏️'}</span>
          </button>

 <span className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 hidden sm:inline">
            💡 Mẹo: Nhấp vào số đã mở khi đủ cờ để mở nhanh các ô xung quanh (Chord)!
          </span>
        </div>

        {/* Custom Configuration Modal */}
        {showCustomModal && (
 <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-3xl p-5 text-left">
 <h3 className="text-base font-bold text-white mb-3">Tùy chỉnh bàn chơi</h3>
 <div className="space-y-3 text-xs">
                <div>
 <label className="text-slate-400 block mb-1">Số hàng (8 - 18):</label>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    value={customConfig.rows}
                    onChange={(e) => setCustomConfig(c => ({ ...c, rows: Math.max(8, Math.min(18, parseInt(e.target.value) || 8)) }))}
 className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
                <div>
 <label className="text-slate-400 block mb-1">Số cột (8 - 18):</label>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    value={customConfig.cols}
                    onChange={(e) => setCustomConfig(c => ({ ...c, cols: Math.max(8, Math.min(18, parseInt(e.target.value) || 8)) }))}
 className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
                <div>
 <label className="text-slate-400 block mb-1">Số mìn (5 - 60):</label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={customConfig.mines}
                    onChange={(e) => setCustomConfig(c => ({ ...c, mines: Math.max(5, Math.min(60, parseInt(e.target.value) || 5)) }))}
 className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
              </div>

 <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowCustomModal(false)}
 className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setShowCustomModal(false);
                    initBoard();
                  }}
 className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
};
