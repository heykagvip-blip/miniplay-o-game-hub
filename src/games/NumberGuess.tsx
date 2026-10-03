import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { ArrowUp, ArrowDown, Sparkles, Flame, Snowflake, RotateCcw } from 'lucide-react';

interface GuessRecord {
  guess: number;
  hint: 'HIGHER' | 'LOWER' | 'CORRECT';
  distance: number;
}

interface NumberGuessProps {
  onBackToHub: () => void;
}

export const NumberGuess: React.FC<NumberGuessProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('number-guess')!;

  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const maxRange = difficulty === 'easy' ? 100 : 500;
  const maxAttempts = difficulty === 'easy' ? 10 : 8;

  const [targetNumber, setTargetNumber] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [score, setScore] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const initGame = useCallback(() => {
    const range = difficulty === 'easy' ? 100 : 500;
    const secret = Math.floor(Math.random() * range) + 1;
    setTargetNumber(secret);
    setGuesses([]);
    setCurrentInput('');
    setIsGameOver(false);
    setIsVictory(false);
    setScore(0);
  }, [difficulty]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleGuess = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isGameOver || isVictory) return;

    const num = parseInt(currentInput, 10);
    if (isNaN(num) || num < 1 || num > maxRange) return;

    const diff = Math.abs(num - targetNumber);
    let hint: 'HIGHER' | 'LOWER' | 'CORRECT';

    if (num === targetNumber) {
      hint = 'CORRECT';
    } else if (num < targetNumber) {
      hint = 'HIGHER';
    } else {
      hint = 'LOWER';
    }

    const record: GuessRecord = { guess: num, hint, distance: diff };
    const nextGuesses = [record, ...guesses];
    setGuesses(nextGuesses);
    setCurrentInput('');

    if (hint === 'CORRECT') {
      playClearSound();
      triggerHaptic(35);
      setIsVictory(true);
      setIsGameOver(true);
      const remainingAttempts = maxAttempts - nextGuesses.length;
      const points = 500 + remainingAttempts * 100 + (difficulty === 'hard' ? 500 : 0);
      setScore(points);
    } else {
      playMoveSound();
      triggerHaptic(15);
      if (nextGuesses.length >= maxAttempts) {
        // Run out of attempts
        playGameOverSound();
        triggerHaptic(40);
        setIsGameOver(true);
      }
    }
  };

  const latestGuess = guesses[0];

  const getHeatBadge = (distance: number) => {
    if (distance <= 5) {
      return (
 <span className="flex items-center gap-1 text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
 <Flame className="w-3.5 h-3.5 fill-rose-500" /> Bỏng rát (Cách ≤ 5)
        </span>
      );
    }
    if (distance <= 15) {
      return (
 <span className="flex items-center gap-1 text-amber-400 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
 <Flame className="w-3.5 h-3.5" /> Ấm áp (Cách ≤ 15)
        </span>
      );
    }
    if (distance <= 30) {
      return (
 <span className="flex items-center gap-1 text-sky-400 font-bold text-xs bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
 <Snowflake className="w-3.5 h-3.5" /> Hơi lạnh (Cách ≤ 30)
        </span>
      );
    }
    return (
 <span className="flex items-center gap-1 text-indigo-300 font-bold text-xs bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
 <Snowflake className="w-3.5 h-3.5" /> Lạnh cóng
      </span>
    );
  };

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={false}
      onRestart={initGame}
      onBackToHub={onBackToHub}
      isVictory={isVictory}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Difficulty switcher */}
        <div
 className="flex items-center gap-2 p-1 mb-4"
          style={{
            background: 'rgba(2,6,23,0.9)',
            border: '1px solid rgba(51,65,85,0.9)',
            borderRadius: '1rem',
          }}
        >
          <button
            onClick={() => {
              setDifficulty('easy');
            }}
 className="flex-1 px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={
              difficulty === 'easy'
                ? {
                    background: '#4338ca',
                    color: '#fff',
                  }
                : { color: '#94a3b8', }
            }
          >
            Dễ (1 - 100) • 10 lượt
          </button>
          <button
            onClick={() => {
              setDifficulty('hard');
            }}
 className="flex-1 px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={
              difficulty === 'hard'
                ? {
                    background: '#4338ca',
                    color: '#fff',
                  }
                : { color: '#94a3b8', }
            }
          >
            Khó (1 - 500) • 8 lượt
          </button>
        </div>

        {/* Secret card box */}
        <div
 className="w-full rounded-3xl p-6 text-center mb-4 relative overflow-hidden"
          style={{
            background: 'rgba(2,6,23,0.98)',
            border: '1px solid rgba(99,102,241,0.35)',
          }}
        >
 <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-2">
            Con số bí mật trong khoảng [1 - {maxRange}]
          </span>

 <div className="my-3 flex items-center justify-center">
            <div
 className="w-24 h-24 rounded-3xl border-2 flex items-center justify-center text-4xl font-black text-indigo-200"
              style={{
                background: '#312e81',
                borderColor: 'rgba(129,140,248,0.6)',
              }}
            >
              {isGameOver || isVictory ? targetNumber : '?'}
            </div>
          </div>

          {/* Remaining attempts indicator */}
 <div className="mt-3 flex items-center justify-between text-xs text-slate-400 max-w-xs mx-auto">
            <span>Lượt còn lại:</span>
 <div className="flex items-center gap-1">
              {Array(maxAttempts).fill(null).map((_, i) => (
                <span
                  key={i}
 className={`w-2.5 h-2.5 rounded-full ${
                    i < maxAttempts - guesses.length
                      ? 'bg-indigo-500  '
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
 <strong className="text-white font-bold">{maxAttempts - guesses.length}</strong>
          </div>

          {/* Recent feedback prompt */}
          {latestGuess && !isGameOver && (
 <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col items-center gap-2 animate-in zoom-in-95">
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-white">
 Lần đoán trước: <span className="text-indigo-400">{latestGuess.guess}</span>
                </span>
                {latestGuess.hint === 'HIGHER' ? (
 <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
 <ArrowUp className="w-3.5 h-3.5" /> CẦN SỐ LỚN HƠN
                  </span>
                ) : (
 <span className="text-xs font-bold text-rose-400 flex items-center gap-0.5 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
 <ArrowDown className="w-3.5 h-3.5" /> CẦN SỐ NHỎ HƠN
                  </span>
                )}
              </div>
              {getHeatBadge(latestGuess.distance)}
            </div>
          )}
        </div>

        {/* Input guess form */}
        {!isGameOver && (
 <form onSubmit={handleGuess} className="w-full flex items-center gap-2 mb-4">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={maxRange}
              autoFocus
              placeholder={`Nhập số từ 1 đến ${maxRange}...`}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
 className="flex-1 py-3 px-4 bg-slate-900 border border-slate-700 rounded-2xl text-white font-bold text-center text-lg placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!currentInput}
 className="px-6 py-3 rounded-2xl disabled:opacity-40 text-white font-bold text-sm transition-all game-btn-press"
              style={{
                background: '#4338ca',
              }}
            >
              Đoán!
            </button>
          </form>
        )}

        {/* History log */}
        {guesses.length > 0 && (
          <div
 className="w-full rounded-2xl p-3"
            style={{
              background: 'rgba(2,6,23,0.85)',
              border: '1px solid rgba(51,65,85,0.9)',
            }}
          >
 <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
              Lịch sử các lần đoán ({guesses.length})
            </span>
 <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
              {guesses.map((g, idx) => (
                <div
                  key={idx}
 className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-xs text-white"
                >
 <span className="font-bold">{g.guess}</span>
                  {g.hint === 'HIGHER' ? (
 <ArrowUp className="w-3 h-3 text-emerald-400" />
                  ) : g.hint === 'LOWER' ? (
 <ArrowDown className="w-3 h-3 text-rose-400" />
                  ) : (
 <Sparkles className="w-3 h-3 text-amber-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
};
