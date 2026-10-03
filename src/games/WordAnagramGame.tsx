import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Lightbulb, SkipForward, Timer } from 'lucide-react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playBounceSound,
  playClearSound,
  playMoveSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';

interface AnagramWord {
  plain: string;
  display: string;
}

interface Tile {
  char: string;
  key: number;
}

interface Slot {
  char: string | null;
  tileKey: number | null;
  locked: boolean;
}

interface Round {
  word: AnagramWord;
  tiles: Tile[];
  slots: Slot[];
  hintsLeft: number;
  solved: boolean;
}

const WORDS: AnagramWord[] = [
  { plain: 'nguyen', display: 'nguyên' },
  { plain: 'truong', display: 'trường' },
  { plain: 'hoclsinh', display: 'học sinh' },
  { plain: 'thanhpho', display: 'thành phố' },
  { plain: 'nguoi', display: 'người' },
  { plain: 'banbe', display: 'bạn bè' },
  { plain: 'nhanh', display: 'nhanh' },
  { plain: 'maytinh', display: 'máy tính' },
  { plain: 'nuoc', display: 'nước' },
  { plain: 'nhung', display: 'nhưng' },
  { plain: 'thuong', display: 'thương' },
  { plain: 'giaoduc', display: 'giáo dục' },
  { plain: 'thien', display: 'thiên' },
  { plain: 'nuong', display: 'nướng' },
  { plain: 'banh', display: 'bánh' },
  { plain: 'trai', display: 'trái' },
  { plain: 'thuvien', display: 'thư viện' },
  { plain: 'vanhoa', display: 'văn hóa' },
  { plain: 'lichsu', display: 'lịch sử' },
  { plain: 'nhacsi', display: 'nhạc sĩ' },
  { plain: 'phimanh', display: 'phim ảnh' },
  { plain: 'truyen', display: 'truyện' },
  { plain: 'thuyen', display: 'thuyền' },
  { plain: 'xedap', display: 'xe đạp' },
  { plain: 'xehang', display: 'xe hàng' },
  { plain: 'maybay', display: 'máy bay' },
  { plain: 'dien', display: 'điện' },
  { plain: 'sach', display: 'sách' },
  { plain: 'baitap', display: 'bài tập' },
  { plain: 'kiemtra', display: 'kiểm tra' },
  { plain: 'hocki', display: 'học kì' },
  { plain: 'hoclop', display: 'học lớp' },
  { plain: 'namhoc', display: 'năm học' },
  { plain: 'lanh', display: 'lạnh' },
  { plain: 'nong', display: 'nóng' },
  { plain: 'bien', display: 'biển' },
  { plain: 'rung', display: 'rừng' },
  { plain: 'saotroi', display: 'sao trời' },
  { plain: 'matnguoi', display: 'mặt người' },
  { plain: 'chay', display: 'chạy' },
  { plain: 'nhay', display: 'nhảy' },
  { plain: 'ghichu', display: 'ghi chú' },
  { plain: 'giaitoan', display: 'giải toán' },
  { plain: 'toanhoc', display: 'toán học' },
  { plain: 'lyluan', display: 'lý luận' },
  { plain: 'lich', display: 'lịch' },
  { plain: 'ngay', display: 'ngày' },
  { plain: 'thang', display: 'tháng' },
  { plain: 'ngaythang', display: 'ngày tháng' },
  { plain: 'tuan', display: 'tuần' },
  { plain: 'ketqua', display: 'kết quả' },
  { plain: 'dong', display: 'đồng' },
  { plain: 'chim', display: 'chim' },
  { plain: 'choi', display: 'chơi' },
  { plain: 'hanhphuc', display: 'hạnh phúc' },
  { plain: 'tinhban', display: 'tình bạn' },
  { plain: 'nganh', display: 'ngành' },
  { plain: 'lamviec', display: 'làm việc' },
  { plain: 'nghiencuu', display: 'nghiên cứu' },
  { plain: 'phatminh', display: 'phát minh' },
  { plain: 'sangtao', display: 'sáng tạo' },
  { plain: 'tieudiem', display: 'tiêu điểm' },
  { plain: 'diemso', display: 'điểm số' },
  { plain: 'danhgia', display: 'đánh giá' },
  { plain: 'banhchung', display: 'bánh chưng' },
  { plain: 'banhtet', display: 'bánh tét' },
  { plain: 'banhmi', display: 'bánh mì' },
  { plain: 'tugiac', display: 'tứ giác' },
  { plain: 'hocvien', display: 'học viện' },
  { plain: 'phonghop', display: 'phòng họp' },
  { plain: 'vanphong', display: 'văn phòng' },
  { plain: 'thaivuon', display: 'thái vườn' },
  { plain: 'baihat', display: 'bài hát' },
  { plain: 'quocte', display: 'quốc tế' },
  { plain: 'thegioi', display: 'thế giới' },
  { plain: 'vietnam', display: 'việt nam' },
  { plain: 'dienlanh', display: 'điện lạnh' },
  { plain: 'hoctap', display: 'học tập' },
  { plain: 'nguoilon', display: 'người lớn' },
  { plain: 'congviec', display: 'công việc' },
  { plain: 'debai', display: 'đề bài' },
  { plain: 'hinhve', display: 'hình vẽ' },
  { plain: 'mausac', display: 'màu sắc' },
  { plain: 'dongban', display: 'đồng bạn' },
  { plain: 'trachanh', display: 'trà chanh' },
  { plain: 'nuocngot', display: 'nước ngọt' },
  { plain: 'nhieu', display: 'nhiều' },
  { plain: 'vuvien', display: 'vũ viện' },
];

