import React, { useEffect, useReducer, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playMoveSound,
  playScoreSound,
  playClearSound,
  playBounceSound,
  triggerHaptic,
} from '../utils/sound';
import { Delete, Timer, Trophy } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'select' | 'turn' | 'feedback' | 'done';
type PlayerIndex = 0 | 1;

interface Question {
  text: string;
  answer: number;
}

interface Feedback {
  player: PlayerIndex;
  correct: boolean;
  timedOut: boolean;
  points: number;
  answer: number;
}

interface DuelState {
  difficulty: Difficulty | null;
  questions: Question[];
  index: number;
  activePlayer: PlayerIndex;
  scores: [number, number];
  roundPoints: [number, number];
  marks: number[];
  phase: Phase;
  input: string;
  timeLeft: number;
  feedback: Feedback | null;
  correctCount: number;
  attemptCount: number;
}

type DuelAction =
  | { type: 'START'; difficulty: Difficulty }
  | { type: 'PRESS'; digit: string }
  | { type: 'BACK' }
  | { type: 'SUBMIT'; elapsed: number }
  | { type: 'TICK'; remaining: number }
  | { type: 'ADVANCE' }
  | { type: 'RESET' };

const TIME_LIMIT = 15;
const BASE_POINTS = 10;
const MIN_POINTS = 2;
const MAX_DIGITS = 4;

const P1_COLOR = '#4f46e5';
const P2_COLOR = '#0d9488';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

const QUESTION_COUNT: Record<Difficulty, number> = {
  easy: 10,
  medium: 12,
  hard: 15,
};

const initialState: DuelState = {
  difficulty: null,
  questions: [],
  index: 0,
  activePlayer: 0,
  scores: [0, 0],
  roundPoints: [0, 0],
  marks: [],
  phase: 'select',
  input: '',
  timeLeft: TIME_LIMIT,
  feedback: null,
  correctCount: 0,
  attemptCount: 0,
};

const randInt = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1));

function makeAddition(): Question {
  const a = randInt(4, 40);
  const b = randInt(3, Math.max(3, 50 - a));
  return { text: `${a} + ${b}`, answer: a + b };
}

function makeSubtraction(): Question {
  const a = randInt(12, 50);
  const b = randInt(2, a - 1);
  return { text: `${a} - ${b}`, answer: a - b };
}

function makeMultiply(): Question {
  const a = randInt(2, 12);
  const b = randInt(2, 12);
  return { text: `${a} × ${b}`, answer: a * b };
}

function makeDivision(): Question {
  const divisor = randInt(2, 12);
  const quotient = randInt(2, 12);
  return { text: `${divisor * quotient} ÷ ${divisor}`, answer: quotient };
}

function makeMixed(): Question {
  const shape = randInt(0, 3);
  if (shape === 0) {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const term = randInt(4, 40);
    return { text: `${term} + ${a} × ${b}`, answer: term + a * b };
  }
  if (shape === 1) {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const term = randInt(4, 40);
    return { text: `${term} + ${a * b} - ${a} × ${b}`, answer: term };
  }
  if (shape === 2) {
    const divisor = randInt(2, 12);
    const quotient = randInt(3, 12);
    const term = randInt(1, quotient - 1);
    return { text: `${divisor * quotient} ÷ ${divisor} - ${term}`, answer: quotient - term };
  }
  const divisor = randInt(2, 12);
  const quotient = randInt(2, 12);
  const term = randInt(3, 30);
  return { text: `${divisor * quotient} ÷ ${divisor} + ${term}`, answer: quotient + term };
}

function makeQuestion(difficulty: Difficulty): Question {
  const roll = Math.random();
  if (difficulty === 'easy') {
    return roll < 0.5 ? makeAddition() : makeSubtraction();
  }
  if (difficulty === 'medium') {
    if (roll < 0.35) return makeAddition();
    if (roll < 0.7) return makeSubtraction();
    return makeMultiply();
  }
  if (roll < 0.3) return makeDivision();
  if (roll < 0.6) return makeAddition();
  if (roll < 0.8) return makeSubtraction();
  return makeMixed();
}

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

