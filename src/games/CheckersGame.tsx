import React, { useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { Crown, RotateCcw } from 'lucide-react';

type PieceColor = 'red' | 'white';

interface Piece {
  color: PieceColor;
  isKing: boolean;
}

type Board = (Piece | null)[][];

interface Move {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  jumpedR?: number;
  jumpedC?: number;
}

interface CheckersGameProps {
  onBackToHub: () => void;
}

export const CheckersGame: React.FC<CheckersGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('checkers')!;

  const [board, setBoard] = useState<Board>(() => initCheckersBoard());
  const [turn, setTurn] = useState<PieceColor>('red');
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [winner, setWinner] = useState<PieceColor | null>(null);
  const [score, setScore] = useState(0);

  function initCheckersBoard(): Board {
    const b: Board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3) b[r][c] = { color: 'white', isKing: false };
          else if (r > 4) b[r][c] = { color: 'red', isKing: false };
        }
      }
    }
    return b;
  }

  const resetGame = useCallback(() => {
    setBoard(initCheckersBoard());
    setTurn('red');
    setSelectedPos(null);
    setValidMoves([]);
    setWinner(null);
    setScore(0);
  }, []);

  // Calculate valid moves for a piece at (r, c)
  const getMovesForPiece = useCallback((r: number, c: number, b: Board): Move[] => {
    const piece = b[r][c];
    if (!piece) return [];

    const moves: Move[] = [];
    const directions: [number, number][] = [];

    // Red moves up (-1), White moves down (+1), Kings move both
    if (piece.color === 'red' || piece.isKing) {
      directions.push([-1, -1], [-1, 1]);
    }
    if (piece.color === 'white' || piece.isKing) {
      directions.push([1, -1], [1, 1]);
    }

    // 1. Check Jumps (Captures)
    for (const [dr, dc] of directions) {
      const overR = r + dr;
      const overC = c + dc;
      const landR = r + dr * 2;
      const landC = c + dc * 2;

      if (landR >= 0 && landR < 8 && landC >= 0 && landC < 8) {
        const overPiece = b[overR][overC];
        const landEmpty = b[landR][landC] === null;

        if (overPiece && overPiece.color !== piece.color && landEmpty) {
          moves.push({
            fromR: r,
            fromC: c,
            toR: landR,
            toC: landC,
            jumpedR: overR,
            jumpedC: overC,
          });
        }
      }
    }

    // 2. Check Simple Steps (if no jumps or standard rules)
    for (const [dr, dc] of directions) {
      const toR = r + dr;
      const toC = c + dc;
      if (toR >= 0 && toR < 8 && toC >= 0 && toC < 8) {
        if (b[toR][toC] === null) {
          moves.push({ fromR: r, fromC: c, toR, toC });
        }
      }
    }

    return moves;
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (winner) return;

    const clickedPiece = board[r][c];

    // If clicking own piece, select it and show legal moves
    if (clickedPiece && clickedPiece.color === turn) {
      playMoveSound();
      setSelectedPos([r, c]);
      const moves = getMovesForPiece(r, c, board);
      setValidMoves(moves);
      return;
    }

    // If clicking a destination square for selected piece
    if (selectedPos) {
      const move = validMoves.find(m => m.toR === r && m.toC === c);
      if (move) {
        // Execute move
        executeMove(move);
      }
    }
  };

  const executeMove = (move: Move) => {
    const nextBoard = board.map(row => [...row]);
    const piece = nextBoard[move.fromR][move.fromC]!;

    nextBoard[move.fromR][move.fromC] = null;

    // King promotion check
    let becameKing = piece.isKing;
    if (piece.color === 'red' && move.toR === 0) becameKing = true;
    if (piece.color === 'white' && move.toR === 7) becameKing = true;

    nextBoard[move.toR][move.toC] = {
      color: piece.color,
      isKing: becameKing,
    };

    // Remove captured piece if jump
    let wasJump = false;
    if (move.jumpedR !== undefined && move.jumpedC !== undefined) {
      nextBoard[move.jumpedR][move.jumpedC] = null;
      wasJump = true;
      playClearSound();
      triggerHaptic(25);
      if (piece.color === 'red') setScore(s => s + 100);
    } else {
      playMoveSound();
      triggerHaptic(15);
    }

    setBoard(nextBoard);
    setSelectedPos(null);
    setValidMoves([]);

    // Check winner: count pieces of both sides
    let redCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (nextBoard[r][c]?.color === 'red') redCount++;
        if (nextBoard[r][c]?.color === 'white') whiteCount++;
      }
    }

    if (whiteCount === 0) {
      setWinner('red');
      playClearSound();
      return;
    }
    if (redCount === 0) {
      setWinner('white');
      playGameOverSound();
      return;
    }

    setTurn(turn === 'red' ? 'white' : 'red');
  };

  // Count active pieces
  let redCount = 0;
  let whiteCount = 0;
  board.forEach(row => {
    row.forEach(p => {
      if (p?.color === 'red') redCount++;
      if (p?.color === 'white') whiteCount++;
    });
  });

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={winner !== null}
      isPaused={false}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={winner === 'red'}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Status header */}
 <div className="w-full flex items-center justify-between px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl mb-3 ">
 <div className="flex items-center gap-2">
 <span className="text-xs text-slate-400">Lượt:</span>
 <div className="flex items-center gap-1.5">
              <span
 className={`w-3.5 h-3.5 rounded-full ${
                  turn === 'red' ? 'bg-rose-500  ' : 'bg-slate-200  '
                }`}
              />
 <span className="text-xs font-bold text-white">
                {turn === 'red' ? 'Quân Đỏ' : 'Quân Trắng'}
              </span>
            </div>
          </div>

 <div className="flex items-center gap-4 text-xs font-bold">
 <span className="text-rose-400">🔴 {redCount}</span>
 <span className="text-slate-200">⚪ {whiteCount}</span>
          </div>
        </div>

        {/* 8x8 Checkerboard */}
 <div className="relative p-2.5 bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-[390px] aspect-square game-touch-zone">
 <div className="grid grid-cols-8 gap-0.5 w-full h-full bg-slate-950 p-1 rounded-2xl">
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isDarkSquare = (r + c) % 2 === 1;
                const isSelected = selectedPos?.[0] === r && selectedPos?.[1] === c;
                const isValidTarget = validMoves.some(m => m.toR === r && m.toC === c);

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
 className={`aspect-square flex items-center justify-center select-none relative cursor-pointer ${
                      isDarkSquare ? 'bg-slate-800' : 'bg-slate-700/40'
                    }`}
                  >
                    {/* Destination marker dot */}
                    {isValidTarget && (
 <div className="w-3.5 h-3.5 rounded-full bg-indigo-400 animate-ping z-20" />
                    )}

                    {/* Piece */}
                    {cell && (
                      <div
 className={`w-4/5 h-4/5 rounded-full border-2 flex items-center justify-center transition-transform ${
                          cell.color === 'red'
                            ? 'bg-rose-600 border-rose-400 '
                            : 'bg-slate-100 border-white text-slate-900 '
                        } ${isSelected ? 'ring-4 ring-indigo-400 scale-110 z-10' : ''}`}
                      >
                        {cell.isKing && (
 <Crown className={`w-3.5 h-3.5 ${cell.color === 'red' ? 'text-amber-300' : 'text-amber-600'}`} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

 <p className="mt-3 text-[11px] text-slate-400 text-center">
          Nhấp quân của bạn để hiển thị các nước đi và nước nhảy ăn quân hợp lệ
        </p>
      </div>
    </GameShell>
  );
};
