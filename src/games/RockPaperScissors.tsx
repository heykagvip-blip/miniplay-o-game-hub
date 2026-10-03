import React, { useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playClearSound, playGameOverSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Flame, Sparkles, RotateCcw } from 'lucide-react';

type Choice = 'rock' | 'paper' | 'scissors';

const CHOICES: { id: Choice; name: string; icon: string; beats: Choice; color: string }[] = [
  { id: 'rock', name: 'Búa', icon: '✊', beats: 'scissors', color: 'from-amber-500 to-orange-600' },
  { id: 'paper', name: 'Bao', icon: '✋', beats: 'rock', color: 'from-blue-500 to-indigo-600' },
  { id: 'scissors', name: 'Kéo', icon: '✌️', beats: 'paper', color: 'from-rose-500 to-pink-600' },
];

interface RockPaperScissorsProps {
  onBackToHub: () => void;
}

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('rps')!;

  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [result, setResult] = useState<'WIN' | 'LOSE' | 'TIE' | null>(null);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<{ wins: number; losses: number; ties: number }>({
    wins: 0,
    losses: 0,
    ties: 0,
  });

  const resetGame = useCallback(() => {
    setPlayerChoice(null);
    setComputerChoice(null);
    setResult(null);
    setIsShuffling(false);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setHistory({ wins: 0, losses: 0, ties: 0 });
  }, []);

  const handleSelect = (choice: Choice) => {
    if (isShuffling) return;

    playMoveSound();
    triggerHaptic(15);
    setPlayerChoice(choice);
    setIsShuffling(true);
    setResult(null);

    // Suspense countdown shuffle (600ms)
    let count = 0;
    const interval = setInterval(() => {
      setComputerChoice(CHOICES[count % CHOICES.length].id);
      count++;
    }, 90);

    setTimeout(() => {
      clearInterval(interval);
      const randomComp = CHOICES[Math.floor(Math.random() * CHOICES.length)].id;
      setComputerChoice(randomComp);
      setIsShuffling(false);

      if (choice === randomComp) {
        // TIE
        setResult('TIE');
        setHistory(h => ({ ...h, ties: h.ties + 1 }));
      } else {
        const playerItem = CHOICES.find(c => c.id === choice)!;
        if (playerItem.beats === randomComp) {
          // WIN
          playClearSound();
          triggerHaptic(30);
          setResult('WIN');
          setStreak(s => {
            const nextS = s + 1;
            setMaxStreak(m => Math.max(m, nextS));
            return nextS;
          });
          const pointsEarned = 100 + (streak + 1) * 25;
          setScore(s => s + pointsEarned);
          setHistory(h => ({ ...h, wins: h.wins + 1 }));
        } else {
          // LOSE
          playGameOverSound();
          triggerHaptic(35);
          setResult('LOSE');
          setStreak(0);
          setHistory(h => ({ ...h, losses: h.losses + 1 }));
        }
      }
    }, 650);
  };

  const playerObj = CHOICES.find(c => c.id === playerChoice);
  const compObj = CHOICES.find(c => c.id === computerChoice);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={false}
      isPaused={false}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-amber-400">
 <Flame className="w-3.5 h-3.5 fill-amber-400" />
 <span className="font-bold">{streak} chuỗi</span>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Battle Arena */}
 <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden mb-6 text-center">
 <div className="grid grid-cols-2 gap-4 items-center mb-6">
            {/* Player Side */}
 <div className="flex flex-col items-center">
 <span className="text-xs font-bold text-indigo-400 mb-2">BẠN</span>
              <div
 className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center text-5xl sm:text-6xl transition-transform ${
                  result === 'WIN' ? 'scale-110 border-emerald-400 bg-emerald-500/20' : ''
                }`}
              >
                {playerObj ? playerObj.icon : '❓'}
              </div>
 <span className="text-xs text-slate-300 font-semibold mt-2">
                {playerObj ? playerObj.name : 'Chưa chọn'}
              </span>
            </div>

            {/* Computer Side */}
 <div className="flex flex-col items-center">
 <span className="text-xs font-bold text-rose-400 mb-2">MÁY TÍNH</span>
              <div
 className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-800 border-2 border-rose-500/50 flex items-center justify-center text-5xl sm:text-6xl transition-transform ${
                  isShuffling ? 'animate-bounce' : ''
                } ${result === 'LOSE' ? 'scale-110 border-emerald-400 bg-emerald-500/20' : ''}`}
              >
                {compObj ? compObj.icon : '🤖'}
              </div>
 <span className="text-xs text-slate-300 font-semibold mt-2">
                {isShuffling ? 'Đang chọn...' : compObj ? compObj.name : 'Chờ bạn'}
              </span>
            </div>
          </div>

          {/* Outcome Announcement */}
 <div className="h-10 flex items-center justify-center">
            {result === 'WIN' && (
 <span className="text-lg font-black text-emerald-400 animate-in zoom-in">
                🎉 Bạn Thắng Ván Này!
              </span>
            )}
            {result === 'LOSE' && (
 <span className="text-lg font-black text-rose-400 animate-in zoom-in">
                💀 Bạn Thua Ván Này!
              </span>
            )}
            {result === 'TIE' && (
 <span className="text-lg font-black text-amber-400 animate-in zoom-in">
                🤝 Hai bên Hòa nhau!
              </span>
            )}
            {!result && !isShuffling && (
 <span className="text-xs text-slate-400">
                Hãy chọn một quân bên dưới để bắt đầu so tài
              </span>
            )}
            {isShuffling && (
 <span className="text-xs text-indigo-400 font-bold animate-pulse">
                Oẳn tù tì ra cái gì ra cái này...
              </span>
            )}
          </div>
        </div>

        {/* Choice Buttons */}
 <div className="grid grid-cols-3 gap-3 w-full mb-6">
          {CHOICES.map(c => (
            <button
              key={c.id}
              disabled={isShuffling}
              onClick={() => handleSelect(c.id)}
 className={`p-4 rounded-2xl bg-gradient-to-b ${c.color} text-white hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-1.5 cursor-pointer game-btn-press disabled:opacity-50`}
            >
 <span className="text-4xl">{c.icon}</span>
 <span className="text-xs font-bold">{c.name}</span>
            </button>
          ))}
        </div>

        {/* Stats Table */}
 <div className="grid grid-cols-4 gap-2 w-full text-center">
 <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Thắng</span>
 <span className="text-sm font-bold text-emerald-400">{history.wins}</span>
          </div>
 <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Hòa</span>
 <span className="text-sm font-bold text-amber-400">{history.ties}</span>
          </div>
 <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Thua</span>
 <span className="text-sm font-bold text-rose-400">{history.losses}</span>
          </div>
 <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
 <span className="text-[10px] text-slate-400 block">Kỷ lục chuỗi</span>
 <span className="text-sm font-bold text-indigo-400">{maxStreak}</span>
          </div>
        </div>
      </div>
    </GameShell>
  );
};