/** Ramps the tier up as the duel progresses so later rounds are harder. */
function tierForRound(base: Difficulty, index: number, total: number): Difficulty {
  const baseRank = DIFFICULTY_ORDER.indexOf(base);
  const progress = total <= 1 ? 1 : index / (total - 1);
  const rank = baseRank + Math.round(progress * 2);
  return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, rank))];
}

function generateQuestions(difficulty: Difficulty, count: number): Question[] {
  const seen = new Set<string>();
  const questions: Question[] = [];
  const guardLimit = count * 500;
  let guard = 0;
  while (questions.length < count && guard < guardLimit) {
    guard += 1;
    const question = makeQuestion(tierForRound(difficulty, questions.length, count));
    if (!Number.isInteger(question.answer) || question.answer < 0 || seen.has(question.text)) continue;
    seen.add(question.text);
    questions.push(question);
  }
  while (questions.length < count) questions.push(makeQuestion(difficulty));
  return questions;
}

function scoreAnswer(elapsed: number): number {
  return Math.max(MIN_POINTS, BASE_POINTS - Math.floor(elapsed));
}

function applySubmit(state: DuelState, elapsed: number, timedOut: boolean): DuelState {
  const question = state.questions[state.index];
  const correct = !timedOut && Number(state.input) === question.answer;
  const points = correct ? scoreAnswer(elapsed) : 0;
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const roundPoints: [number, number] = [state.roundPoints[0], state.roundPoints[1]];
  scores[state.activePlayer] += points;
  roundPoints[state.activePlayer] = points;
  return {
    ...state,
    scores,
    roundPoints,
    input: '',
    timeLeft: timedOut ? 0 : state.timeLeft,
    phase: 'feedback',
    correctCount: state.correctCount + (correct ? 1 : 0),
    attemptCount: state.attemptCount + 1,
    feedback: {
      player: state.activePlayer,
      correct,
      timedOut,
      points,
      answer: question.answer,
    },
  };
}

function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'START':
      return {
        ...initialState,
        difficulty: action.difficulty,
        questions: generateQuestions(action.difficulty, QUESTION_COUNT[action.difficulty]),
        phase: 'turn',
        timeLeft: TIME_LIMIT,
      };
    case 'PRESS':
      if (state.phase !== 'turn') return state;
      if (state.input.length >= MAX_DIGITS) return state;
      if (state.input.length === 0 && action.digit === '0') return state;
      return { ...state, input: state.input + action.digit };
    case 'BACK':
      if (state.phase !== 'turn') return state;
      return { ...state, input: state.input.slice(0, -1) };
    case 'SUBMIT': {
      if (state.phase !== 'turn' || state.input.length === 0) return state;
      return applySubmit(state, action.elapsed, false);
    }
    case 'TICK': {
      if (state.phase !== 'turn') return state;
      if (action.remaining <= 0) return applySubmit(state, TIME_LIMIT, true);
      return { ...state, timeLeft: action.remaining };
    }
    case 'ADVANCE': {
      if (state.phase !== 'feedback') return state;
      if (state.activePlayer === 0) {
        return {
          ...state,
          activePlayer: 1,
          phase: 'turn',
          input: '',
          timeLeft: TIME_LIMIT,
          feedback: null,
        };
      }
      const [first, second] = state.roundPoints;
      const mark = first > second ? 1 : second > first ? 2 : 0;
      const marks = [...state.marks, mark];
      if (state.index >= state.questions.length - 1) {
        return { ...state, marks, phase: 'done', input: '', feedback: null };
      }
      return {
        ...state,
        marks,
        index: state.index + 1,
        activePlayer: 0,
        phase: 'turn',
        input: '',
        timeLeft: TIME_LIMIT,
        feedback: null,
        roundPoints: [0, 0],
      };
    }
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

