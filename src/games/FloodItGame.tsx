import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { Lightbulb, Undo2 } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';

interface LevelConfig {
  label: string;
  size: number;
  colors: number;
  bonus: number;
}

interface Snapshot {
  board: number[];
  owned: boolean[];
  moves: number;
  absorbed: number;
}

interface GameState {
  difficulty: Difficulty;
  size: number;
  board: number[];
  owned: boolean[];
  moves: number;
  absorbed: number;
  hints: number;
  history: Snapshot[];
}

const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: { label: 'Dễ', size: 12, colors: 3, bonus: 0 },
  medium: { label: 'Trung bình', size: 14, colors: 5, bonus: 300 },
  hard: { label: 'Khó', size: 16, colors: 6, bonus: 800 },
};

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

const PALETTE: { fill: string; ink: string; name: string }[] = [
  { fill: '#ef4444', ink: '#ffffff', name: 'Đỏ' },
  { fill: '#f59e0b', ink: '#1f2937', name: 'Cam' },
  { fill: '#22c55e', ink: '#052e16', name: 'Xanh lá' },
  { fill: '#3b82f6', ink: '#ffffff', name: 'Xanh dương' },
  { fill: '#a855f7', ink: '#ffffff', name: 'Tím' },
  { fill: '#ec4899', ink: '#ffffff', name: 'Hồng' },
];

const MAX_START_REGION = 3;
const MAX_HINTS = 2;
const HINT_PENALTY = 150;
const HISTORY_LIMIT = 30;
const FLASH_MS = 480;
const HINT_SHOW_MS = 2600;
const FLASH_COLOR = '#fde047';

export const centreOf = (size: number): number => {
  const mid = Math.floor((size - 1) / 2);
  return mid * size + mid;
};

export const componentOf = (board: number[], size: number, start: number): number[] => {
  const total = size * size;
  const target = board[start];
  const seen = new Array<boolean>(total).fill(false);
  const queue = [start];
  const out: number[] = [];
  seen[start] = true;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    out.push(cell);
    const row = Math.floor(cell / size);
    const col = cell % size;
    if (row > 0) pushCell(cell - size);
    if (row < size - 1) pushCell(cell + size);
    if (col > 0) pushCell(cell - 1);
    if (col < size - 1) pushCell(cell + 1);
  }
  return out;

  function pushCell(cell: number): void {
    if (seen[cell] || board[cell] !== target) return;
    seen[cell] = true;
    queue.push(cell);
  }
};

export const generateBoard = (size: number, colors: number): number[] => {
  const total = size * size;
  const board: number[] = new Array(total);
  for (let cell = 0; cell < total; cell++) board[cell] = Math.floor(Math.random() * colors);
  const start = centreOf(size);
  board[start] = 0;
  let region = componentOf(board, size, start);
  let guard = 0;
  while (region.length > MAX_START_REGION && guard++ < total) {
    const pick = region[1 + Math.floor(Math.random() * (region.length - 1))];
    board[pick] = 1 + Math.floor(Math.random() * (colors - 1));
    region = componentOf(board, size, start);
  }
  return board;
};

export const countOwned = (owned: boolean[]): number => {
  let count = 0;
  for (let cell = 0; cell < owned.length; cell++) if (owned[cell]) count++;
  return count;
};

export const floodFrom = (size: number, board: number[], owned: boolean[], target: number): number[] => {
  const total = size * size;
  const grown = owned.slice();
  const queue: number[] = [];
  for (let cell = 0; cell < total; cell++) if (grown[cell]) queue.push(cell);
  const absorbed: number[] = [];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const row = Math.floor(cell / size);
    const col = cell % size;
    if (row > 0) tryTake(cell - size);
    if (row < size - 1) tryTake(cell + size);
    if (col > 0) tryTake(cell - 1);
    if (col < size - 1) tryTake(cell + 1);
  }
  return absorbed;

  function tryTake(cell: number): void {
    if (grown[cell] || board[cell] !== target) return;
    grown[cell] = true;
    absorbed.push(cell);
    queue.push(cell);
  }
};

export const bestColour = (size: number, board: number[], owned: boolean[], current: number): number => {
  let best = -1;
  let bestGain = 0;
  for (let colour = 0; colour < PALETTE.length; colour++) {
    if (colour === current) continue;
    const gain = floodFrom(size, board, owned, colour).length;
    if (gain > bestGain) {
      bestGain = gain;
      best = colour;
    }
  }
  return best;
};

export const computeScore = (absorbed: number, moves: number, hints: number, bonus: number): number =>
  Math.max(50, absorbed * 10 - moves * 5 + bonus - hints * HINT_PENALTY);

