import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playBounceSound, playClearSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Lightbulb } from 'lucide-react';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface WordEntry {
  word: string;
  clue: string;
}

export interface DifficultyConfig {
  label: string;
  hint: string;
  lives: number;
  baseScore: number;
  lifeBonus: number;
  hintPenalty: number;
}

export interface HangmanState {
  word: string;
  guessed: string[];
  livesRemaining: number;
  hintsUsed: number;
  ended: boolean;
  won: boolean;
}

export interface GuessResult {
  state: HangmanState;
  accepted: boolean;
  hit: boolean;
}

export const MAX_HINTS = 2;

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Dễ',
    hint: 'Từ 4-5 chữ cái',
    lives: 6,
    baseScore: 300,
    lifeBonus: 120,
    hintPenalty: 150,
  },
  medium: {
    label: 'Trung bình',
    hint: 'Từ 6 chữ cái',
    lives: 5,
    baseScore: 600,
    lifeBonus: 140,
    hintPenalty: 180,
  },
  hard: {
    label: 'Khó',
    hint: 'Từ 7-8 chữ cái',
    lives: 4,
    baseScore: 1000,
    lifeBonus: 180,
    hintPenalty: 220,
  },
};

const RAW_WORDS: [string, string][] = [
  ['chua', 'Quả mọc trên cây, ăn vào chua ngọt'],
  ['nuoc', 'Chất lỏng không màu để uống'],
  ['chan', 'Bàn tay, cẳng tay'],
  ['buon', 'Không vui, đau khổ'],
  ['uong', 'Đưa chất lỏng vào miệng'],
  ['sang', 'Buổi sớm, sau một đêm dài'],
  ['nhac', 'Nhạc, âm thanh'],
  ['quay', 'Xoay lại, quay đầu'],
  ['banh', 'Món ăn làm từ bột, nướng hoặc luộc'],
  ['thoi', 'Dùng đồ vật để làm một việc'],
  ['chat', 'Lời trao đổi, tin nhắn'],
  ['ngan', 'Nhốt, giam giữ'],
  ['chai', 'Bình đựng nước hoặc pha chè'],
  ['chay', 'Chạy, di chuyển nhanh bằng chân'],
  ['hang', 'Xếp chồng lên nhau theo hàng'],
  ['tram', 'Điểm giao thông, chỗ xe buýt dừng'],
  ['vien', 'Viên nhỏ, mảnh'],
  ['biet', 'Biết, hiểu rõ'],
  ['dung', 'Đúng, chính xác'],
  ['gioi', 'Giới, thế giới'],
  ['chim', 'Động vật có cánh, biết bay'],
  ['nhay', 'Nhảy, vót lên'],
  ['bang', 'Cánh tay dài'],
  ['trau', 'Gia súc lớn để kéo xe, cày ruộng'],
  ['chao', 'Lời chào'],
  ['ghim', 'Cài xuống, ấn vào'],
  ['quan', 'Quan tâm, giữ gìn theo dõi'],
  ['giup', 'Giúp đỡ, ra tay cho người khác'],
  ['lien', 'Liên hệ, liên quan với nhau'],
  ['thuy', 'Nước, chất lỏng không màu'],
  ['vang', 'Âm thanh to, vang vọng'],
  ['luan', 'Bàn luận, nói chuyện với nhau'],
  ['nghi', 'Suy nghĩ, cân nhắc'],
  ['truc', 'Thẳng, không cong'],
  ['kich', 'Cú va, đâm vào'],
  ['long', 'Dài, kéo dài ra'],
  ['manh', 'Mảnh, mảnh nhỏ'],
  ['trai', 'Quả cây ăn được'],
  ['hoan', 'Vui vẻ, hân hoan'],
  ['hieu', 'Hiểu, biết rõ'],
  ['binh', 'Bình yên, không có chiến tranh'],
  ['sach', 'Tập giấy có trang, để đọc'],
  ['chuc', 'Chúc mừng, chúc lành'],
  ['buoc', 'Bước chân, giai đoạn trong công việc'],
  ['viet', 'Ký lại bằng chữ nét'],
  ['rong', 'Rong biển, cây mọc ở dưới nước'],
  ['tach', 'Tách ra, chia riêng'],
  ['buoi', 'Buổi, khoảng thời gian trong ngày'],
  ['kiem', 'Kiếm tiền, tìm kiếm'],
  ['giam', 'Nhốt, cầm giữ lại'],
  ['suot', 'Suốt, trong suốt một khoảng thời gian'],
  ['dieu', 'Điều, việc, sự việc'],
  ['viec', 'Việc, công việc phải làm'],
  ['tiem', 'Có lợi, đáng giá'],
  ['tuoi', 'Tươi, còn sống, tươi mới'],
  ['lanh', 'Lạnh, nhiệt độ thấp'],
  ['ngon', 'Ngon, dễ ăn, vị đúng'],
  ['xinh', 'Đẹp, dễ thương'],
  ['thap', 'Thấp, ở phía dưới'],
  ['kien', 'Kiến, loài côn trùng nhỏ'],
  ['hinh', 'Hình dáng, bức hình'],
  ['ghep', 'Ghép, nối lại với nhau'],
  ['bien', 'Mặn, nước lớn'],
  ['cham', 'Chịu đựng, không dễ bỏ cuộc'],
  ['khung', 'Khung, khung cửa'],
  ['giap', 'Giáp, lớp áo bọc thân'],
  ['phai', 'Bắt buộc, phải như vậy'],
  ['khac', 'Khác, không giống nhau'],
  ['benh', 'Bệnh, ốm đau'],
  ['phuc', 'May mắn, phúc'],
  ['oanh', 'Ánh sáng trong trời tối'],
  ['rung', 'Rung, lắc nhẹ'],
  ['sung', 'Mũi tên bắn ra'],
  ['bung', 'Nhảy lên, bung ra'],
  ['trut', 'Trừ, bỏ đi một phần'],
  ['nhot', 'Bỏng, rát da'],
  ['phan', 'Phần, phần được chia ra'],
  ['ngot', 'Ngọt, có vị ngọt'],
  ['muoi', 'Muối, vị mặn'],
  ['xoai', 'Xoài, trái cây vỏ vàng ăn ngọt'],
  ['giua', 'Ở giữa, không trên không dưới'],
  ['cuoi', 'Cuối, phần sau cùng'],
  ['tren', 'Ở phía trên'],
  ['duoi', 'Ở phía dưới'],
  ['luoc', 'Luộc, nấu trong nước sôi'],
  ['rang', 'Cháo khô nấu sấy cho giòn'],
  ['xong', 'Xong, đã hoàn thành'],
  ['duoc', 'Được, có quyền'],
  ['muon', 'Muốn, có ý định'],
  ['trua', 'Trưa, giữa ban ngày'],
  ['nang', 'Nặng, có trọng lượng lớn'],
  ['chuoi', 'Trái cây vỏ vàng, dài, ăn rất ngọt'],
  ['nhanh', 'Chóng mặt, mau mắn'],
  ['thong', 'Khí ra vào của phổi'],
  ['trong', 'Ở bên trong, ở phía trong'],
  ['tranh', 'Bức hình vẽ, tranh treo tường'],
  ['trang', 'Màu trắng, sạch sẽ'],
  ['khoan', 'Khoảng trống giữa hai thứ'],
  ['giang', 'Giương, dang ra hai bên'],
  ['ngoan', 'Ngoan, hiền, ngoan ngoãn'],
  ['hanoi', 'Thủ đô của Việt Nam'],
  ['nguoi', 'Người, con người'],
  ['quyet', 'Bán quyết định, dứt khoát'],
  ['khong', 'Không có, không được phép'],
  ['thien', 'Trời, bầu trời'],
  ['thang', 'Bậc để bước lên cao hơn'],
  ['ngang', 'Ngang, cùng chiều ngang'],
  ['vuong', 'Vương, muốn làm vua'],
  ['nuong', 'Nấu chín bằng nước'],
  ['duong', 'Đường, con đường để đi'],
  ['canh', 'Món rau nấu nước'],
  ['thit', 'Thịt, phần thức ăn từ động vật'],
  ['trung', 'Ở giữa, không trên không dưới'],
  ['ngoai', 'Bên ngoài, phía bên kia'],
  ['khach', 'Khách, người đến thăm'],
  ['chiem', 'Chiếm, giữ lại'],
  ['chien', 'Chiến, tranh đấu giữa các phe'],
  ['chuot', 'Chuột, loài gặm nhỏ'],
  ['muong', 'Nước mắm làm từ cá'],
  ['truong', 'Nơi học tập của học sinh'],
  ['truyen', 'Truyền lại, trao cho đời sau'],
  ['thuong', 'Thương, yêu quý nhớ nhung'],
  ['nghien', 'Học tập, tìm hiểu một môn'],
  ['thuyen', 'Phương tiện dùng để đi trên nước'],
  ['khuyen', 'Lời khuyên, khuyến nghị'],
  ['hoctap', 'Việc học tập, học hành'],
  ['vanhoa', 'Văn hóa, phong tục truyền thống'],
  ['lichsu', 'Lịch sử, chuyện xưa xa'],
  ['matdat', 'Mặt đất, bề mặt trái đất'],
  ['vuviec', 'Công việc, việc làm được giao'],
  ['chuong', 'Tiếng chuông kêu báo giờ'],
  ['chuyen', 'Di chuyển, đổi chỗ'],
  ['nhacsi', 'Nhạc sĩ, người chơi nhạc'],
  ['saigon', 'Thành phố lớn ở miền Nam'],
  ['vuvien', 'Vũ khí dùng để chiến đấu'],
  ['thongtin', 'Tin tức, thông tin'],
  ['connguoi', 'Con người, loài người'],
  ['nguoilon', 'Người lớn, người đã trưởng thành'],
  ['lamviec', 'Làm việc, lao động'],
  ['khoehoc', 'Khoa học, nghiên cứu thiên nhiên'],
  ['kythuat', 'Kỹ thuật, kỹ năng làm việc'],
  ['maytinh', 'Máy tính, máy điện tử'],
  ['nghieng', 'Tàu nghiêng, bênh vênh'],
  ['thethao', 'Thể thao, tập thể dục'],
  ['vietnam', 'Tên nước, quê hương'],
  ['xinchao', 'Lời chào, lời chào hỏi'],
  ['diadiem', 'Địa điểm, nơi chốn'],
  ['thegioi', 'Thế giới, mặt đất'],
  ['hocvien', 'Học viện, nơi đào tạo'],
  ['nguoihoc', 'Người học, học sinh sinh viên'],
  ['nghivien', 'Nghị viện, chỗ làm việc chuyên gia'],
  ['vanphong', 'Văn phòng, chỗ làm việc'],
  ['thuvien', 'Thư viện, nơi chứa sách'],
  ['giaoduc', 'Giáo dục, việc dạy dỗ'],
];

