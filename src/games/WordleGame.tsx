import React, { useCallback, useEffect, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound } from '../utils/sound';

const ANSWERS = ['apple', 'beach', 'bread', 'candy', 'chair', 'cloud', 'dance', 'dream', 'earth', 'flame', 'grape', 'house', 'light', 'music', 'ocean', 'plant', 'radio', 'river', 'smile', 'stone', 'table', 'train', 'water', 'world'];
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
type LetterState = 'correct' | 'present' | 'absent';

/** Flat tile fill that matches the letter state. */
const tileStyle = (
  state?: LetterState,
  filled?: boolean,
  revealed?: boolean,
): React.CSSProperties => {
  if (revealed) {
    return {
      background: '#059669',
      borderColor: '#a7f3d0',
    };
  }
  if (state === 'correct') {
    return {
      background: '#047857',
      borderColor: '#6ee7b7',
    };
  }
  if (state === 'present') {
    return {
      background: '#d97706',
      borderColor: '#fcd34d',
    };
  }
  if (state === 'absent') {
    return {
      background: '#1e293b',
      borderColor: '#475569',
    };
  }
  if (filled) {
    return {
      background: '#1e293b',
      borderColor: '#94a3b8',
    };
  }
  return {
    background: 'rgba(2,6,23,0.85)',
    borderColor: '#334155',
  };
};

const keyStyle = (state?: LetterState | null): React.CSSProperties => {
  if (state === 'correct') {
    return {
      background: '#059669',
      
      color: '#fff',
    };
  }
  if (state === 'present') {
    return {
      background: '#d97706',
      
      color: '#fff',
    };
  }
  if (state === 'absent') {
    return { background: '#0f172a',  color: '#475569' };
  }
  return { background: '#334155',  color: '#f8fafc' };
};

export const WordleGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('wordle')!;
  const [answer, setAnswer] = useState(() => ANSWERS[Math.floor(Math.random() * ANSWERS.length)]);
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);

  const submitGuess = useCallback(() => {
    if (finished || guess.length !== 5) return;
    const nextGuesses = [...guesses, guess];
    const isCorrect = guess === answer;
    setGuesses(nextGuesses);
    setGuess('');
    if (isCorrect) {
      setFinished(true);
      setWon(true);
      setScore(500 + (6 - nextGuesses.length) * 100);
      playClearSound();
    } else if (nextGuesses.length === 6) {
      setFinished(true);
    } else {
      playMoveSound();
    }
  }, [answer, finished, guess, guesses]);

  const resetGame = useCallback(() => {
    setAnswer(current => {
      const choices = ANSWERS.filter(word => word !== current);
      return choices[Math.floor(Math.random() * choices.length)];
    });
    setGuess('');
    setGuesses([]);
    setFinished(false);
    setWon(false);
    setScore(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        submitGuess();
      } else if (event.key === 'Backspace') {
        setGuess(value => value.slice(0, -1));
      } else if (/^[a-z]$/i.test(event.key) && guess.length < 5 && !finished) {
        setGuess(value => (value.length < 5 ? value + event.key.toLowerCase() : value));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finished, guess.length, submitGuess]);

  const letterStates = (word: string): LetterState[] => {
    const remaining = answer.split('');
    const result: (LetterState | null)[] = Array(5).fill(null);
    for (let index = 0; index < 5; index++) {
      if (word[index] === answer[index]) {
        result[index] = 'correct';
        remaining[index] = '';
      }
    }
    for (let index = 0; index < 5; index++) {
      if (result[index] === null) {
        const match = remaining.indexOf(word[index]);
        if (match >= 0) {
          result[index] = 'present';
          remaining[match] = '';
        } else {
          result[index] = 'absent';
        }
      }
    }
    return result as LetterState[];
  };

  const colorForKey = (letter: string): LetterState | null => {
    for (const word of guesses) {
      const index = word.indexOf(letter);
      if (index >= 0) {
        const state = letterStates(word)[index];
        if (state === 'correct') return state;
        if (state === 'present') return state;
      }
    }
    return guesses.some(word => word.includes(letter)) ? 'absent' : null;
  };

  const boardRows: {
    word: string;
    states: (LetterState | undefined)[];
    locked: boolean;
    revealed: boolean;
  }[] = guesses.map(word => ({
    word,
    states: letterStates(word),
    locked: true,
    revealed: false,
  }));

  if (!finished) {
    boardRows.push({ word: guess, states: [], locked: false, revealed: false });
  } else if (!won) {
    boardRows.push({
      word: answer,
      states: ['correct', 'correct', 'correct', 'correct', 'correct'],
      locked: true,
      revealed: true,
    });
  }

  return (
    <GameShell game={gameMeta} score={score} isGameOver={finished} isVictory={won} isPaused={false} onRestart={resetGame} onBackToHub={onBackToHub}>
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="grid grid-cols-5 gap-1.5" aria-label="Bảng Wordle">
          {boardRows.map((row, rowIndex) =>
            Array.from({ length: 5 }, (_, col) => (
              <div
                key={`${rowIndex}-${col}`}
                className={`grid h-12 w-12 place-items-center rounded-lg border-2 text-xl font-black uppercase transition-all ${
                  row.locked ? 'animate-in zoom-in-95 duration-200' : ''
                }`}
                style={tileStyle(row.states[col], Boolean(row.word[col]), row.revealed)}
              >
                {row.word[col] ?? ''}
              </div>
            )),
          )}
        </div>
        {finished && (
          <div
            className="w-full rounded-2xl border border-slate-800 p-4 text-center"
            style={{ background: 'rgba(2,6,23,0.75)' }}
          >
            <div className="text-sm font-bold text-slate-100">
              {won ? 'Tuyệt lắm, bạn đoán đúng!' : 'Hết lượt rồi!'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Đáp án:{' '}
              <span className="font-black uppercase text-emerald-400">{answer}</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <div className="text-center">
                <span className="text-[11px] text-slate-400">Lượt đã dùng</span>
                <div className="text-base font-black text-slate-100">
                  {guesses.length}/6
                </div>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="text-center">
                <span className="text-[11px] text-slate-400">Điểm</span>
                <div className="text-base font-black text-emerald-400">{score}</div>
              </div>
            </div>
          </div>
        )}
        {!finished && (
          <div
 className="flex w-full flex-col gap-1.5 rounded-2xl p-2.5 border border-slate-800"
            style={{ background: 'rgba(2,6,23,0.75)' }}
          >
            {KEY_ROWS.map(row => (
 <div key={row} className="flex justify-center gap-1">
                {[...row].map(letter => {
                  const state = colorForKey(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => setGuess(value => (value.length < 5 ? value + letter : value))}
 className="h-10 min-w-7 flex-1 rounded-md text-xs font-bold uppercase transition-transform active:translate-y-[2px] "
                      style={keyStyle(state)}
                    >
                      {letter}
                    </button>
                  );
                })}
                {row === 'zxcvbnm' && (
                  <button
                    onClick={() => setGuess(value => value.slice(0, -1))}
 className="rounded-md px-2 text-xs font-bold transition-transform active:translate-y-[2px] "
                    style={keyStyle(null)}
                  >
                    ⌫
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={submitGuess}
              disabled={guess.length !== 5}
 className="mt-1 rounded-lg px-4 py-2.5 text-sm font-black uppercase tracking-wide transition-transform active:translate-y-[2px] disabled:opacity-40"
              style={{
                background: '#059669',
                
                color: '#fff',
              }}
            >
              Nhập
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
};