const ROUND_SECONDS = 60;
const HINT_COST = 40;
const HINTS_PER_ROUND = 2;
const WRONG_PENALTY = 20;
const SKIP_PENALTY = 15;
const NEXT_DELAY = 700;
const LETTER_BONUS = 25;
const TIME_BONUS = 2;
const MAX_STREAK_STEPS = 4;

const shuffle = <T,>(items: readonly T[]): T[] => {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const held = result[index];
    result[index] = result[swap];
    result[swap] = held;
  }
  return result;
};

const buildTiles = (plain: string): Tile[] => {
  const base: Tile[] = plain.split('').map((char, index) => ({ char, key: index }));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rolled = shuffle(base);
    if (rolled.map(tile => tile.char).join('') !== plain) return rolled;
  }
  return shuffle(base);
};

const emptySlots = (count: number): Slot[] =>
  Array.from({ length: count }, () => ({ char: null, tileKey: null, locked: false }));

const createRound = (word: AnagramWord): Round => ({
  word,
  tiles: buildTiles(word.plain),
  slots: emptySlots(word.plain.length),
  hintsLeft: HINTS_PER_ROUND,
  solved: false,
});

const usedTileKeys = (slots: readonly Slot[]): Set<number> => {
  const keys = new Set<number>();
  slots.forEach(slot => {
    if (slot.tileKey !== null) keys.add(slot.tileKey);
  });
  return keys;
};

const lastEditableSlot = (slots: readonly Slot[]): number => {
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    if (!slots[index].locked && slots[index].char !== null) return index;
  }
  return -1;
};

const slotStyle = (state: 'empty' | 'filled' | 'correct' | 'hint'): React.CSSProperties => {
  if (state === 'correct') {
    return { background: '#059669', borderColor: '#34d399', color: '#fff' };
  }
  if (state === 'hint') {
    return { background: 'var(--game-control-hover-bg)', borderColor: '#facc15', color: '#fde68a' };
  }
  if (state === 'filled') {
    return { background: 'var(--surface-strong)', borderColor: 'var(--accent)', color: 'var(--text-primary)' };
  }
  return { background: 'var(--surface-soft)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' };
};

const GAME_STYLES = `
@keyframes anagram-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(4px); }
}
.anagram-shake { animation: anagram-shake 0.4s ease-in-out; }
@keyframes anagram-pop {
  0% { transform: scale(0.72); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.anagram-pop { animation: anagram-pop 0.32s ease-out backwards; }
`;

