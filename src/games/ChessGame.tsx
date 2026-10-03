import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { Undo2, RotateCcw, AlertTriangle } from 'lucide-react';

const PIECE_UNICODE: Record<string, string> = {
  w_p: '♙',
  w_n: '♘',
  w_b: '♗',
  w_r: '♖',
  w_q: '♕',
  w_k: '♔',
  b_p: '♟',
  b_n: '♞',
  b_b: '♝',
  b_r: '♜',
  b_q: '♛',
  b_k: '♚',
};

interface ChessGameProps {
  onBackToHub: () => void;
}

export const ChessGame: React.FC<ChessGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('chess')!;

  const [game, setGame] = useState<Chess>(() => new Chess());
  const [board, setBoard] = useState(game.board());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [isCheck, setIsCheck] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [score, setScore] = useState(0);

  const updateStateFromGame = (currentGame: Chess) => {
    setBoard(currentGame.board());
    setIsCheck(currentGame.inCheck());
    setMoveHistory(currentGame.history());

    if (currentGame.isCheckmate()) {
      setIsGameOver(true);
      const winner = currentGame.turn() === 'w' ? 'Quân Đen' : 'Quân Trắng';
      setGameResult(`Chiếu bí! ${winner} giành chiến thắng!`);
      playClearSound();
      setScore(1000);
    } else if (currentGame.isDraw()) {
      setIsGameOver(true);
      setGameResult('Ván cờ kết thúc Hòa!');
      playGameOverSound();
    }
  };

  const resetGame = useCallback(() => {
    const newG = new Chess();
    setGame(newG);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setIsGameOver(false);
    setGameResult(null);
    setPendingPromotion(null);
    setScore(0);
    updateStateFromGame(newG);
  }, []);

  const handleSquareClick = (square: Square) => {
    if (isGameOver || pendingPromotion) return;

    const piece = game.get(square);

    // If clicking own piece, select it
    if (piece && piece.color === game.turn()) {
      playMoveSound();
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
      return;
    }

    // If destination square clicked
    if (selectedSquare) {
      // Check if this move requires pawn promotion (pawn reaches 8th/1st rank)
      const selectedPiece = game.get(selectedSquare);
      const isPawnPromotion =
        selectedPiece?.type === 'p' &&
        ((selectedPiece.color === 'w' && square.endsWith('8')) ||
          (selectedPiece.color === 'b' && square.endsWith('1')));

      if (isPawnPromotion && possibleMoves.includes(square)) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      // Try making move
      try {
        const move = game.move({
          from: selectedSquare,
          to: square,
        });

        if (move) {
          playMoveSound();
          triggerHaptic(15);
          setSelectedSquare(null);
          setPossibleMoves([]);
          updateStateFromGame(game);
        }
      } catch {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  };

  const handlePromote = (promoPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    try {
      const move = game.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: promoPiece,
      });

      if (move) {
        playClearSound();
        triggerHaptic(25);
        setPendingPromotion(null);
        setSelectedSquare(null);
        setPossibleMoves([]);
        updateStateFromGame(game);
      }
    } catch {
      setPendingPromotion(null);
    }
  };

  const handleUndo = () => {
    if (isGameOver || pendingPromotion) return;
    game.undo();
    setSelectedSquare(null);
    setPossibleMoves([]);
    updateStateFromGame(game);
    playMoveSound();
  };

  const turn = game.turn() === 'w' ? 'Trắng' : 'Đen';

  const verboseHistory = game.history({ verbose: true });
  const lastMoveSquare: { from: Square; to: Square } | null =
    verboseHistory.length > 0
      ? { from: verboseHistory[verboseHistory.length - 1].from, to: verboseHistory[verboseHistory.length - 1].to }
      : null;

  const checkedKingSquare: Square | null = (() => {
    if (!isCheck || isGameOver) return null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === game.turn()) {
          return `${String.fromCharCode(97 + c)}${8 - r}` as Square;
        }
      }
    }
    return null;
  })();

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={false}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={game.isCheckmate() && game.turn() === 'b'}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Status header */}
 <div className="w-full flex items-center justify-between px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl mb-3 ">
 <div className="flex items-center gap-2">
 <span className="text-xs text-slate-400">Lượt đi:</span>
            <span
 className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                game.turn() === 'w'
                  ? 'bg-slate-200 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              Quân {turn}
            </span>
          </div>

 <div className="flex items-center gap-2">
            {isCheck && !isGameOver && (
 <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
 <AlertTriangle className="w-3.5 h-3.5" /> Chiếu tướng!
              </span>
            )}

            <button
              onClick={handleUndo}
              disabled={moveHistory.length === 0}
 className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 disabled:opacity-40"
            >
 <Undo2 className="w-3.5 h-3.5" />
              <span>Hoàn tác</span>
            </button>
          </div>
        </div>

        {/* 8x8 Chessboard */}
 <div className="relative p-2.5 bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-[390px] aspect-square game-touch-zone">
 <div className="grid grid-cols-8 gap-0 w-full h-full rounded-2xl overflow-hidden border border-slate-700">
            {board.map((row, r) =>
              row.map((cell, c) => {
                const square = `${String.fromCharCode(97 + c)}${8 - r}` as Square;
                const isDarkSquare = (r + c) % 2 === 1;
                const isSelected = selectedSquare === square;
                const isTarget = possibleMoves.includes(square);

                return (
                  <button
                    key={square}
                    onClick={() => handleSquareClick(square)}
 className={`aspect-square flex items-center justify-center text-3xl sm:text-4xl select-none relative cursor-pointer font-bold ${
                      isDarkSquare ? 'bg-indigo-950/70' : 'bg-slate-700/50'
                    } ${isSelected ? 'ring-4 ring-indigo-400 z-10' : ''}`}
                  >
                    {/* Legal move dot */}
                    {isTarget && (
 <div className="w-3 h-3 rounded-full bg-emerald-400/80 absolute z-20 pointer-events-none ring-2 ring-emerald-300" />
                    )}

                    {/* Piece */}
                    {cell && (
                      <span
 className={`transition-transform duration-100 ${
                          cell.color === 'w'
                            ? 'text-white -[0_2px_4px_rgba(0,0,0,0.9)]'
                            : 'text-slate-950'
                        }`}
                      >
                        {PIECE_UNICODE[`${cell.color}_${cell.type}`]}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Promotion Picker Modal */}
        {pendingPromotion && (
 <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 text-center ">
 <h3 className="text-sm font-bold text-white mb-3">Chọn quân phong cấp</h3>
 <div className="flex items-center gap-3">
                {[
                  { type: 'q', label: 'Hậu (Queen)', icon: '♛' },
                  { type: 'r', label: 'Xe (Rook)', icon: '♜' },
                  { type: 'b', label: 'Tượng (Bishop)', icon: '♝' },
                  { type: 'n', label: 'Mã (Knight)', icon: '♞' },
                ].map(p => (
                  <button
                    key={p.type}
                    onClick={() => handlePromote(p.type as 'q' | 'r' | 'b' | 'n')}
 className="p-3 rounded-2xl bg-slate-800 hover:bg-indigo-600 text-3xl transition"
                  >
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Move History Log */}
        {moveHistory.length > 0 && (
 <div className="w-full mt-3 p-2 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-2 overflow-x-auto text-xs text-slate-400 whitespace-nowrap">
 <span className="font-bold text-slate-300">Nước đi:</span>
            {moveHistory.slice(-8).map((m, i) => (
 <span key={i} className="px-2 py-0.5 rounded-lg bg-slate-800 text-indigo-300 font-mono">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </GameShell>
  );
};