export const HANGMAN_WORDS: WordEntry[] = RAW_WORDS.map(([word, clue]) => ({ word, clue }));

export const CLUE_BY_WORD: Record<string, string> = HANGMAN_WORDS.reduce<Record<string, string>>(
  (acc, entry) => {
    acc[entry.word] = entry.clue;
    return acc;
  },
  {},
);

export const poolForDifficulty = (difficulty: Difficulty): WordEntry[] => {
  if (difficulty === 'easy') return HANGMAN_WORDS.filter(entry => entry.word.length <= 5);
  if (difficulty === 'medium') return HANGMAN_WORDS.filter(entry => entry.word.length === 6);
  return HANGMAN_WORDS.filter(entry => entry.word.length >= 7);
};

export const pickWord = (difficulty: Difficulty, random: () => number = Math.random): WordEntry => {
  const pool = poolForDifficulty(difficulty);
  return pool[Math.floor(random() * pool.length)];
};

export const createRound = (difficulty: Difficulty, random: () => number = Math.random): HangmanState => ({
  word: pickWord(difficulty, random).word,
  guessed: [],
  livesRemaining: DIFFICULTY_CONFIG[difficulty].lives,
  hintsUsed: 0,
  ended: false,
  won: false,
});

export const revealMask = (word: string, guessed: readonly string[]): boolean[] => {
  const hit = new Set(guessed);
  return word.split('').map(char => hit.has(char));
};

