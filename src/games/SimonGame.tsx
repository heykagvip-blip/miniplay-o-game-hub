import React, { useEffect, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playGameOverSound, playMoveSound, playScoreSound } from '../utils/sound';

const COLORS = [
  { name: 'Đỏ', base: '#f43f5e', glow: 'rgba(244, 63, 94, 0.95)', ring: '#fecdd3' },
  { name: 'Xanh lá', base: '#10b981', glow: 'rgba(16, 185, 129, 0.95)', ring: '#a7f3d0' },
  { name: 'Xanh dương', base: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.95)', ring: '#bae6fd' },
  { name: 'Vàng', base: '#f59e0b', glow: 'rgba(245, 158, 11, 0.95)', ring: '#fde68a' },
];
type Phase = 'idle' | 'playback' | 'input' | 'over';

export const SimonGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('simon')!;
  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeColor, setActiveColor] = useState(-1);
  const [inputIndex, setInputIndex] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (phase !== 'playback') return;
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const showNext = () => {
      if (index >= sequence.length) {
        setActiveColor(-1);
        setPhase('input');
        return;
      }
      setActiveColor(sequence[index]);
      timer = setTimeout(() => {
        setActiveColor(-1);
        timer = setTimeout(() => {
          index++;
          showNext();
        }, 180);
      }, 430);
    };
    timer = setTimeout(showNext, 400);
    return () => clearTimeout(timer);
  }, [phase, sequence]);

  const start = () => {
    setSequence([Math.floor(Math.random() * COLORS.length)]);
    setScore(0);
    setInputIndex(0);
    setPhase('playback');
  };

  const choose = (color: number) => {
    if (phase !== 'input') return;
    playMoveSound();
    if (sequence[inputIndex] !== color) {
      playGameOverSound();
      setPhase('over');
      return;
    }
    if (inputIndex + 1 === sequence.length) {
      playScoreSound();
      setScore(sequence.length);
      setInputIndex(0);
      setSequence(current => [...current, Math.floor(Math.random() * COLORS.length)]);
      setPhase('playback');
    } else {
      setInputIndex(index => index + 1);
    }
  };

  return (
    <GameShell game={gameMeta} score={score} isGameOver={phase === 'over'} isPaused={false} onRestart={start} onBackToHub={onBackToHub}>
 <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <div
 className="w-full rounded-3xl p-4 text-center border border-slate-800"
          style={{ background: '#0f172a' }}
        >
 <p className="text-sm font-bold text-slate-100">
            {phase === 'playback'
              ? 'QUAN SÁT'
              : phase === 'input'
              ? 'ĐẾN LƯỢT BẠN'
              : phase === 'over'
              ? 'SAI RỒI!'
              : 'SẴN SÀNG?'}
          </p>
 <p className="mt-1 text-xs text-slate-400">
            {phase === 'input'
              ? `Lượt ${score + 1} · nhớ ${sequence.length} màu`
              : phase === 'over'
              ? `Bạn nhớ được ${score} màu`
              : phase === 'idle'
              ? 'Quan sát và lặp lại chuỗi màu'
              : 'Đừng bỏ lỡ bước nào!'}
          </p>

          {/* Progress dots: how many pads of the sequence have been repeated */}
          {phase === 'input' && (
 <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {sequence.map((c, i) => (
                <span
                  key={`${i}-${c}`}
 className="h-2.5 w-2.5 rounded-full transition-all duration-200"
                  style={{
                    background: i < inputIndex ? COLORS[c].base : 'rgba(148,163,184,0.3)',
                    transform: i < inputIndex ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div
 className="grid w-full grid-cols-2 gap-3 p-3 rounded-3xl border border-slate-800"
          style={{
            background: '#020617',
          }}
        >
          {COLORS.map((color, index) => {
            const lit = activeColor === index;
            return (
              <button
                key={color.name}
                disabled={phase !== 'input'}
                onClick={() => choose(index)}
                aria-label={color.name}
 className={`aspect-square rounded-2xl transition-all duration-150 border-4 ${
                  phase === 'input' ? 'hover:brightness-110 active:scale-95 cursor-pointer' : 'opacity-85 cursor-default'
                }`}
                style={{
                  borderColor: lit ? color.ring : 'rgba(255,255,255,0.07)',
                  background: lit ? color.ring : color.base,
                  transform: lit ? 'scale(1.05)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>

        {(phase === 'idle' || phase === 'over') && (
          <button
            onClick={start}
 className="w-full rounded-2xl px-5 py-3 font-black text-white transition game-btn-press"
            style={{
              background: '#059669',
            }}
          >
            {phase === 'over' ? 'Chơi lại' : 'Bắt đầu'}
          </button>
        )}
      </div>
    </GameShell>
  );
};