export const WordAnagramGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const deckRef = useRef<AnagramWord[]>([]);
  const advanceRef = useRef<number | null>(null);

  const drawWord = useCallback((): AnagramWord => {
    if (deckRef.current.length === 0) deckRef.current = shuffle(WORDS);
    const next = deckRef.current.shift();
    return next ?? WORDS[0];
  }, []);

  const [round, setRound] = useState<Round>(() => createRound(WORDS[Math.floor(Math.random() * WORDS.length)]));
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wrongKey, setWrongKey] = useState(0);

  const clearAdvance = useCallback(() => {
    if (advanceRef.current !== null) {
      window.clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }, []);

  useEffect(() => clearAdvance, [clearAdvance]);

  const advance = useCallback(() => {
    clearAdvance();
    setRound(createRound(drawWord()));
    setMessage(null);
  }, [clearAdvance, drawWord]);

  const scheduleAdvance = useCallback(
    (delay: number) => {
      clearAdvance();
      advanceRef.current = window.setTimeout(advance, delay);
    },
    [advance, clearAdvance],
  );

  const restart = useCallback(() => {
    clearAdvance();
    deckRef.current = shuffle(WORDS);
    setRound(createRound(drawWord()));
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSolvedCount(0);
    setTimeLeft(ROUND_SECONDS);
    setIsGameOver(false);
    setIsPaused(false);
    setMessage(null);
    setWrongKey(0);
  }, [clearAdvance, drawWord]);

  useEffect(() => {
    if (isGameOver || isPaused) return;
    const timer = window.setInterval(() => {
      setTimeLeft(previous => (previous <= 1 ? 0 : previous - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isGameOver, isPaused]);

  useEffect(() => {
    if (timeLeft > 0 || isGameOver) return;
    setIsGameOver(true);
  }, [isGameOver, timeLeft]);

  const tapLetter = useCallback(
    (raw: string) => {
      const char = raw.toLowerCase();
      if (isGameOver || isPaused || round.solved) return;

      const used = usedTileKeys(round.slots);
      const tile = round.tiles.find(item => item.char === char && !used.has(item.key));
      if (!tile) return;

      const slots = round.slots.slice();
      let target = slots.findIndex(slot => slot.char === null);
      if (target === -1) {
        target = lastEditableSlot(slots);
        if (target === -1) return;
      }
      slots[target] = { char, tileKey: tile.key, locked: false };
      setRound(current => ({ ...current, slots }));
      playMoveSound();
      triggerHaptic(10);
    },
    [isGameOver, isPaused, round],
  );

  const removeLast = useCallback(() => {
    if (isGameOver || isPaused || round.solved) return;
    const slots = round.slots.slice();
    const target = lastEditableSlot(slots);
    if (target === -1) return;
    slots[target] = { char: null, tileKey: null, locked: false };
    setRound(current => ({ ...current, slots }));
    playMoveSound();
    triggerHaptic(8);
  }, [isGameOver, isPaused, round]);

  const submitAnswer = useCallback(() => {
    if (isGameOver || isPaused || round.solved) return;
    const built = round.slots.map(slot => slot.char ?? '').join('');
    if (built.length !== round.word.plain.length) {
      setMessage('Điền đủ các ô trước khi kiểm tra nhé.');
      return;
    }

    if (built === round.word.plain) {
      const nextStreak = streak + 1;
      const multiplier = 1 + Math.min(streak, MAX_STREAK_STEPS) * 0.5;
      const gained = Math.round((round.word.plain.length * LETTER_BONUS + timeLeft * TIME_BONUS) * multiplier);
      setScore(value => value + gained);
      setStreak(nextStreak);
      setBestStreak(value => Math.max(value, nextStreak));
      setSolvedCount(value => value + 1);
      setMessage(`Chuẩn rồi! +${gained} điểm`);
      setRound(current => ({
        ...current,
        solved: true,
        slots: current.slots.map(slot => ({ ...slot, locked: true })),
      }));
      playClearSound();
      triggerHaptic(28);
      scheduleAdvance(NEXT_DELAY);
      return;
    }

    setScore(value => Math.max(0, value - WRONG_PENALTY));
    setStreak(0);
    setWrongKey(value => value + 1);
    setMessage('Chưa đúng rồi, sắp xếp lại một chút nhé!');
    playBounceSound();
    triggerHaptic(40);
  }, [isGameOver, isPaused, round, scheduleAdvance, streak, timeLeft]);

  const useHint = useCallback(() => {
    if (isGameOver || isPaused || round.solved || round.hintsLeft <= 0) return;
    const target = round.slots.findIndex(slot => slot.char === null);
    if (target === -1) return;
    const char = round.word.plain[target];
    const used = usedTileKeys(round.slots);
    const tile = round.tiles.find(item => item.char === char && !used.has(item.key));
    if (!tile) return;

    const slots = round.slots.slice();
    slots[target] = { char, tileKey: tile.key, locked: true };
    setRound(current => ({ ...current, slots, hintsLeft: current.hintsLeft - 1 }));
    setScore(value => Math.max(0, value - HINT_COST));
    setMessage(`Gợi ý hé lộ 1 chữ cái, mất ${HINT_COST} điểm`);
    playScoreSound();
    triggerHaptic(20);
  }, [isGameOver, isPaused, round]);

  const skipWord = useCallback(() => {
    if (isGameOver || isPaused || round.solved) return;
    setScore(value => Math.max(0, value - SKIP_PENALTY));
    setStreak(0);
    setMessage(`Đã bỏ qua, mất ${SKIP_PENALTY} điểm.`);
    playMoveSound();
    triggerHaptic(15);
    advance();
  }, [advance, isGameOver, isPaused, round]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        tapLetter(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        removeLast();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submitAnswer();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsPaused(value => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeLast, submitAnswer, tapLetter]);

  const urgent = timeLeft <= 10;
  const warning = timeLeft <= 20;
  const timerColor = urgent ? '#ef4444' : warning ? '#f59e0b' : 'var(--accent)';
  const used = usedTileKeys(round.slots);
  const isComplete = round.slots.every(slot => slot.char !== null);

  return (
    <GameShell
      game={getGameById('word-anagram')!}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(value => !value)}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1 rounded-xl border flex items-center gap-1.5"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border-color)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted">Điểm:</span>
            <span className="text-sm font-black" style={{ color: timerColor }}>
              {score.toLocaleString('vi-VN')}
            </span>
          </div>
          <div
            className="px-3 py-1 rounded-xl border flex items-center gap-1.5"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border-color)' }}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase font-bold theme-muted hidden sm:inline">Chuỗi:</span>
            <span className="text-sm font-black text-amber-400">x{streak}</span>
          </div>
          <div
            className="px-3 py-1 rounded-xl border flex items-center gap-1.5"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border-color)' }}
          >
            <span className="text-[10px] uppercase font-bold theme-muted hidden sm:inline">Vòng:</span>
            <span className="text-sm font-black text-indigo-400">{solvedCount + 1}</span>
          </div>
        </div>
      }
    >
      <style>{GAME_STYLES}</style>
      <div className="flex w-full max-w-lg flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-bold theme-text">Sắp xếp các chữ cái để tạo thành từ tiếng Việt</p>
          <p className="text-[11px] theme-muted">
            Chuỗi tốt nhất {bestStreak} · Từ này có {round.word.plain.length} ký tự
          </p>
        </div>

        <div
          className="w-full rounded-2xl border p-3"
          style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-color)' }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold theme-muted">
              <Timer className="w-3.5 h-3.5" />
              Thời gian còn lại
            </span>
            <strong
              className={`text-sm font-black tabular-nums ${urgent ? 'animate-pulse' : ''}`}
              style={{ color: timerColor }}
            >
              {timeLeft}s
            </strong>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full border"
            style={{ background: 'var(--game-control-bg)', borderColor: 'var(--game-control-border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(timeLeft / ROUND_SECONDS) * 100}%`, background: timerColor }}
            />
          </div>
        </div>

        <div
          key={wrongKey}
          className={`flex w-full flex-wrap items-center justify-center gap-1.5 ${wrongKey > 0 ? 'anagram-shake' : ''}`}
        >
          {round.slots.map((slot, index) => {
            const state = round.solved ? 'correct' : slot.locked ? 'hint' : slot.char ? 'filled' : 'empty';
            return (
              <button
                key={index}
                type="button"
                onClick={removeLast}
                aria-label={`Ô chữ cái ${index + 1}`}
                className={`grid h-11 min-w-[44px] place-items-center rounded-xl border-2 text-lg font-black uppercase transition-colors duration-150 active:translate-y-[2px] ${
                  round.solved ? 'anagram-pop' : ''
                }`}
                style={{
                  ...slotStyle(state),
                  animationDelay: round.solved ? `${index * 45}ms` : undefined,
                }}
              >
                {slot.char ?? ''}
              </button>
            );
          })}
        </div>

        {round.solved ? (
          <p className="text-center text-base font-black text-emerald-400">{round.word.display}</p>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-center gap-2" aria-label="Các chữ cái đảo">
            {round.tiles.map(tile => {
              const placed = used.has(tile.key);
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => tapLetter(tile.char)}
                  disabled={placed || round.solved}
                  aria-label={`Chữ cái ${tile.char}`}
                  className="grid h-14 w-12 place-items-center rounded-2xl border-2 text-xl font-black uppercase transition active:translate-y-[2px] disabled:opacity-35"
                  style={{
                    background: placed ? 'var(--game-control-bg)' : 'var(--game-control-hover-bg)',
                    borderColor: placed ? 'var(--game-control-border)' : 'var(--accent)',
                    color: placed ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}
                >
                  {tile.char}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={submitAnswer}
            disabled={!isComplete || round.solved}
            className="min-h-[44px] flex-1 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition active:translate-y-[2px] disabled:opacity-40"
            style={{ background: '#0d9488' }}
          >
            Kiểm tra
          </button>
          <button
            type="button"
            onClick={removeLast}
            className="min-h-[44px] rounded-xl border px-3 py-2.5 text-xs font-bold transition active:translate-y-[2px]"
            style={{
              background: 'var(--game-control-bg)',
              borderColor: 'var(--game-control-border)',
              color: 'var(--text-primary)',
            }}
          >
            Xoá
          </button>
          <button
            type="button"
            onClick={useHint}
            disabled={round.hintsLeft <= 0 || round.solved}
            className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition active:translate-y-[2px] disabled:opacity-40"
            style={{
              background: 'rgba(217, 119, 6, 0.18)',
              borderColor: 'rgba(217, 119, 6, 0.55)',
              color: '#f59e0b',
            }}
          >
            <Lightbulb className="h-4 w-4" />
            Gợi ý ({round.hintsLeft}) −{HINT_COST}
          </button>
          <button
            type="button"
            onClick={skipWord}
            disabled={round.solved}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition active:translate-y-[2px] disabled:opacity-40"
            style={{
              background: 'var(--game-control-bg)',
              borderColor: 'var(--game-control-border)',
              color: 'var(--text-muted)',
            }}
          >
            <SkipForward className="h-4 w-4" />
            Bỏ qua
          </button>
        </div>

        <p className="min-h-[16px] text-center text-xs font-bold" style={{ color: 'var(--accent)' }}>
          {message ?? 'Chạm chữ cái để lấp đầy các ô, nhấn Kiểm tra khi đã xong.'}
        </p>

        <p className="text-center text-[10px] theme-muted">
          Phím A-Z để chọn chữ · Backspace xoá chữ cuối · Enter kiểm tra · Esc tạm dừng
        </p>
      </div>
    </GameShell>
  );
};