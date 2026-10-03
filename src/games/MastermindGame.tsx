import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';

type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  pegs: number;
  colors: number;
  maxGuesses: number;
  baseScore: number;
}

interface GuessRow {
  guess: number[];
  exact: number;
  misplaced: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { pegs: 4, colors: 4, maxGuesses: 10, baseScore: 200 },
  medium: { pegs: 5, colors: 5, maxGuesses: 12, baseScore: 400 },
  hard: { pegs: 6, colors: 6, maxGuesses: 12, baseScore: 600 },
};

const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

const MAX_HINTS = 2;

const computeFeedback = (guess: number[], secret: number[]): { exact: number; misplaced: number } => {
  let exact = 0;
  let misplaced = 0;
  const secretUsed = Array(secret.length).fill(false);
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      exact++;
      secretUsed[i] = true;
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) continue;
    for (let j = 0; j < secret.length; j++) {
      if (!secretUsed[j] && guess[i] === secret[j]) {
        misplaced++;
        secretUsed[j] = true;
        break;
      }
    }
  }
  return { exact, misplaced };
};

const generateSecret = (pegs: number, colors: number): number[] => {
  const pool = Array.from({ length: colors }, (_, i) => i);
  const result: number[] = [];
  for (let i = 0; i < pegs; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
};

export const MastermindGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const config = DIFFICULTY_CONFIG[difficulty];

  const [secret, setSecret] = useState<number[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([]);
  const [selectedPeg, setSelectedPeg] = useState<number | null>(null);
  const [history, setHistory] = useState<GuessRow[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [score, setScore] = useState(0);

  const historyRef = useRef<HTMLDivElement>(null);

  const initGame = useCallback((diff: Difficulty) => {
    const cfg = DIFFICULTY_CONFIG[diff];
    setSecret(generateSecret(cfg.pegs, cfg.colors));
    setCurrentGuess(Array(cfg.pegs).fill(-1));
    setSelectedPeg(null);
    setHistory([]);
    setHintsUsed(0);
    setIsGameOver(false);
    setIsVictory(false);
    setScore(0);
  }, []);

  useEffect(() => {
    initGame(difficulty);
  }, [initGame, difficulty]);

  const submitGuess = useCallback(() => {
    if (isGameOver) return;
    if (currentGuess.some(c => c === -1)) return;
    const { exact, misplaced } = computeFeedback(currentGuess, secret);
    const nextHistory = [...history, { guess: [...currentGuess], exact, misplaced }];
    setHistory(nextHistory);
    if (exact === config.pegs) {
      setIsVictory(true);
      setIsGameOver(true);
      const remainingGuesses = config.maxGuesses - nextHistory.length;
      const computed = Math.max(50, config.baseScore + remainingGuesses * 25 - hintsUsed * 100);
      setScore(computed);
      playClearSound();
      triggerHaptic(50);
    } else if (nextHistory.length >= config.maxGuesses) {
      setIsGameOver(true);
      setScore(0);
    } else {
      playMoveSound();
      triggerHaptic(15);
    }
    setCurrentGuess(Array(config.pegs).fill(-1));
    setSelectedPeg(null);
  }, [isGameOver, currentGuess, secret, history, config, hintsUsed]);

  const selectColor = useCallback((colorIndex: number) => {
    if (isGameOver || selectedPeg === null) return;
    const next = [...currentGuess];
    next[selectedPeg] = colorIndex;
    setCurrentGuess(next);
    playMoveSound();
    triggerHaptic(10);
  }, [isGameOver, selectedPeg, currentGuess]);

  const useHint = useCallback(() => {
    if (isGameOver || hintsUsed >= MAX_HINTS) return;
    const wrongIndices = currentGuess.map((c, i) => c !== secret[i] ? i : -1).filter(i => i !== -1);
    if (wrongIndices.length === 0) return;
    const idx = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    const next = [...currentGuess];
    next[idx] = secret[idx];
    setCurrentGuess(next);
    setHintsUsed(h => h + 1);
    playScoreSound();
    triggerHaptic(20);
  }, [isGameOver, hintsUsed, currentGuess, secret]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!isGameOver && !currentGuess.some(c => c === -1)) {
          submitGuess();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGameOver, currentGuess, submitGuess]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

  const remainingGuesses = config.maxGuesses - history.length;
  const remainingPegs = currentGuess.filter(c => c === -1).length;
  const hintsLeft = MAX_HINTS - hintsUsed;

  return (
    <GameShell
      game={getGameById('mastermind')!}
      score={score}
      isGameOver={isGameOver}
      isPaused={false}
      onRestart={() => initGame(difficulty)}
      onBackToHub={onBackToHub}
      isVictory={isVictory}
      gameCustomStats={
        <div className="px-3 py-1 rounded-xl border theme-border flex items-center gap-1.5" style={{ background: 'var(--surface-strong)' }}>
          <span className="text-[10px] uppercase font-bold theme-muted">Còn lại:</span>
          <span className="text-sm font-black text-indigo-400">{remainingGuesses}</span>
          <span className="text-[10px] theme-muted">· Gợi ý {hintsLeft}</span>
        </div>
      }
    >
      <div className="flex flex-col h-full min-h-0 w-full max-w-md mx-auto">
        <div className="shrink-0 px-2 pt-2 pb-1">
          <div className="flex rounded-xl border theme-border overflow-hidden" style={{ background: 'var(--surface-soft)' }}>
            {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
              const cfg = DIFFICULTY_CONFIG[key];
              const active = key === difficulty;
              return (
                <button
                  key={key}
                  onClick={() => initGame(key)}
                  className={`flex-1 py-1.5 text-xs font-bold transition-colors ${active ? 'text-white' : 'theme-text'}`}
                  style={active ? { background: '#4f46e5' } : {}}
                >
                  {cfg.pegs}/{cfg.colors}/{cfg.maxGuesses}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={historyRef} className="flex-1 overflow-y-auto px-2 py-1 space-y-1.5">
          {history.map((row, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl border theme-border"
              style={{ background: 'var(--surface-soft)' }}
            >
              <div className="flex items-center gap-1">
                {row.guess.map((color, i) => (
                  <div
                    key={i}
                    className="h-7 w-7 rounded-md border-2 flex items-center justify-center text-[10px] font-black"
                    style={{
                      background: PALETTE[color],
                      borderColor: PALETTE[color],
                      color: '#fff',
                    }}
                  >
                    {color + 1}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#22c55e20', color: '#22c55e' }}>
                  {row.exact} đúng
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#eab30820', color: '#eab308' }}>
                  {row.misplaced} sai chỗ
                </span>
              </div>
            </div>
          ))}
          {isGameOver && (
            <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border-2" style={{ borderColor: '#ef4444', background: '#ef444410' }}>
              <span className="text-xs font-bold uppercase shrink-0" style={{ color: '#ef4444' }}>Mã bí mật</span>
              <div className="flex items-center gap-1">
                {secret.map((color, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-md border-2 flex items-center justify-center text-xs font-black"
                    style={{
                      background: PALETTE[color],
                      borderColor: PALETTE[color],
                      color: '#fff',
                    }}
                  >
                    {color + 1}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t p-2 space-y-2" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-soft)' }}>
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: config.pegs }).map((_, i) => {
              const colorIndex = currentGuess[i];
              const isSelected = selectedPeg === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedPeg(isSelected ? null : i)}
                  className="h-10 w-10 rounded-lg border-2 flex items-center justify-center text-sm font-black"
                  style={{
                    background: colorIndex === -1 ? 'transparent' : PALETTE[colorIndex],
                    borderColor: isSelected ? '#facc15' : (colorIndex === -1 ? 'var(--border-color)' : PALETTE[colorIndex]),
                    color: '#fff',
                  }}
                >
                  {colorIndex !== -1 ? colorIndex + 1 : ''}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: config.colors }).map((_, i) => (
              <button
                key={i}
                onClick={() => selectColor(i)}
                disabled={isGameOver || selectedPeg === null}
                className="h-9 w-9 rounded-lg border-2 flex items-center justify-center text-xs font-black active:translate-y-[2px] disabled:opacity-40"
                style={{
                  background: PALETTE[i],
                  borderColor: PALETTE[i],
                  color: '#fff',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={submitGuess}
              disabled={isGameOver || remainingPegs > 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold active:translate-y-[2px] disabled:opacity-40"
              style={{ background: '#4f46e5', color: '#fff' }}
            >
              Xác nhận
            </button>
            <button
              onClick={useHint}
              disabled={isGameOver || hintsLeft <= 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold active:translate-y-[2px] disabled:opacity-40"
              style={{ background: '#d97706', color: '#fff' }}
            >
              Gợi ý ({hintsLeft})
            </button>
          </div>
        </div>
      </div>
    </GameShell>
  );
};