export const isWordSolved = (word: string, guessed: readonly string[]): boolean => {
  const hit = new Set(guessed);
  return word.split('').every(char => hit.has(char));
};

export const applyGuess = (state: HangmanState, rawLetter: string): GuessResult => {
  const letter = rawLetter.toLowerCase();
  if (state.ended || !/^[a-z]$/.test(letter) || state.guessed.includes(letter)) {
    return { state, accepted: false, hit: false };
  }
  const hit = state.word.includes(letter);
  const guessed = [...state.guessed, letter];
  const livesRemaining = hit ? state.livesRemaining : state.livesRemaining - 1;
  const won = hit && isWordSolved(state.word, guessed);
  return {
    state: {
      ...state,
      guessed,
      livesRemaining: Math.max(0, livesRemaining),
      won,
      ended: won || livesRemaining <= 0,
    },
    accepted: true,
    hit,
  };
};

export const pickHintLetter = (
  word: string,
  guessed: readonly string[],
  random: () => number = Math.random,
): string | null => {
  const hit = new Set(guessed);
  const missing = word.split('').filter(char => !hit.has(char));
  const unique = Array.from(new Set(missing));
  if (unique.length === 0) return null;
  const vowels = unique.filter(char => 'aeiouy'.includes(char));
  const bucket = vowels.length > 0 ? vowels : unique;
  return bucket[Math.floor(random() * bucket.length)];
};

