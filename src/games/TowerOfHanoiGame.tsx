import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playBounceSound,
  playClearSound,
  playMoveSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';

const MIN_DISKS = 3;
const MAX_DISKS = 7;
const OPTIMAL_BONUS = 600;
const MOVE_SCORE = 10;
const MISS_PENALTY = 15;
const AUTO_DELAY = 430;
const HINT_MS = 2600;

const ROD_X = [0.18, 0.5, 0.82];
const BASE_Y = 0.88;
const TOP_Y = 0.1;

type Peg = 0 | 1 | 2;

const diskColors = [
  'linear-gradient(180deg, #fca5a5, #dc2626)',
  'linear-gradient(180deg, #fdba74, #ea580c)',
  'linear-gradient(180deg, #fde68a, #d97706)',
  'linear-gradient(180deg, #bef264, #4d7c0f)',
  'linear-gradient(180deg, #7dd3fc, #0369a1)',
  'linear-gradient(180deg, #c4b5fd, #6d28d9)',
  'linear-gradient(180deg, #f9a8d4, #be185d)',
];

const optimalMoves = (count: number) => Math.pow(2, count) - 1;

interface Snapshot {
  pegs: number[][];
  moves: number;
}

const buildPuzzle = (disks: number): number[][] => {
  const pegs: number[][] = [[], [], []];
  for (let size = disks; size >= 1; size -= 1) pegs[0].push(size);
  return pegs;
};

const canMove = (pegs: number[][], from: Peg, to: Peg, disks: number): boolean => {
  if (from === to) return false;
  const source = pegs[from];
  if (source.length === 0) return false;
  const disk = source[source.length - 1];
  const target = pegs[to];
  if (target.length === 0) return true;
  return target[target.length - 1] > disk && target.length < disks;
};

const isSolved = (pegs: number[][], disks: number): boolean =>
  pegs[2].length === disks;

const applyStep = (pegs: number[][], from: Peg, to: Peg): number[][] => {
  const next = [pegs[0].slice(), pegs[1].slice(), pegs[2].slice()];
  const disk = next[from][next[from].length - 1];
  next[from].pop();
  next[to].push(disk);
  return next;
};