const createGame = (difficulty: Difficulty): GameState => {
  const config = LEVELS[difficulty];
  const board = generateBoard(config.size, config.colors);
  const owned = new Array<boolean>(config.size * config.size).fill(false);
  for (const cell of componentOf(board, config.size, centreOf(config.size))) owned[cell] = true;
  return { difficulty, size: config.size, board, owned, moves: 0, absorbed: 0, hints: 0, history: [] };
};

export const FloodItGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('flood-it')!;

  const [game, setGame] = useState<GameState>(() => createGame('medium'));
  const [flash, setFlash] = useState<number[]>([]);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintColour, setHintColour] = useState(-1);
  const [ended, setEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const gameRef = useRef<GameState>(game);
  gameRef.current = game;

  const total = game.size * game.size;
  const currentColour = game.board[centreOf(game.size)];
  const filled = useMemo(() => {
    let count = 0;
    for (let cell = 0; cell < game.owned.length; cell++) if (game.owned[cell]) count++;
    return count;
  }, [game.owned]);
  const looseCounts = useMemo(() => {
    const out = new Array<number>(PALETTE.length).fill(0);
    for (let cell = 0; cell < game.board.length; cell++) {
      if (!game.owned[cell]) out[game.board[cell]]++;
    }
    return out;
  }, [game.board, game.owned]);
  const flashSet = useMemo(() => new Set(flash), [flash]);
  const config = LEVELS[game.difficulty];
  const score = ended ? finalScore : computeScore(game.absorbed, game.moves, game.hints, 0);

  useEffect(() => {
    if (flash.length === 0) return;
    const timer = window.setTimeout(() => setFlash([]), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (hintColour < 0) return;
    const timer = window.setTimeout(() => setHintColour(-1), HINT_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [hintColour]);

  const restart = useCallback((next: Difficulty) => {
    const fresh = createGame(next);
    gameRef.current = fresh;
    setGame(fresh);
    setFlash([]);
    setHintsLeft(MAX_HINTS);
    setHintColour(-1);
    setEnded(false);
    setWon(false);
    setFinalScore(0);
  }, []);

  const playColour = useCallback((target: number) => {
    const state = gameRef.current;
    if (ended) return;
    if (target === state.board[centreOf(state.size)]) return;
    const absorbed = floodFrom(state.size, state.board, state.owned, target);
    if (absorbed.length === 0) return;
    const board = state.board.slice();
    const owned = state.owned.slice();
    for (const cell of absorbed) owned[cell] = true;
    for (let cell = 0; cell < board.length; cell++) if (owned[cell]) board[cell] = target;
    const history = [...state.history, { board: state.board, owned: state.owned, moves: state.moves, absorbed: state.absorbed }].slice(
      -HISTORY_LIMIT,
    );
    const next: GameState = {
      ...state,
      board,
      owned,
      moves: state.moves + 1,
      absorbed: state.absorbed + absorbed.length,
      history,
    };
    gameRef.current = next;
    setGame(next);
    setFlash(absorbed);
    setHintColour(-1);
    playMoveSound();
    if (absorbed.length >= 3) playScoreSound();
    triggerHaptic(Math.min(40, 8 + absorbed.length * 2));
    if (absorbed.length + countOwned(state.owned) === state.size * state.size) {
      setWon(true);
      setEnded(true);
      setFinalScore(computeScore(next.absorbed, next.moves, next.hints, LEVELS[state.difficulty].bonus));
      playClearSound();
      triggerHaptic(70);
    }
  }, [ended]);

  const handleUndo = useCallback(() => {
    const state = gameRef.current;
    if (ended || state.history.length === 0) return;
    const last = state.history[state.history.length - 1];
    const next: GameState = { ...state, ...last, history: state.history.slice(0, -1) };
    gameRef.current = next;
    setGame(next);
    setFlash([]);
    setHintColour(-1);
    playMoveSound();
    triggerHaptic(15);
  }, [ended]);

  const handleHint = useCallback(() => {
    const state = gameRef.current;
    if (ended || hintsLeft <= 0) return;
    const target = bestColour(state.size, state.board, state.owned, state.board[centreOf(state.size)]);
    if (target < 0) return;
    const next: GameState = { ...state, hints: state.hints + 1 };
    gameRef.current = next;
    setGame(next);
    setHintsLeft(value => value - 1);
    setHintColour(target);
    playScoreSound();
    triggerHaptic(25);
  }, [ended, hintsLeft]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target ? target.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;
      if (event.key === 'z' || event.key === 'u') {
        event.preventDefault();
        handleUndo();
        return;
      }
      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= LEVELS[gameRef.current.difficulty].colors) {
        event.preventDefault();
        playColour(digit - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, playColour]);

  const controlClass =
    'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border theme-border theme-panel-soft theme-text transition active:translate-y-[2px] disabled:opacity-40 disabled:pointer-events-none';

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isPaused={false}
      onRestart={() => restart(game.difficulty)}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold theme-text"
            style={{ background: 'var(--game-status-bg)' }}
          >
            Lượt {game.moves}
          </span>
          <span
            className="flex items-center gap-1 rounded-xl border theme-border px-2 py-1 text-xs font-bold theme-text"
            style={{ background: 'var(--game-status-bg)' }}
          >
            {filled}/{total} ô
          </span>
        </div>
      }
    >
      <div className="w-full max-w-[430px] mx-auto flex flex-col items-center gap-2 px-1">
        <div
          className="flex items-center gap-1 p-1 rounded-2xl border theme-border w-full"
          style={{ background: 'var(--surface-soft)' }}
        >
          {DIFFICULTY_ORDER.map(level => {
            const info = LEVELS[level];
            const active = game.difficulty === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  playMoveSound();
                  restart(level);
                }}
                aria-label={`Độ khó ${info.label}, ${info.colors} màu, bàn ${info.size} nhân ${info.size}`}
                aria-pressed={active}
                className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-bold transition active:translate-y-[2px] ${
                  active ? 'text-white' : 'theme-muted'
                }`}
                style={active ? { background: '#4f46e5' } : undefined}
              >
                {info.label}
                <span className="ml-1 text-[10px] opacity-80">
                  {info.colors}M · {info.size}x{info.size}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="w-full rounded-3xl border p-1.5"
          style={{ background: 'var(--game-surface-bg)', borderColor: 'var(--game-surface-border)' }}
        >
          <div
            role="grid"
            aria-label={`Bàn Flood-It ${game.size} nhân ${game.size}`}
            className="grid w-full select-none"
            style={{
              gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))`,
              gap: 1,
              aspectRatio: '1 / 1',
              background: 'var(--game-control-border)',
              borderRadius: 12,
              overflow: 'hidden',
              touchAction: 'manipulation',
            }}
          >
            {game.board.map((colour, cell) => {
              const mine = game.owned[cell];
              const lit = flashSet.has(cell);
              return (
                <div
                  key={cell}
                  role="gridcell"
                  aria-label={`Hàng ${Math.floor(cell / game.size) + 1}, cột ${(cell % game.size) + 1}, màu ${
                    PALETTE[colour].name
                  }${mine ? ', đã chiếm' : ''}`}
                  style={{
                    position: 'relative',
                    background: lit ? FLASH_COLOR : PALETTE[colour].fill,
                    transition: `background-color ${FLASH_MS}ms ease-out`,
                    touchAction: 'manipulation',
                  }}
                >
                  {!mine && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.22)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full">
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-color)' }}
          >
            <div
              style={{
                width: `${Math.round((filled / total) * 100)}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 260ms ease-out',
              }}
            />
          </div>
        </div>

        <div role="group" aria-label="Bảng màu" className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: config.colors }, (_, colour) => {
            const current = colour === currentColour;
            const remaining = current ? filled : looseCounts[colour];
            const gone = !current && remaining === 0;
            const hinted = hintColour === colour;
            return (
              <button
                key={colour}
                type="button"
                onClick={() => playColour(colour)}
                disabled={ended || current || gone}
                aria-pressed={current}
                aria-label={`Màu ${PALETTE[colour].name}, còn ${remaining} ô${gone ? ', đã hết' : ''}`}
                className="relative flex flex-col items-center justify-center rounded-2xl border-2 transition active:translate-y-[2px] disabled:pointer-events-none"
                style={{
                  width: 54,
                  height: 54,
                  background: PALETTE[colour].fill,
                  borderColor: current ? '#f8fafc' : hinted ? '#fde047' : 'transparent',
                  color: PALETTE[colour].ink,
                  opacity: gone ? 0.35 : 1,
                }}
              >
                <span className="text-sm font-black leading-none">{gone ? '✓' : remaining}</span>
                {current && (
                  <span className="mt-0.5 text-[9px] font-bold uppercase leading-none opacity-90">
                    Đang chơi
                  </span>
                )}
                {hinted && !current && (
                  <span className="absolute -top-2 -right-2 rounded-md px-1 text-[9px] font-black leading-4"
                    style={{ background: '#1f2937', color: '#fde047' }}
                  >
                    GỢI Ý
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 w-full">
          <button
            type="button"
            onClick={handleUndo}
            disabled={ended || game.history.length === 0}
            aria-label="Hoàn tác lượt đi cuối cùng"
            className={controlClass}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Hoàn tác
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={ended || hintsLeft <= 0}
            aria-label={`Gợi ý, còn ${hintsLeft} lượt, trừ ${HINT_PENALTY} điểm`}
            className={controlClass}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Gợi ý ({hintsLeft})
          </button>
        </div>

        <p className="text-[11px] theme-muted text-center leading-snug px-2">
          Chọn màu để vùng của bạn lan sang các ô cùng màu. Nuôi cho cả bàn thành một màu. Phím 1-{config.colors} để
          chọn nhanh, Z hoàn tác.
        </p>
      </div>
    </GameShell>
  );
};