export const applyHint = (
  state: HangmanState,
  random: () => number = Math.random,
): { state: HangmanState; letter: string | null } => {
  if (state.ended) return { state, letter: null };
  const letter = pickHintLetter(state.word, state.guessed, random);
  if (!letter) return { state, letter: null };
  const livesRemaining = Math.max(0, state.livesRemaining - 1);
  const guessed = [...state.guessed, letter];
  const won = isWordSolved(state.word, guessed);
  return {
    state: {
      ...state,
      guessed,
      livesRemaining,
      hintsUsed: state.hintsUsed + 1,
      won,
      ended: won || livesRemaining <= 0,
    },
    letter,
  };
};

export const computeScore = (
  difficulty: Difficulty,
  livesRemaining: number,
  hintsUsed: number,
  won: boolean,
): number => {
  if (!won) return 0;
  const config = DIFFICULTY_CONFIG[difficulty];
  const raw = config.baseScore + Math.max(0, livesRemaining) * config.lifeBonus - hintsUsed * config.hintPenalty;
  const floor = Math.round(config.baseScore * 0.2);
  return Math.max(floor, Math.round(raw));
};

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const GALLOWS_PARTS = [
  'absolute left-[7.4rem] top-[4.1rem] h-7 w-7 rounded-full border-2',
  'absolute left-[8.05rem] top-24 h-10 w-1.5',
  'absolute left-[6.9rem] top-[6.6rem] h-1.5 w-5',
  'absolute left-[8.5rem] top-[6.6rem] h-1.5 w-5',
  'absolute left-[7.75rem] top-[8.4rem] h-12 w-1.5',
  'absolute left-[8.5rem] top-[8.4rem] h-12 w-1.5',
];

const FRAME_COLORS = {
  fill: 'var(--border-color)',
  stroke: 'var(--border-color)',
  drawn: '#e11d48',
};

const figurePartStyle = (active: boolean, round: boolean): React.CSSProperties => ({
  background: active ? FRAME_COLORS.drawn : 'transparent',
  borderColor: active ? FRAME_COLORS.drawn : FRAME_COLORS.stroke,
  borderWidth: round ? 3 : 2,
});