export const MathDuelGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const [state, dispatch] = useReducer(duelReducer, initialState);
  const turnStartRef = useRef<number>(0);

  const phase = state.phase;
  const total = state.questions.length;
  const currentQuestion = total > 0 ? state.questions[state.index] : null;
  const difficulty = state.difficulty;
  const playerOne = state.scores[0];
  const playerTwo = state.scores[1];
  const score = Math.max(playerOne, playerTwo);
  const won = playerOne > playerTwo;
  const drew = playerOne === playerTwo;
  const ended = phase === 'done';
  const ratio = Math.max(0, Math.min(1, state.timeLeft / TIME_LIMIT));
  const accent = state.activePlayer === 0 ? P1_COLOR : P2_COLOR;
  const accuracy =
    state.attemptCount === 0 ? 0 : Math.round((state.correctCount / state.attemptCount) * 100);

  useEffect(() => {
    if (phase !== 'turn') return;
    turnStartRef.current = performance.now();
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - turnStartRef.current) / 1000;
      dispatch({ type: 'TICK', remaining: Math.max(0, TIME_LIMIT - elapsed) });
    }, 60);
    return () => window.clearInterval(id);
  }, [phase, state.index, state.activePlayer]);

  useEffect(() => {
    if (phase !== 'feedback') return;
    const id = window.setTimeout(() => dispatch({ type: 'ADVANCE' }), 1100);
    return () => window.clearTimeout(id);
  }, [phase, state.index, state.activePlayer, state.feedback]);

  useEffect(() => {
    if (phase !== 'feedback' || !state.feedback) return;
    if (state.feedback.correct) {
      playScoreSound();
      triggerHaptic(20);
    } else {
      playBounceSound();
      triggerHaptic(40);
    }
  }, [phase, state.feedback]);

  useEffect(() => {
    if (phase === 'turn' && state.activePlayer === 0 && state.index > 0) playClearSound();
  }, [phase, state.activePlayer, state.index]);

  const submit = () => {
    if (phase !== 'turn' || state.input.length === 0) return;
    const elapsed = Math.min(TIME_LIMIT, (performance.now() - turnStartRef.current) / 1000);
    dispatch({ type: 'SUBMIT', elapsed });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (state.phase !== 'turn') return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        playMoveSound();
        dispatch({ type: 'PRESS', digit: event.key });
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        playMoveSound();
        dispatch({ type: 'BACK' });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.phase, state.input]);

  const restart = () => dispatch({ type: 'RESET' });

  const press = (digit: string) => {
    playMoveSound();
    dispatch({ type: 'PRESS', digit });
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  const renderKey = (key: string) => {
    if (key === 'del') {
      return (
        <button
          key={key}
          onClick={() => {
            playMoveSound();
            dispatch({ type: 'BACK' });
          }}
          disabled={phase !== 'turn' || state.input.length === 0}
          className="h-12 sm:h-14 rounded-2xl border theme-border theme-panel-soft flex items-center justify-center transition active:translate-y-[2px] disabled:opacity-35"
          aria-label="Xoá"
        >
          <Delete className="w-5 h-5 theme-muted" />
        </button>
      );
    }
    if (key === 'ok') {
      return (
        <button
          key={key}
          onClick={submit}
          disabled={phase !== 'turn' || state.input.length === 0}
          className="h-12 sm:h-14 rounded-2xl text-white text-xs font-black transition active:translate-y-[2px] disabled:opacity-35"
          style={{ background: phase === 'turn' ? accent : 'var(--game-control-bg)' }}
        >
          XÁC NHẬN
        </button>
      );
    }
    return (
      <button
        key={key}
        onClick={() => press(key)}
        disabled={phase !== 'turn'}
        className="h-12 sm:h-14 rounded-2xl border theme-border theme-panel-soft text-lg sm:text-xl font-black theme-text transition active:translate-y-[2px] disabled:opacity-35"
      >
        {key}
      </button>
    );
  };

  const renderDifficultyPicker = () => (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
      <h2 className="text-xl sm:text-2xl font-black theme-text text-center">Chọn độ khó</h2>
      <p className="text-xs theme-muted text-center">
        Hai người chơi lần lượt trả lời cùng một câu hỏi. Ai nhanh và chính xác hơn sẽ thắng.
      </p>
      <div className="w-full flex flex-col gap-2.5">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
          <button
            key={level}
            onClick={() => {
              playMoveSound();
              dispatch({ type: 'START', difficulty: level });
            }}
            className="w-full rounded-2xl border theme-border px-4 py-3 flex items-center justify-between transition active:translate-y-[2px]"
            style={{ background: 'var(--surface-soft)' }}
          >
            <span className="text-left">
              <span className="block text-sm font-black theme-text">{DIFFICULTY_LABEL[level]}</span>
              <span className="block text-[11px] theme-muted">
                {level === 'easy'
                  ? 'Cộng, trừ trong phạm vi 50'
                  : level === 'medium'
                    ? 'Cộng, trừ và nhân bảng 12'
                    : 'Chia hết và thứ tự phép tính'}
              </span>
            </span>
            <span className="text-[11px] font-bold theme-text px-2 py-1 rounded-lg border theme-border">
              {QUESTION_COUNT[level]} câu
            </span>
          </button>
        ))}
      </div>
      <p className="text-[11px] theme-muted text-center">
        Ghi bàn: 10 điểm, mỗi giây trừ 1 điểm (tối thiểu 2). Sai đáp án hoặc hết giờ là 0 điểm.
      </p>
    </div>
  );

  const renderPlay = () => (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
      <div className="w-full flex items-stretch gap-2">
        <div
          className="flex-1 rounded-2xl border px-3 py-2"
          style={{
            background: state.activePlayer === 0 ? P1_COLOR : 'var(--surface-strong)',
            borderColor: state.activePlayer === 0 ? P1_COLOR : 'var(--border-color)',
          }}
        >
          <span
            className="block text-[10px] uppercase font-bold tracking-wide"
            style={{ color: state.activePlayer === 0 ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
          >
            Người chơi 1
          </span>
          <span
            className="block text-xl sm:text-2xl font-black"
            style={{ color: state.activePlayer === 0 ? '#ffffff' : 'var(--text-primary)' }}
          >
            {playerOne}
          </span>
        </div>
        <div
          className="flex-1 rounded-2xl border px-3 py-2"
          style={{
            background: state.activePlayer === 1 ? P2_COLOR : 'var(--surface-strong)',
            borderColor: state.activePlayer === 1 ? P2_COLOR : 'var(--border-color)',
          }}
        >
          <span
            className="block text-[10px] uppercase font-bold tracking-wide text-right"
            style={{ color: state.activePlayer === 1 ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
          >
            Người chơi 2
          </span>
          <span
            className="block text-xl sm:text-2xl font-black text-right"
            style={{ color: state.activePlayer === 1 ? '#ffffff' : 'var(--text-primary)' }}
          >
            {playerTwo}
          </span>
        </div>
      </div>

      <div className="w-full flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const mark = state.marks[i];
          const isActive = i === state.index;
          const fill = mark === 1 ? P1_COLOR : mark === 2 ? P2_COLOR : 'var(--surface-soft)';
          const border = mark === 1 ? P1_COLOR : mark === 2 ? P2_COLOR : 'var(--border-color)';
          return (
            <div
              key={i}
              className="flex-1 h-2.5 rounded-sm"
              style={{
                background: fill,
                border: isActive ? `2px solid ${accent}` : `1px solid ${border}`,
              }}
            />
          );
        })}
      </div>

      {currentQuestion && (
        <div className="w-full rounded-3xl border theme-border px-4 py-5 sm:py-7 flex flex-col items-center gap-4" style={{ background: 'var(--game-surface-bg)' }}>
          <div className="flex items-center gap-2 text-[11px] font-bold theme-muted">
            <Timer className="w-3.5 h-3.5" />
            <span>{Math.ceil(state.timeLeft)}s / {TIME_LIMIT}s</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--surface-strong)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${ratio * 100}%`,
                background: ratio > 0.33 ? accent : '#dc2626',
              }}
            />
          </div>

          <div className="text-center">
            {phase === 'feedback' && state.feedback ? (
              <span className="block text-[10px] uppercase font-bold tracking-wider theme-muted">
                {`Người chơi ${state.feedback.player + 1} đã trả lời`}
              </span>
            ) : (
              <span className="block text-[10px] uppercase font-bold tracking-wider theme-muted">
                {`Người chơi ${state.activePlayer + 1} đang trả lời`}
              </span>
            )}
            <span
              className="block text-4xl sm:text-6xl font-black tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {currentQuestion.text}
            </span>
          </div>

          {phase === 'turn' && (
            <div
              className="w-full rounded-2xl px-4 py-2.5 text-center text-2xl sm:text-3xl font-black text-white"
              style={{ background: accent }}
            >
              {state.input.length === 0 ? '?' : state.input}
            </div>
          )}

          {phase === 'turn' && (
            <span className="text-xs font-bold" style={{ color: accent }}>
              {`Lượt của Người chơi ${state.activePlayer + 1} — nhập đáp án rồi bấm Xác nhận`}
            </span>
          )}

          {phase === 'feedback' && state.feedback && (
            <div className="text-center space-y-1">
              <div
                className="text-base sm:text-lg font-black"
                style={{ color: state.feedback.correct ? '#16a34a' : '#dc2626' }}
              >
                {state.feedback.correct
                  ? `Chính xác! +${state.feedback.points} điểm`
                  : state.feedback.timedOut
                    ? 'Hết giờ! Đáp án là ' + state.feedback.answer
                    : `Sai rồi! Đáp án là ${state.feedback.answer}`}
              </div>
              <div className="text-xs theme-muted">
                {`Người chơi ${state.feedback.player + 1} — chuẩn bị lượt tiếp theo...`}
              </div>
            </div>
          )}

          {phase === 'turn' && (
            <div className="w-full grid grid-cols-3 gap-2">{keys.map(renderKey)}</div>
          )}
        </div>
      )}

      {phase === 'turn' && (
        <p className="text-[11px] theme-muted text-center">
          Bàn phím: gõ số để nhập, Backspace để xoá, Enter để xác nhận.
        </p>
      )}

      {phase === 'done' && (
        <div className="w-full rounded-3xl border theme-border px-4 py-6 flex flex-col items-center gap-2" style={{ background: 'var(--game-surface-bg)' }}>
          <Trophy className="w-7 h-7 text-amber-400" />
          <span className="text-sm font-black theme-text">
            {playerOne === playerTwo ? 'Hai bên hòa điểm!' : `Người chơi ${playerOne > playerTwo ? 1 : 2} chiến thắng!`}
          </span>
          <span className="text-xs theme-muted">
            {`Chính xác ${state.correctCount}/${state.attemptCount} lượt — ${accuracy}%`}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <GameShell
      game={getGameById('math-duel')!}
      score={score}
      isGameOver={ended}
      isVictory={won}
      isDraw={ended && drew}
      isPaused={false}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        difficulty && total > 0 ? (
          <span className="px-3 py-1 rounded-xl border theme-border text-[11px] font-bold theme-text" style={{ background: 'var(--surface-strong)' }}>
            {`Câu ${Math.min(state.index + 1, total)}/${total} • ${DIFFICULTY_LABEL[tierForRound(difficulty, state.index, total)]} • ${accuracy}%`}
          </span>
        ) : null
      }
    >
      {phase === 'select' ? renderDifficultyPicker() : renderPlay()}
    </GameShell>
  );
};