export const TowerOfHanoiGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('tower-of-hanoi')!;

  const [disks, setDisks] = useState(5);
  const [pegs, setPegs] = useState<number[][]>(() => buildPuzzle(5));
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<Peg | null>(null);
  const [hint, setHint] = useState<{ from: Peg; to: Peg } | null>(null);
  const [auto, setAuto] = useState(false);
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const optimal = optimalMoves(disks);
  const extra = Math.max(0, moves - optimal);
  const efficiency = Math.round((optimal / Math.max(1, moves)) * 100);
  const score = solved
    ? moves * MOVE_SCORE + Math.max(0, 400 - extra * MISS_PENALTY) + (extra === 0 ? OPTIMAL_BONUS : 0)
    : moves * MOVE_SCORE;

  const plan = useMemo(() => {
    const steps: { from: Peg; to: Peg }[] = [];
    const push = (count: number, from: Peg, to: Peg, spare: Peg) => {
      if (count === 0) return;
      push(count - 1, from, spare, to);
      steps.push({ from, to });
      push(count - 1, spare, to, from);
    };
    push(disks, 0, 2, 1);
    return steps;
  }, [disks]);

  const clearTimers = () => {
    timers.current.forEach(id => window.clearTimeout(id));
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const reset = (count: number) => {
    clearTimers();
    setDisks(count);
    setPegs(buildPuzzle(count));
    setMoves(0);
    setHistory([]);
    setSelected(null);
    setHint(null);
    setAuto(false);
    setSolved(false);
    setNote(null);
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!auto || solved) return;
    if (moves >= plan.length) {
      setAuto(false);
      return;
    }
    const step = plan[moves];
    const id = window.setTimeout(() => {
      setPegs(prev => applyStep(prev, step.from, step.to));
      setMoves(value => value + 1);
      playBounceSound();
      triggerHaptic(10);
    }, AUTO_DELAY);
    return () => window.clearTimeout(id);
  }, [auto, solved, moves, plan, disks]);

  const undo = () => {
    if (auto || solved || history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setPegs(last.pegs);
    setMoves(last.moves);
    setSelected(null);
    setHint(null);
    setNote(null);
    playMoveSound();
  };

  const tapPeg = (peg: Peg) => {
    if (auto || solved) return;
    setNote(null);

    if (selected === null) {
      if (pegs[peg].length === 0) {
        setSelected(null);
        return;
      }
      setSelected(peg);
      playMoveSound();
      triggerHaptic(8);
      return;
    }

    if (selected === peg) {
      setSelected(null);
      playMoveSound();
      return;
    }

    if (!canMove(pegs, selected, peg, disks)) {
      setNote(
        pegs[peg].length > 0
          ? 'Không được đặt đĩa lớn lên đĩa nhỏ hơn.'
          : 'Chọn cột khác để chuyển đĩa.'
      );
      playBounceSound();
      triggerHaptic(18);
      return;
    }

    commitMove(selected, peg);
  };

  const commitMove = (from: Peg, to: Peg) => {
    const next = applyStep(pegs, from, to);
    setHistory(prev => [...prev, { pegs, moves }]);
    setPegs(next);
    setMoves(value => value + 1);
    setSelected(null);
    setHint(null);
    playScoreSound();
    triggerHaptic(14);

    if (isSolved(next, disks)) {
      const overshoot = moves + 1 - optimal;
      setSolved(true);
      setNote(
        overshoot === 0
          ? 'Hoàn hảo! Bạn dùng đúng số nước tối ưu.'
          : `Xong rồi! Bạn dùng ${overshoot} nước dư so với tối ưu.`
      );
      playClearSound();
    }
  };

  const showHint = () => {
    if (auto || solved) return;
    const step = plan[moves];
    if (!step) return;
    setHint({ from: step.from, to: step.to });
    setSelected(null);
    setNote(`Gợi ý: chuyển đĩa từ cột ${step.from + 1} sang cột ${step.to + 1}.`);
    playMoveSound();
    clearTimers();
    later(() => setHint(null), HINT_MS);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (index >= 0) {
        e.preventDefault();
        tapPeg(index as Peg);
      } else if (e.code === 'KeyZ') {
        e.preventDefault();
        undo();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        showHint();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const diskHeight = 4.2;
  const diskGap = 0.9;

  const renderPeg = (peg: Peg) => {
    const active = selected === peg;
    const isHintSource = hint?.from === peg;
    const isHintTarget = hint?.to === peg;
    const glow = isHintSource || isHintTarget;

    return (
      <div key={peg} className="relative flex-1 flex flex-col items-center justify-end h-full">
        <div
          className="absolute rounded-t-lg transition-all duration-300"
          style={{
            left: '50%',
            width: '7%',
            bottom: `${(1 - BASE_Y) * 100}%`,
            // BASE_Y..TOP_Y là toạ độ đo TỪ TRÊN xuống, nên chiều cao cột chỉ
            // = (BASE_Y - TOP_Y) * 100. Trước đây cộng thêm "+4" khiến cột cao 478%.
            height: `${(BASE_Y - TOP_Y) * 100}%`,
            transform: 'translateX(-50%)',
            background:
              'linear-gradient(90deg, rgba(148,163,184,0.35), rgba(226,232,240,0.85) 45%, rgba(100,116,139,0.35))',
            boxShadow: glow ? `0 0 14px ${isHintSource ? '#facc15' : '#67e8f9'}` : 'none',
          }}
        />

        {pegs[peg].map((disk, index) => {
          // Đĩa lớn hơn phải rộng hơn. Công thức cũ ((disks - disk) / disks)
          // làm đĩa nhỏ nhất lại rộng nhất.
          const width = 22 + ((disk - 1) / Math.max(1, disks - 1)) * 62;
          // Mảng pegs lưa theo thứ tự ĐÁY -> TRÊN, nên đĩa đầu mảng (index 0)
          // phải nằm sát đáy cột. Trước đây dùng (length - index) khiến đĩa to
          // bị đẩy lên đỉnh và cả chồng bị lật ngược.
          const lift = index * (diskHeight + diskGap);
          return (
            <button
              key={`${peg}-${disk}`}
              type="button"
              onClick={() => tapPeg(peg)}
              disabled={auto || solved}
              aria-label={`Đĩa ${disk} tại cột ${peg + 1}`}
              className="absolute rounded-lg border border-white/30 transition-transform duration-200 active:translate-y-[1px] disabled:cursor-default"
              style={{
                left: `${50 - width / 2}%`,
                width: `${width}%`,
                bottom: `${(1 - BASE_Y) * 100 + lift}%`,
                height: `${diskHeight}%`,
                background: diskColors[(disk - 1) % diskColors.length],
                boxShadow:
                  glow && isHintTarget
                    ? '0 0 16px rgba(103,232,249,0.9)'
                    : '0 2px 6px rgba(0,0,0,0.35)',
                opacity: glow ? 1 : 0.94,
              }}
            />
          );
        })}

        <button
          type="button"
          onClick={() => tapPeg(peg)}
          disabled={auto || solved}
          aria-label={`Cột ${peg + 1}, ${pegs[peg].length} đĩa`}
          className="absolute bottom-0 rounded-full border transition"
          style={{
            width: '26%',
            height: '4%',
            background: active ? 'rgba(99,102,241,0.55)' : 'var(--game-control-bg)',
            borderColor: glow ? (isHintSource ? '#facc15' : '#67e8f9') : 'var(--game-control-border)',
          }}
        />

        <span className="absolute text-[10px] font-black theme-muted" style={{ bottom: '-16px' }}>
          {peg + 1}
        </span>
      </div>
    );
  };

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={solved}
      isVictory={solved}
      isPaused={false}
      onRestart={() => reset(disks)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2">
          <span className="text-[11px] theme-muted whitespace-nowrap">
            <span className="text-indigo-400 font-bold">{moves}</span> / tối ưu {optimal}
          </span>
          <span className="text-[11px] text-emerald-400 font-bold whitespace-nowrap">
            {efficiency}%
          </span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 w-full px-1">
        <p className="text-sm font-bold theme-text text-center">
          {auto
            ? 'Máy đang chứng minh lời giải tối ưu…'
            : solved
              ? 'Đã chuyển hết đĩa sang cột 3!'
              : `Chuyển hết ${disks} đĩa từ cột 1 sang cột 3.`}
        </p>
        <p className="text-[11px] theme-muted text-center leading-snug max-w-md">
          Mỗi lượt chỉ chuyển một đĩa và không bao giờ đặt đĩa lớn lên đĩa nhỏ hơn. Phím 1 2 3 để
          chọn cột, Z để đi lại, H để xem gợi ý.
        </p>

        <div
          className="w-full max-w-[520px] rounded-3xl p-3 relative"
          style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-color)' }}
        >
          <div className="relative w-full aspect-[2/1]">
            <div className="absolute inset-x-[8%] bottom-0 h-[6%] rounded-2xl" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-color)' }} />
            <div className="absolute inset-0 flex gap-[4%]">
              {[0, 1, 2].map(peg => renderPeg(peg as Peg))}
            </div>
          </div>
        </div>

        {note && (
          <p className="text-xs font-bold text-center animate-in fade-in duration-200" style={{ color: 'var(--accent)' }}>
            {note}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              undo();
            }}
            disabled={auto || solved || history.length === 0}
            className="px-3 py-1.5 rounded-xl border theme-border theme-text text-xs font-bold transition active:translate-y-[2px] disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)' }}
          >
            Đi lại
          </button>
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              showHint();
            }}
            disabled={auto || solved}
            className="px-3 py-1.5 rounded-xl border theme-border theme-text text-xs font-bold transition active:translate-y-[2px] disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)' }}
          >
            Gợi ý
          </button>
          <button
            type="button"
            onClick={() => {
              playMoveSound();
              setAuto(value => !value);
            }}
            disabled={solved}
            className="px-3 py-1.5 rounded-xl border theme-border theme-text text-xs font-bold transition active:translate-y-[2px] disabled:opacity-40"
            style={{ background: 'var(--game-control-bg)' }}
          >
            {auto ? 'Dừng tự động' : 'Xem lời giải tối ưu'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {Array.from({ length: MAX_DISKS - MIN_DISKS + 1 }, (_, i) => MIN_DISKS + i).map(count => (
            <button
              key={count}
              type="button"
              onClick={() => {
                playMoveSound();
                reset(count);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition active:translate-y-[2px] ${
                count === disks ? 'text-white border-indigo-400' : 'theme-text'
              }`}
              style={{
                background: count === disks ? 'rgba(99,102,241,0.55)' : 'var(--game-control-bg)',
                borderColor: count === disks ? '#818cf8' : 'var(--game-control-border)',
              }}
            >
              {count} đĩa
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  );
};