export const HangmanGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [game, setGame] = useState<HangmanState>(() => createRound('medium'));
  const gameRef = useRef<HangmanState>(game);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const config = DIFFICULTY_CONFIG[difficulty];
  const mistakes = Math.min(config.lives - game.livesRemaining, GALLOWS_PARTS.length);
  const mask = useMemo(() => revealMask(game.word, game.guessed), [game.word, game.guessed]);
  const hintSet = useMemo(() => new Set(game.guessed.filter(letter => game.word.includes(letter))), [game.word, game.guessed]);
  const missSet = useMemo(() => new Set(game.guessed.filter(letter => !game.word.includes(letter))), [game.word, game.guessed]);
  const hintsLeft = MAX_HINTS - game.hintsUsed;
  const score = game.ended ? computeScore(difficulty, game.livesRemaining, game.hintsUsed, game.won) : 0;

  const commit = useCallback((next: HangmanState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const guessLetter = useCallback(
    (raw: string) => {
      const result = applyGuess(gameRef.current, raw);
      if (!result.accepted) return;
      if (result.state.won) playClearSound();
      else if (result.hit) playMoveSound();
      else {
        playBounceSound();
        triggerHaptic(18);
      }
      commit(result.state);
    },
    [commit],
  );

  const useHint = useCallback(() => {
    const result = applyHint(gameRef.current);
    if (!result.letter) return;
    playScoreSound();
    triggerHaptic(20);
    commit(result.state);
  }, [commit]);

  const startRound = useCallback(
    (next: Difficulty) => {
      setDifficulty(next);
      commit(createRound(next));
    },
    [commit],
  );

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
        guessLetter(event.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [guessLetter]);

  return (
    <GameShell
      game={getGameById('hangman')!}
      score={score}
      isGameOver={game.ended}
      isVictory={game.won}
      isPaused={false}
      onRestart={() => commit(createRound(difficulty))}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="px-3 py-1 rounded-xl border theme-border flex items-center gap-1.5" style={{ background: 'var(--surface-strong)' }}>
          <span className="text-[10px] uppercase font-bold theme-muted">Mạng:</span>
          <span className="text-sm font-black text-rose-400">
            {game.livesRemaining}/{config.lives}
          </span>
          <span className="text-[10px] theme-muted">· Sai {mistakes}</span>
        </div>
      }
    >
      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <div className="grid w-full grid-cols-3 gap-2">
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(key => {
            const item = DIFFICULTY_CONFIG[key];
            const active = key === difficulty;
            return (
              <button
                key={key}
                onClick={() => startRound(key)}
                className={`rounded-xl border px-2 py-2 text-xs font-black transition-transform active:translate-y-[2px] ${
                  active ? 'border-transparent text-white' : 'theme-panel-soft theme-text theme-border'
                }`}
                style={active ? { background: '#0d9488' } : undefined}
              >
                {item.label}
                <span className="block text-[10px] font-semibold opacity-80">{item.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 theme-border" style={{ background: 'var(--game-status-bg)' }}>
          <span className="text-[11px] font-bold uppercase theme-muted">Mạng còn</span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: config.lives }).map((_, index) => {
              const alive = index < game.livesRemaining;
              return (
                <div
                  key={index}
                  className="grid h-6 w-6 place-items-center rounded-md border-2 text-xs font-black transition-colors duration-150"
                  style={
                    alive
                      ? { background: '#e11d48', borderColor: '#e11d48', color: '#fff' }
                      : { background: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-muted)', opacity: 0.5 }
                  }
                >
                  {alive ? '♥' : '–'}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative h-48 w-40" aria-label="Khung treo cổ">
          <div className="absolute bottom-2 left-2 h-1.5 w-36 rounded-full" style={{ background: FRAME_COLORS.fill }} />
          <div className="absolute bottom-2 left-8 top-10 w-1.5 rounded-full" style={{ background: FRAME_COLORS.fill }} />
          <div className="absolute left-8 top-10 h-1.5 w-28 rounded-full" style={{ background: FRAME_COLORS.fill }} />
          <div className="absolute left-[8.25rem] top-[2.9rem] h-5 w-1 rounded-full" style={{ background: FRAME_COLORS.fill }} />
          {GALLOWS_PARTS.map((className, index) => (
            <div
              key={className}
              className={`${className} animate-in fade-in duration-200`}
              style={figurePartStyle(index < mistakes, className.includes('rounded-full'))}
            />
          ))}
        </div>

        <div className="w-full rounded-xl border px-3 py-2 text-center theme-border" style={{ background: 'var(--surface-soft)' }}>
          <span className="text-[10px] font-bold uppercase theme-muted">Gợi ý nghĩa: </span>
          <span className="text-xs font-bold theme-text">{CLUE_BY_WORD[game.word]}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Ô chữ cái">
          {game.word.split('').map((char, index) => {
            const shown = mask[index];
            const fresh = game.won || !game.ended;
            return (
              <div
                key={`${char}-${index}`}
                className="grid h-11 w-8 place-items-center rounded-lg border-2 text-lg font-black uppercase transition-colors duration-150"
                style={
                  shown
                    ? {
                        background: game.won ? '#0d9488' : fresh ? 'var(--surface-strong)' : '#4b5563',
                        borderColor: game.won ? '#0d9488' : fresh ? 'var(--accent)' : '#4b5563',
                        color: '#fff',
                      }
                    : { background: 'transparent', borderColor: 'var(--game-control-border)', color: 'var(--text-muted)' }
                }
              >
                {shown ? char : <span className="h-1 w-4 rounded-full" style={{ background: 'var(--game-control-border)' }} />}
              </div>
            );
          })}
        </div>

        {game.ended && !game.won && (
          <div className="w-full rounded-xl border-2 px-3 py-2 text-center animate-in fade-in duration-200" style={{ borderColor: '#e11d48' }}>
            <div className="text-[10px] font-bold uppercase" style={{ color: '#e11d48' }}>
              Đáp án
            </div>
            <div className="text-xl font-black uppercase tracking-widest theme-text">{game.word}</div>
          </div>
        )}

        {game.ended && game.won && (
          <div className="w-full rounded-xl border-2 px-3 py-2 text-center" style={{ borderColor: '#0d9488' }}>
            <div className="text-[10px] font-bold uppercase" style={{ color: '#0d9488' }}>
              Bạn đã thắng
            </div>
            <div className="text-sm font-black theme-text">
              Còn {game.livesRemaining}/{config.lives} mạng · Điểm {score.toLocaleString('vi-VN')}
            </div>
          </div>
        )}

        <button
          onClick={useHint}
          disabled={game.ended || hintsLeft <= 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-black transition-transform active:translate-y-[2px] disabled:opacity-40"
          style={{ background: '#d97706', borderColor: '#d97706', color: '#fff' }}
        >
          <Lightbulb className="h-4 w-4" />
          {hintsLeft > 0 ? `Gợi ý (còn ${hintsLeft}) - hé lộ 1 chữ cái, mất 1 mạng` : 'Đã hết gợi ý'}
        </button>

        {!game.ended && (
          <div className="flex w-full flex-col gap-1.5 rounded-2xl border p-2 theme-border" style={{ background: 'var(--game-status-bg)' }}>
            {KEY_ROWS.map(row => (
              <div key={row} className="flex justify-center gap-1">
                {[...row].map(letter => {
                  const isHit = hintSet.has(letter);
                  const isMiss = missSet.has(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => guessLetter(letter)}
                      disabled={isHit || isMiss}
                      className="h-10 min-w-7 flex-1 rounded-full border text-xs font-black uppercase transition-transform active:translate-y-[2px] disabled:opacity-60"
                      style={
                        isHit
                          ? { background: '#0d9488', borderColor: '#0d9488', color: '#fff' }
                          : isMiss
                            ? { background: 'transparent', borderColor: 'var(--border-color)', color: '#e11d48' }
                            : { background: 'var(--game-control-bg)', borderColor: 'var(--game-control-border)', color: 'var(--text-primary)' }
                      }
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="text-center text-[10px] theme-muted">
              Gõ phím A-Z trên bàn phím hoặc chạm vào bàn phím
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
};