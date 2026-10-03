import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playBounceSound, playScoreSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { Clock, Flame, Sparkles } from 'lucide-react';

interface MoleHole {
  id: number;
  active: boolean;
  type: 'normal' | 'golden' | 'bomb';
}

interface WhackAMoleGameProps {
  onBackToHub: () => void;
}

const GAME_DURATION = 35; // 35 seconds

export const WhackAMoleGame: React.FC<WhackAMoleGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('whack-a-mole')!;

  const [holes, setHoles] = useState<MoleHole[]>(() =>
    Array(9).fill(null).map((_, i) => ({ id: i, active: false, type: 'normal' }))
  );
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [whackedHole, setWhackedHole] = useState<number | null>(null);

  const resetGame = useCallback(() => {
    setHoles(Array(9).fill(null).map((_, i) => ({ id: i, active: false, type: 'normal' })));
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setCombo(0);
    setMaxCombo(0);
    setIsGameOver(false);
    setIsPaused(false);
    setWhackedHole(null);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isGameOver || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsGameOver(true);
          playGameOverSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameOver, isPaused]);

  // Mole pop-up loop
  useEffect(() => {
    if (isGameOver || isPaused) return;

    // Faster as time runs out
    const delay = Math.max(450, 850 - (GAME_DURATION - timeLeft) * 14);

    const interval = setInterval(() => {
      setHoles(prev => {
        const next = prev.map(h => ({ ...h, active: false }));
        // Pick 1 or 2 random holes
        const count = Math.random() > 0.65 ? 2 : 1;
        const availableIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => 0.5 - Math.random());

        for (let i = 0; i < count; i++) {
          const idx = availableIndices[i];
          const randType = Math.random();
          const type: 'normal' | 'golden' | 'bomb' =
            randType < 0.15 ? 'golden' : randType < 0.28 ? 'bomb' : 'normal';
          next[idx] = { id: idx, active: true, type };
        }
        return next;
      });
    }, delay);

    return () => clearInterval(interval);
  }, [isGameOver, isPaused, timeLeft]);

  const handleWhack = (index: number) => {
    if (isGameOver || isPaused) return;

    const hole = holes[index];
    if (!hole.active) {
      // Missed hit, reset combo
      setCombo(0);
      return;
    }

    setWhackedHole(index);
    setTimeout(() => setWhackedHole(null), 250);

    // Hide mole
    setHoles(prev =>
      prev.map((h, i) => (i === index ? { ...h, active: false } : h))
    );

    if (hole.type === 'bomb') {
      // Hit a bomb!
      playGameOverSound();
      triggerHaptic(40);
      setCombo(0);
      setScore(s => Math.max(0, s - 25));
    } else {
      // Hit a mole
      playBounceSound();
      triggerHaptic(20);
      const isGold = hole.type === 'golden';
      const basePoints = isGold ? 35 : 10;
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo(m => Math.max(m, nextCombo));

      const points = basePoints + Math.min(nextCombo * 5, 50);
      setScore(s => s + points);

      if (isGold) playClearSound();
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
      gameCustomStats={
 <div className="flex items-center gap-2">
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-amber-400">
 <Flame className="w-3.5 h-3.5 fill-amber-400" />
 <span className="font-bold">{combo}x Combo</span>
          </div>
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-slate-400">
 <Clock className="w-3.5 h-3.5 text-rose-400" />
 <span className="font-bold text-white">{timeLeft}s</span>
          </div>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        {/* Time progress bar */}
 <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-2.5 mb-4">
 <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-1">
            <span>Thời gian còn lại:</span>
 <strong className="text-white">{timeLeft} giây</strong>
          </div>
 <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 ">
            <div
 className={`h-full transition-all duration-300 rounded-full ${
                timeLeft > 10 ? '' : 'animate-pulse'
              }`}
              style={{
                width: `${(timeLeft / GAME_DURATION) * 100}%`,
                background:
                  timeLeft > 10
                    ? '#22d3ee'
                    : '#fb923c',
              }}
            />
          </div>
        </div>

        {/* 3x3 Mole Holes Board */}
        <div
 className="relative p-3 rounded-3xl w-full aspect-square game-touch-zone overflow-hidden border border-emerald-900/50"
          style={{
            background:
              '#052e16',
          }}
        >
          {/* Grass texture */}
          <div
 className="absolute inset-0 opacity-[0.18] pointer-events-none"
            style={{
              backgroundImage:
                'repeating-rgba(134,239,172,0.7)',
            }}
          />
 <div className="relative grid grid-cols-3 gap-3 w-full h-full" style={{ gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
            {holes.map((h, idx) => {
              const isWhacked = whackedHole === idx;

              return (
                <button
                  key={h.id}
                  onClick={() => handleWhack(idx)}
 className={`rounded-3xl flex items-end justify-center relative overflow-hidden select-none cursor-pointer game-btn-press border-0 p-0 transition-transform duration-150 active:scale-95 ${
                    isWhacked ? 'scale-95' : ''
                  }`}
                  style={{ aspectRatio: '1 / 1', minWidth: 0, minHeight: 0 }}
                >
                  {/* Dirt mound with 3D shading */}
                  <span
 className="absolute inset-x-1 bottom-1 h-[38%] rounded-[45%]"
                    style={{
                      background:
                        '#2a1a0d',
                      outline: h.active ? '3px solid rgba(120, 53, 15, 0.9)' : 'none',
                    }}
                  />
                  {/* Hole mouth */}
                  <span
 className="absolute inset-x-[18%] bottom-[8%] h-[16%] rounded-full bg-black"
                  />

                  {/* Mole character */}
                  {h.active && (
                    <span
 className="absolute inset-x-0 bottom-[10%] z-10 flex justify-center text-4xl sm:text-5xl pointer-events-none animate-in slide-in-from-bottom-6 duration-150"
                      style={{
                        filter:
                          h.type === 'golden'
                            ? 'drop-(0 0 10px rgba(250,204,21,0.95))'
                            : h.type === 'bomb'
                            ? 'drop-(0 0 10px rgba(244,63,94,0.9))'
                            : 'drop-(0 3px 5px rgba(0,0,0,0.6))',
                      }}
                    >
                      {h.type === 'golden' ? '🐹' : h.type === 'bomb' ? '💣' : '🐭'}
                    </span>
                  )}

                  {/* Pop ring on whack */}
                  {isWhacked && (
                    <span
 className="absolute inset-0 flex items-center justify-center text-3xl font-black z-20 animate-in zoom-in pointer-events-none"
                    >
                      💥
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
 <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-400">
 <span className="flex items-center gap-1">🐭 Chuột (+10)</span>
 <span className="flex items-center gap-1">🐹 Chuột Vàng (+35)</span>
 <span className="flex items-center gap-1 text-rose-400">💣 Bom (-25)</span>
        </div>
      </div>
    </GameShell>
  );
};
