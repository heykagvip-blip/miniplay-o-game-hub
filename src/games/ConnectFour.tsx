import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { Bot, Users } from 'lucide-react';

const COLS = 7;
const ROWS = 6;

type CellValue = 'RED' | 'YELLOW' | null;
type Board = CellValue[][];

interface WinningLine {
  winner: 'RED' | 'YELLOW';
  cells: [number, number][];
}

interface ConnectFourProps {
  onBackToHub: () => void;
}

export const ConnectFour: React.FC<ConnectFourProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('connect-four')!;

  const [board, setBoard] = useState<Board>(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
  );
  const [turn, setTurn] = useState<'RED' | 'YELLOW'>('RED');
  const [isAiMode, setIsAiMode] = useState(true);
  const [winningInfo, setWinningInfo] = useState<WinningLine | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [score, setScore] = useState(0);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const resetGame = useCallback(() => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setTurn('RED');
    setWinningInfo(null);
    setIsDraw(false);
  }, []);

  // Check 4-in-a-row
  const checkWin = useCallback((b: Board): WinningLine | null => {
    // Horizontal check
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const val = b[r][c];
        if (val && val === b[r][c + 1] && val === b[r][c + 2] && val === b[r][c + 3]) {
          return {
            winner: val,
            cells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]],
          };
        }
      }
    }

    // Vertical check
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 4; r++) {
        const val = b[r][c];
        if (val && val === b[r + 1][c] && val === b[r + 2][c] && val === b[r + 3][c]) {
          return {
            winner: val,
            cells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]],
          };
        }
      }
    }

    // Diagonal (\) check
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const val = b[r][c];
        if (val && val === b[r + 1][c + 1] && val === b[r + 2][c + 2] && val === b[r + 3][c + 3]) {
          return {
            winner: val,
            cells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]],
          };
        }
      }
    }

    // Diagonal (/) check
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const val = b[r][c];
        if (val && val === b[r - 1][c + 1] && val === b[r - 2][c + 2] && val === b[r - 3][c + 3]) {
          return {
            winner: val,
            cells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]],
          };
        }
      }
    }

    return null;
  }, []);

  const dropDisc = useCallback((col: number, currentBoard: Board, player: 'RED' | 'YELLOW') => {
    // Find lowest empty row in column
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (currentBoard[r][col] === null) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return null; // Column is full

    const newBoard = currentBoard.map(row => [...row]);
    newBoard[targetRow][col] = player;
    return { newBoard, targetRow };
  }, []);

  // Smart AI decision maker
  const getAiColumn = useCallback((currentBoard: Board): number => {
    const validCols: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (currentBoard[0][c] === null) validCols.push(c);
    }
    if (validCols.length === 0) return 0;

    // 1. Can AI win on next move?
    for (const c of validCols) {
      const res = dropDisc(c, currentBoard, 'YELLOW');
      if (res && checkWin(res.newBoard)?.winner === 'YELLOW') {
        return c;
      }
    }

    // 2. Can Player win on next move? Block them!
    for (const c of validCols) {
      const res = dropDisc(c, currentBoard, 'RED');
      if (res && checkWin(res.newBoard)?.winner === 'RED') {
        return c;
      }
    }

    // 3. Prefer center columns (3, then 2/4)
    if (validCols.includes(3)) return 3;
    const centerCols = [2, 4, 1, 5, 0, 6].filter(c => validCols.includes(c));
    return centerCols[0];
  }, [checkWin, dropDisc]);

  // AI Turn effect
  useEffect(() => {
    if (winningInfo || isDraw || turn !== 'YELLOW' || !isAiMode) return;

    const timer = setTimeout(() => {
      const aiCol = getAiColumn(board);
      const res = dropDisc(aiCol, board, 'YELLOW');
      if (res) {
        playMoveSound();
        triggerHaptic(15);
        setBoard(res.newBoard);

        const win = checkWin(res.newBoard);
        if (win) {
          setWinningInfo(win);
          playGameOverSound();
        } else {
          // Check draw
          const full = res.newBoard.every(row => row.every(c => c !== null));
          if (full) {
            setIsDraw(true);
          } else {
            setTurn('RED');
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [board, turn, isAiMode, winningInfo, isDraw, getAiColumn, dropDisc, checkWin]);

  const handleColumnClick = (col: number) => {
    if (winningInfo || isDraw) return;
    if (isAiMode && turn === 'YELLOW') return;

    const res = dropDisc(col, board, turn);
    if (!res) return; // Column full

    playMoveSound();
    triggerHaptic(20);
    setBoard(res.newBoard);

    const win = checkWin(res.newBoard);
    if (win) {
      setWinningInfo(win);
      if (win.winner === 'RED') {
        playClearSound();
        setScore(s => s + 500);
      } else {
        playGameOverSound();
      }
    } else {
      const full = res.newBoard.every(row => row.every(c => c !== null));
      if (full) {
        setIsDraw(true);
      } else {
        setTurn(turn === 'RED' ? 'YELLOW' : 'RED');
      }
    }
  };

  const isCellWinning = (r: number, c: number): boolean => {
    if (!winningInfo) return false;
    return winningInfo.cells.some(([wr, wc]) => wr === r && wc === c);
  };

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={winningInfo !== null && !isDraw}
      isPaused={false}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={winningInfo?.winner === 'RED'}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Mode Selector */}
 <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-3">
          <button
            onClick={() => {
              setIsAiMode(true);
              resetGame();
            }}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isAiMode ? 'bg-indigo-600 text-white ' : 'text-slate-400 hover:text-white'
            }`}
          >
 <Bot className="w-3.5 h-3.5" />
            <span>Đấu với AI</span>
          </button>
          <button
            onClick={() => {
              setIsAiMode(false);
              resetGame();
            }}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              !isAiMode ? 'bg-indigo-600 text-white ' : 'text-slate-400 hover:text-white'
            }`}
          >
 <Users className="w-3.5 h-3.5" />
            <span>2 Người Chơi</span>
          </button>
        </div>

        {/* Turn indicator banner */}
 <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl mb-3">
 <div className="flex items-center gap-2">
 <span className="text-xs text-slate-400">Lượt hiện tại:</span>
 <div className="flex items-center gap-1.5">
              <span
 className={`w-3.5 h-3.5 rounded-full ${
                  turn === 'RED' ? 'bg-rose-500  ' : 'bg-amber-400  '
                }`}
              />
 <span className="text-xs font-bold text-white">
                {turn === 'RED' ? 'Quân Đỏ (Bạn)' : isAiMode ? 'Quân Vàng (Máy)' : 'Quân Vàng (P2)'}
              </span>
            </div>
          </div>

          {winningInfo && (
 <span className="text-xs font-black text-emerald-400 animate-pulse">
              🏆 {winningInfo.winner === 'RED' ? 'Quân Đỏ' : 'Quân Vàng'} Thắng!
            </span>
          )}
 {isDraw && <span className="text-xs font-bold text-amber-400">Hòa cờ!</span>}
        </div>

        {/* Connect Four Grid */}
 <div className="relative p-3 bg-blue-700/90 border-4 border-blue-600 rounded-3xl w-full max-w-[380px]">
 <div className="grid grid-cols-7 gap-2 w-full">
            {Array(COLS).fill(null).map((_, c) => (
              <div
                key={`col-${c}`}
                onClick={() => handleColumnClick(c)}
                onMouseEnter={() => setHoveredCol(c)}
                onMouseLeave={() => setHoveredCol(null)}
 className="flex flex-col gap-2 cursor-pointer group"
              >
                {Array(ROWS).fill(null).map((_, r) => {
                  const val = board[r][c];
                  const isWinning = isCellWinning(r, c);

                  return (
                    <div
                      key={`cell-${r}-${c}`}
 className={`aspect-square rounded-full flex items-center justify-center transition-all duration-200 ${
                        val === 'RED'
                          ? 'bg-rose-500 border-2 border-rose-300  '
                          : val === 'YELLOW'
                          ? 'bg-amber-400 border-2 border-amber-200  '
                          : 'bg-slate-950/80 group-hover:bg-slate-900 border border-blue-800'
                      } ${isWinning ? 'ring-4 ring-white animate-bounce' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

 <p className="mt-3 text-[11px] text-slate-400 text-center">
          Nhấp hoặc chạm vào cột để thả đồng xu xuống vị trí thấp nhất
        </p>
      </div>
    </GameShell>
  );
};
