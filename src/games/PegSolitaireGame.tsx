import React, { useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound } from '../utils/sound';

const CELLS = Array.from({ length: 49 }, (_, index) => index).filter(index => {
  const row = Math.floor(index / 7);
  const col = index % 7;
  return (row >= 2 && row <= 4) || (col >= 2 && col <= 4);
});
const STARTING_PEGS = new Set(CELLS.filter(index => index !== 24));

const hasMove = (pegs: Set<number>) => [...pegs].some(index => {
  const row = Math.floor(index / 7);
  const col = index % 7;
  return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
    const middle = (row + dr) * 7 + col + dc;
    const destination = (row + dr * 2) * 7 + col + dc * 2;
    return CELLS.includes(destination) && pegs.has(middle) && !pegs.has(destination);
  });
});

export const PegSolitaireGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('peg-solitaire')!;
  const [pegs, setPegs] = useState<Set<number>>(() => new Set(STARTING_PEGS));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [ended, setEnded] = useState(false);
  const won = ended && pegs.size === 1;

  const restart = () => {
    setPegs(new Set(STARTING_PEGS));
    setSelected(null);
    setMoves(0);
    setEnded(false);
  };

  const clickCell = (index: number) => {
    if (ended || !CELLS.includes(index)) return;
    if (selected === null || pegs.has(index)) {
      setSelected(pegs.has(index) ? index : null);
      return;
    }
    const fromRow = Math.floor(selected / 7);
    const fromCol = selected % 7;
    const toRow = Math.floor(index / 7);
    const toCol = index % 7;
    if (Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol) !== 2) return;
    const middle = ((fromRow + toRow) / 2) * 7 + (fromCol + toCol) / 2;
    if (!pegs.has(middle)) return;
    const next = new Set(pegs);
    next.delete(selected);
    next.delete(middle);
    next.add(index);
    setPegs(next);
    setSelected(null);
    setMoves(value => value + 1);
    playMoveSound();
    if (next.size === 1) {
      setEnded(true);
      playClearSound();
    } else if (!hasMove(next)) {
      setEnded(true);
    }
  };

  return (
 <GameShell game={gameMeta} score={won ? Math.max(0, 1000 - moves * 10) : 0} isGameOver={ended} isVictory={won} isPaused={false} onRestart={restart} onBackToHub={onBackToHub} gameCustomStats={<span className="text-xs text-slate-300">Còn {pegs.size} quân</span>}>
 <div className="flex flex-col items-center gap-4">
 <p className="text-sm text-slate-300 text-center">Nhảy qua một quân để loại nó. Đưa bàn cờ về còn một quân.</p>
        <div
 className="grid grid-cols-7 gap-1.5 rounded-2xl p-3 border border-amber-900/40"
          style={{
            background:
              'repeating-#7c4a21, #5b3517',
          }}
        >
          {Array.from({ length: 49 }, (_, index) =>
            CELLS.includes(index) ? (
              <button
                key={index}
                onClick={() => clickCell(index)}
                aria-label={`Ô ${index + 1}`}
 className={`grid h-9 w-9 place-items-center rounded-full transition sm:h-11 sm:w-11 ${
                  selected !== null ? 'hover:brightness-110' : ''
                }`}
                style={
                  pegs.has(index)
                    ? {
                        background:
                          selected === index
                            ? '#b45309'
                            : '#0369a1',
                        outline: selected === index ? '3px solid rgba(253,230,138,0.9)' : 'none',
                        transform: selected === index ? 'scale(1.12)' : 'scale(1)',
                      }
                    : {
                        background:
                          selected !== null
                            ? 'rgba(253,230,138,0.32)'
                            : 'rgba(0,0,0,0.25)',
                        outline: selected !== null ? '2px solid rgba(253,230,138,0.5)' : 'none',
                      }
                }
              >
 {pegs.has(index) && <span className="h-2 w-2 rounded-full bg-slate-900/30" />}
              </button>
            ) : (
 <span key={index} className="h-9 w-9 sm:h-11 sm:w-11" />
            )
          )}
        </div>
        {ended && (
 <p className={`font-bold ${won ? 'text-emerald-300' : 'text-amber-300'}`}>
            {won ? `Xuất sắc! Hoàn thành sau ${moves} nước.` : `Hết nước đi, còn ${pegs.size} quân.`}
          </p>
        )}
        {ended && (
          <button
            onClick={restart}
 className="rounded-xl px-5 py-2.5 text-sm font-black text-white game-btn-press"
            style={{
              background: '#047857',
            }}
          >
            Chơi lại
          </button>
        )}
      </div>
    </GameShell>
  );
};