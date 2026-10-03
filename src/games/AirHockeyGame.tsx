import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playBounceSound, playMoveSound, playScoreSound, triggerHaptic } from '../utils/sound';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const W = 340;
const H = 480;
const WALL = 6;
const GOAL_W = 186;
const GOAL_DEPTH = 24;
const MALLET_W = 54;
const MALLET_H = 18;
const MALLET_SPEED = 430;
const PUCK_R = 11;
const PUCK_SPEED = 430;
const MAX_BOUNCE = 1.05;
const WIN_SCORE = 7;
const CENTRE_X = W / 2;
const CENTRE_Y = H / 2;
const TOP_MALLET_Y = WALL;
const BOTTOM_MALLET_Y = H - WALL - MALLET_H;
const MIN_X = WALL + PUCK_R;
const MAX_X = W - WALL - PUCK_R;
const MIN_Y = TOP_MALLET_Y + MALLET_H + PUCK_R;
const MAX_Y = BOTTOM_MALLET_Y - PUCK_R;
const MALLET_MIN_X = WALL;
const MALLET_MAX_X = W - WALL - MALLET_W;

export interface AirHockeyDifficulty {
  id: 'easy' | 'medium' | 'hard';
  label: string;
  reaction: number;
  speed: number;
  retreat: number;
  accel: number;
  error: number;
  centre: number;
}

export const AIR_HOCKEY_DIFFICULTIES: AirHockeyDifficulty[] = [
  { id: 'easy', label: 'Dễ', reaction: 0.3, speed: 215, retreat: 0.8, accel: 900, error: 78, centre: 0.1 },
  { id: 'medium', label: 'Trung bình', reaction: 0.18, speed: 285, retreat: 0.62, accel: 1250, error: 50, centre: 0.45 },
  { id: 'hard', label: 'Khó', reaction: 0.08, speed: 360, retreat: 0.46, accel: 1600, error: 43, centre: 0.85 },
];

export interface PuckBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface AiBrain {
  timer: number;
  targetX: number;
  bias: number;
  biasTimer: number;
  err: number;
  vx: number;
  sx: number;
  sy: number;
  svx: number;
  svy: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const predictInterceptX = (puck: PuckBody, lineY: number): number => {
  if (Math.abs(puck.vy) < 0.0001) return puck.x;
  const t = (lineY - puck.y) / puck.vy;
  if (t <= 0) return puck.x;
  const span = MAX_X - MIN_X;
  if (span <= 0) return puck.x;
  const period = span * 2;
  const rel = (((puck.x + puck.vx * t - MIN_X) % period) + period) % period;
  return rel <= span ? MIN_X + rel : MIN_X + period - rel;
};

export const hitMallet = (puck: PuckBody, mx: number, my: number, dir: number): boolean => {
  if (puck.x < mx || puck.x > mx + MALLET_W) return false;
  const face = dir === -1 ? my : my + MALLET_H;
  const reaching = dir === -1 ? puck.y + PUCK_R >= face : puck.y - PUCK_R <= face;
  if (!reaching) return false;
  if (dir === -1) puck.y = face - PUCK_R;
  else puck.y = face + PUCK_R;
  const approaching = dir === -1 ? puck.vy > 0 : puck.vy < 0;
  if (!approaching) return false;
  const offset = clamp((puck.x - (mx + MALLET_W / 2)) / (MALLET_W / 2), -1, 1);
  const angle = offset * MAX_BOUNCE;
  puck.vx = Math.sin(angle) * PUCK_SPEED;
  puck.vy = dir * Math.cos(angle) * PUCK_SPEED;
  return true;
};

export const stepAiPaddle = (
  brain: AiBrain,
  cfg: AirHockeyDifficulty,
  dt: number,
  puck: PuckBody,
  x: number
): number => {
  brain.timer -= dt;
  brain.biasTimer -= dt;
  if (brain.biasTimer <= 0) {
    brain.biasTimer = 0.9 + Math.random() * 0.7;
    brain.bias = (Math.random() * 2 - 1) * cfg.error;
  }
  if (brain.timer <= 0) {
    brain.timer = cfg.reaction;
    brain.err = (Math.random() * 2 - 1) * cfg.error * 0.18;
    brain.sx = puck.x;
    brain.sy = puck.y;
    brain.svx = puck.vx;
    brain.svy = puck.vy;
    const seen: PuckBody = { x: brain.sx, y: brain.sy, vx: brain.svx, vy: brain.svy };
    const intercept = predictInterceptX(seen, TOP_MALLET_Y + MALLET_H / 2 + PUCK_R + 1);
    const incoming = brain.svy < 0;
    const raw = incoming
      ? intercept + brain.bias + brain.err
      : CENTRE_X + (intercept - CENTRE_X) * (1 - cfg.centre);
    brain.targetX = clamp(raw, MALLET_MIN_X + MALLET_W / 2, MALLET_MAX_X + MALLET_W / 2);
  }
  const diff = brain.targetX - (x + MALLET_W / 2);
  const chasing = brain.svy < 0;
  const cap = cfg.speed * (chasing ? 1 : cfg.retreat);
  const wanted = clamp(diff * 7, -cap, cap);
  const dv = clamp(wanted - brain.vx, -cfg.accel * dt, cfg.accel * dt);
  brain.vx += dv;
  return clamp(x + brain.vx * dt, MALLET_MIN_X, MALLET_MAX_X);
};

export const AIR_HOCKEY_HEADLESS = {
  W,
  H,
  WALL,
  GOAL_W,
  MALLET_W,
  MALLET_H,
  PUCK_R,
  PUCK_SPEED,
  MAX_BOUNCE,
  CENTRE_X,
  CENTRE_Y,
  TOP_MALLET_Y,
  BOTTOM_MALLET_Y,
  MIN_X,
  MAX_X,
  MIN_Y,
  MAX_Y,
  predictInterceptX,
  hitMallet,
  stepAiPaddle,
  AIR_HOCKEY_DIFFICULTIES,
};

type Phase = 'ready' | 'countdown' | 'play' | 'goal' | 'over';

interface MatchState {
  puck: PuckBody;
  p1X: number;
  p2X: number;
  p1Score: number;
  p2Score: number;
  p1Blocks: number;
  phase: Phase;
  timer: number;
  countdown: number;
  flash: number;
  flashEnd: number;
  scorer: number;
  brain: AiBrain;
  left1: boolean;
  right1: boolean;
  left2: boolean;
  right2: boolean;
  paused: boolean;
  vsMachine: boolean;
  difficulty: AirHockeyDifficulty;
}

const servePuck = (s: MatchState, dir: number): void => {
  s.puck.x = CENTRE_X;
  s.puck.y = CENTRE_Y;
  const angle = (Math.random() - 0.5) * 0.55;
  s.puck.vx = Math.sin(angle) * PUCK_SPEED;
  s.puck.vy = dir * Math.cos(angle) * PUCK_SPEED;
  s.brain.timer = 0;
  s.brain.targetX = CENTRE_X;
  s.brain.err = 0;
  s.brain.bias = 0;
  s.brain.biasTimer = 0;
  s.brain.vx = 0;
  s.brain.sx = CENTRE_X;
  s.brain.sy = CENTRE_Y;
  s.brain.svx = s.puck.vx;
  s.brain.svy = s.puck.vy;
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
};

interface AirHockeyGameProps {
  onBackToHub: () => void;
}

export const AirHockeyGame: React.FC<AirHockeyGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('air-hockey')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [p1Blocks, setP1Blocks] = useState(0);
  const [vsMachine, setVsMachine] = useState(true);
  const [difficulty, setDifficulty] = useState<AirHockeyDifficulty>(AIR_HOCKEY_DIFFICULTIES[1]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const stateRef = useRef<MatchState>({
    puck: { x: CENTRE_X, y: CENTRE_Y, vx: 0, vy: -PUCK_SPEED },
    p1X: (W - MALLET_W) / 2,
    p2X: (W - MALLET_W) / 2,
    p1Score: 0,
    p2Score: 0,
    p1Blocks: 0,
    phase: 'ready',
    timer: 1.1,
    countdown: 3,
    flash: 0,
    flashEnd: 0,
    scorer: 0,
    brain: { timer: 0, targetX: CENTRE_X, bias: 0, biasTimer: 0, err: 0, vx: 0, sx: CENTRE_X, sy: CENTRE_Y, svx: 0, svy: -PUCK_SPEED },
    left1: false,
    right1: false,
    left2: false,
    right2: false,
    paused: false,
    vsMachine: true,
    difficulty: AIR_HOCKEY_DIFFICULTIES[1],
  });

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.p1Score = 0;
    s.p2Score = 0;
    s.p1Blocks = 0;
    s.phase = 'ready';
    s.timer = 1.1;
    s.countdown = 3;
    s.flash = 0;
    s.scorer = 0;
    s.left1 = false;
    s.right1 = false;
    s.left2 = false;
    s.right2 = false;
    s.p1X = (W - MALLET_W) / 2;
    s.p2X = (W - MALLET_W) / 2;
    servePuck(s, -1);
    setP1Score(0);
    setP2Score(0);
    setP1Blocks(0);
    setIsGameOver(false);
    setIsVictory(false);
    setIsPaused(false);
    s.paused = false;
  }, []);

  const applyMode = useCallback((machine: boolean) => {
    stateRef.current.vsMachine = machine;
    setVsMachine(machine);
    resetGame();
  }, [resetGame]);

  const applyDifficulty = useCallback((next: AirHockeyDifficulty) => {
    stateRef.current.difficulty = next;
    setDifficulty(next);
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    stateRef.current.paused = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const s = stateRef.current;
      switch (e.code) {
        case 'KeyA':
          s.left1 = true;
          break;
        case 'KeyD':
          s.right1 = true;
          break;
        case 'ArrowLeft':
          s.left2 = true;
          break;
        case 'ArrowRight':
          s.right2 = true;
          break;
        case 'Space':
          setIsPaused(p => !p);
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.code === 'KeyA') s.left1 = false;
      else if (e.code === 'KeyD') s.right1 = false;
      else if (e.code === 'ArrowLeft') s.left2 = false;
      else if (e.code === 'ArrowRight') s.right2 = false;
    };

    const onBlur = () => {
      const s = stateRef.current;
      s.left1 = false;
      s.right1 = false;
      s.left2 = false;
      s.right2 = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handlePointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const top = clientY - rect.top < rect.height / 2;
    if (top && s.vsMachine) return;
    const x = clamp((clientX - rect.left) * (W / rect.width) - MALLET_W / 2, MALLET_MIN_X, MALLET_MAX_X);
    if (top) s.p2X = x;
    else s.p1X = x;
  };

  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scoreGoal = (s: MatchState, forPlayer1: boolean) => {
      if (forPlayer1) {
        s.p1Score += 1;
        setP1Score(s.p1Score);
        playScoreSound();
        triggerHaptic(30);
      } else {
        s.p2Score += 1;
        setP2Score(s.p2Score);
        playBounceSound();
        triggerHaptic(30);
      }
      s.flash = 0.32;
      s.flashEnd = forPlayer1 ? 0 : 1;
      s.scorer = forPlayer1 ? 1 : 2;
      servePuck(s, forPlayer1 ? 1 : -1);
      if (s.p1Score >= WIN_SCORE || s.p2Score >= WIN_SCORE) {
        s.phase = 'over';
        setIsVictory(s.p1Score >= WIN_SCORE);
        setIsGameOver(true);
      } else {
        s.phase = 'goal';
        s.timer = 0.95;
      }
    };

    const containPuck = (s: MatchState, sound: boolean) => {
      const puck = s.puck;
      let bounced = false;
      const inMouth = Math.abs(puck.x - CENTRE_X) < GOAL_W / 2;
      if (puck.x < MIN_X) {
        puck.x = MIN_X;
        puck.vx = Math.abs(puck.vx);
        bounced = true;
      } else if (puck.x > MAX_X) {
        puck.x = MAX_X;
        puck.vx = -Math.abs(puck.vx);
        bounced = true;
      }
      if (!inMouth) {
        if (puck.y < MIN_Y) {
          puck.y = MIN_Y;
          puck.vy = Math.abs(puck.vy);
          bounced = true;
        } else if (puck.y > MAX_Y) {
          puck.y = MAX_Y;
          puck.vy = -Math.abs(puck.vy);
          bounced = true;
        }
      }
      if (bounced && sound) playBounceSound();
    };

    const step = (s: MatchState, dt: number) => {
      s.puck.x += s.puck.vx * dt;
      s.puck.y += s.puck.vy * dt;
      containPuck(s, true);

      if (s.puck.y + PUCK_R <= 0) {
        scoreGoal(s, true);
        return;
      }
      if (s.puck.y - PUCK_R >= H) {
        scoreGoal(s, false);
        return;
      }

      const p1Dir = (s.right1 ? 1 : 0) - (s.left1 ? 1 : 0);
      const p2Dir = (s.right2 ? 1 : 0) - (s.left2 ? 1 : 0);
      if (p1Dir !== 0) s.p1X = clamp(s.p1X + p1Dir * MALLET_SPEED * dt, MALLET_MIN_X, MALLET_MAX_X);
      if (s.vsMachine) {
        s.p2X = stepAiPaddle(s.brain, s.difficulty, dt, s.puck, s.p2X);
      } else if (p2Dir !== 0) {
        s.p2X = clamp(s.p2X + p2Dir * MALLET_SPEED * dt, MALLET_MIN_X, MALLET_MAX_X);
      }

      if (hitMallet(s.puck, s.p1X, BOTTOM_MALLET_Y, -1)) {
        s.p1Blocks += 1;
        setP1Blocks(s.p1Blocks);
        playMoveSound();
        triggerHaptic(14);
      }
      if (hitMallet(s.puck, s.p2X, TOP_MALLET_Y, 1)) {
        playBounceSound();
      }
      containPuck(s, true);
    };

    const draw = (s: MatchState) => {
      const isLight = document.documentElement.classList.contains('light');
      const railTop = isLight ? '#94a3b8' : '#111c36';
      const railFace = isLight ? '#cbd5e1' : '#25355c';
      const iceTop = isLight ? '#ffffff' : '#1e2f5c';
      const iceBot = isLight ? '#dbeafe' : '#0c1630';
      const mark = isLight ? 'rgba(30,64,175,0.32)' : 'rgba(191,219,254,0.34)';
      const puckColour = isLight ? '#0f172a' : '#f8fafc';
      const text = isLight ? '#0f172a' : '#f8fafc';
      const plate = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.86)';

      const mouthLeft = CENTRE_X - GOAL_W / 2;

      // ---- Mặt bàn băng ----
      const ice = ctx.createLinearGradient(0, 0, 0, H);
      ice.addColorStop(0, iceTop);
      ice.addColorStop(0.5, isLight ? '#f1f8ff' : '#18264a');
      ice.addColorStop(1, iceBot);
      ctx.fillStyle = ice;
      ctx.fillRect(0, 0, W, H);

      const sheen = ctx.createRadialGradient(CENTRE_X, CENTRE_Y, 20, CENTRE_X, CENTRE_Y, H * 0.66);
      sheen.addColorStop(0, isLight ? 'rgba(255,255,255,0.8)' : 'rgba(96,165,250,0.18)');
      sheen.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, W, H);

      // ---- Vạch sân hockey ----
      ctx.save();
      ctx.beginPath();
      ctx.rect(WALL, WALL, W - WALL * 2, H - WALL * 2);
      ctx.clip();
      ctx.strokeStyle = mark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CENTRE_X, CENTRE_Y, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(WALL, CENTRE_Y);
      ctx.lineTo(W - WALL, CENTRE_Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      [CENTRE_Y - 152, CENTRE_Y + 152].forEach(cy => {
        ctx.beginPath();
        ctx.arc(CENTRE_X, cy, 34, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(239,68,68,0.38)';
      ctx.beginPath();
      ctx.moveTo(WALL, 62);
      ctx.lineTo(W - WALL, 62);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(59,130,246,0.38)';
      ctx.beginPath();
      ctx.moveTo(WALL, H - 62);
      ctx.lineTo(W - WALL, H - 62);
      ctx.stroke();
      ctx.restore();

      // ---- Khung thành: lõm sâu + lưới + viền màu ----
      const drawGoal = (yTop: number, colour: string) => {
        const g = ctx.createLinearGradient(0, yTop, 0, yTop + GOAL_DEPTH);
        g.addColorStop(0, colour);
        g.addColorStop(1, 'rgba(2,6,23,0.9)');
        ctx.fillStyle = g;
        ctx.fillRect(mouthLeft, yTop, GOAL_W, GOAL_DEPTH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        for (let x = mouthLeft + 10; x < mouthLeft + GOAL_W; x += 12) {
          ctx.beginPath();
          ctx.moveTo(x, yTop + 2);
          ctx.lineTo(x, yTop + GOAL_DEPTH - 2);
          ctx.stroke();
        }
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.strokeRect(mouthLeft + 1, yTop + 1, GOAL_W - 2, GOAL_DEPTH - 2);
      };
      drawGoal(0, 'rgba(239,68,68,0.8)');
      drawGoal(H - GOAL_DEPTH, 'rgba(59,130,246,0.8)');

      // ---- Khoé sáng khi ghi bàn ----
      if (s.flash > 0) {
        const yTop = s.flashEnd === 0 ? 0 : H - GOAL_DEPTH;
        const flashG = ctx.createLinearGradient(0, yTop, 0, yTop + GOAL_DEPTH);
        flashG.addColorStop(0, 'rgba(255,255,255,0.95)');
        flashG.addColorStop(1, 'rgba(255,255,255,0.3)');
        ctx.fillStyle = flashG;
        ctx.fillRect(mouthLeft, yTop, GOAL_W, GOAL_DEPTH);
        ctx.globalAlpha = Math.min(1, s.flash);
        const halo = ctx.createRadialGradient(CENTRE_X, yTop + GOAL_DEPTH / 2, 10, CENTRE_X, yTop + GOAL_DEPTH / 2, GOAL_W);
        halo.addColorStop(0, 'rgba(255,255,255,0.45)');
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, yTop - GOAL_DEPTH, W, GOAL_DEPTH * 3);
        ctx.globalAlpha = 1;
      }

      // ---- Khung bàn có gờ sáng ----
      const railGrad = ctx.createLinearGradient(0, 0, 0, H);
      railGrad.addColorStop(0, railTop);
      railGrad.addColorStop(1, railFace);
      ctx.fillStyle = railGrad;
      ctx.fillRect(0, 0, mouthLeft, WALL);
      ctx.fillRect(mouthLeft + GOAL_W, 0, W - mouthLeft - GOAL_W, WALL);
      ctx.fillRect(0, H - WALL, mouthLeft, WALL);
      ctx.fillRect(mouthLeft + GOAL_W, H - WALL, W - mouthLeft - GOAL_W, WALL);
      ctx.fillRect(0, 0, WALL, H);
      ctx.fillRect(W - WALL, 0, WALL, H);
      ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(165,211,255,0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(WALL + 0.5, WALL + 0.5);
      ctx.lineTo(mouthLeft - 0.5, WALL + 0.5);
      ctx.moveTo(mouthLeft + GOAL_W + 0.5, WALL + 0.5);
      ctx.lineTo(W - WALL - 0.5, WALL + 0.5);
      ctx.moveTo(WALL + 0.5, H - WALL - 0.5);
      ctx.lineTo(mouthLeft - 0.5, H - WALL - 0.5);
      ctx.moveTo(mouthLeft + GOAL_W + 0.5, H - WALL - 0.5);
      ctx.lineTo(W - WALL - 0.5, H - WALL - 0.5);
      ctx.stroke();

      // ---- Vợt 3D ----
      const drawMallet = (x: number, y: number, top: string, bot: string, glow: string) => {
        ctx.fillStyle = 'rgba(2,6,23,0.3)';
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y + 3, MALLET_W, MALLET_H, 9);
        ctx.fill();
        const g = ctx.createLinearGradient(0, y, 0, y + MALLET_H);
        g.addColorStop(0, top);
        g.addColorStop(1, bot);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, MALLET_W, MALLET_H, 9);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 2, MALLET_W - 6, 3, 1.5);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.roundRect(x + MALLET_W / 2 - 10, y + 5, 20, MALLET_H - 10, 5);
        ctx.fill();
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(x + 0.7, y + 0.7, MALLET_W - 1.4, MALLET_H - 1.4, 9);
        ctx.stroke();
      };
      drawMallet(s.p1X, BOTTOM_MALLET_Y, '#7dd3fc', '#0369a1', 'rgba(56,189,248,0.75)');
      drawMallet(s.p2X, TOP_MALLET_Y, '#fda4af', '#be123c', 'rgba(244,63,94,0.75)');

      // ---- Đĩa bóng: quầng sáng + hình cầu ----
      if (Math.hypot(s.puck.vx, s.puck.vy) > 260) {
        const trail = ctx.createRadialGradient(s.puck.x, s.puck.y, PUCK_R * 0.4, s.puck.x, s.puck.y, PUCK_R * 2.6);
        trail.addColorStop(0, 'rgba(248,250,252,0.35)');
        trail.addColorStop(1, 'rgba(248,250,252,0)');
        ctx.fillStyle = trail;
        ctx.beginPath();
        ctx.arc(s.puck.x, s.puck.y, PUCK_R * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(2,6,23,0.35)';
      ctx.beginPath();
      ctx.arc(s.puck.x + 1, s.puck.y + 2, PUCK_R, 0, Math.PI * 2);
      ctx.fill();
      const pg = ctx.createRadialGradient(
        s.puck.x - PUCK_R * 0.35,
        s.puck.y - PUCK_R * 0.4,
        PUCK_R * 0.15,
        s.puck.x,
        s.puck.y,
        PUCK_R
      );
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.4, puckColour);
      pg.addColorStop(1, isLight ? '#1e293b' : '#94a3b8');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(s.puck.x, s.puck.y, PUCK_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const label =
        s.phase === 'ready'
          ? 'Sẵn sàng!'
          : s.phase === 'countdown'
            ? s.countdown > 0
              ? String(s.countdown)
              : 'Bắt đầu!'
            : s.phase === 'goal'
              ? s.scorer === 1
                ? 'Bạn ghi bàn!'
                : s.vsMachine
                  ? 'Máy ghi bàn!'
                  : 'Người 2 ghi bàn!'
              : '';
      if (label) {
        ctx.font = `800 ${label.length > 8 ? 22 : 38}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width + 34;
        const th = label.length > 8 ? 46 : 56;
        ctx.save();
        ctx.shadowColor = 'rgba(2,6,23,0.4)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 5;
        const banner = ctx.createLinearGradient(0, CENTRE_Y - th / 2, 0, CENTRE_Y + th / 2);
        banner.addColorStop(0, plate);
        banner.addColorStop(1, isLight ? 'rgba(219,234,254,0.92)' : 'rgba(2,6,23,0.94)');
        ctx.fillStyle = banner;
        ctx.beginPath();
        ctx.roundRect(CENTRE_X - tw / 2, CENTRE_Y - th / 2, tw, th, 16);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = isLight ? 'rgba(59,130,246,0.55)' : 'rgba(147,197,253,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(CENTRE_X - tw / 2, CENTRE_Y - th / 2, tw, th, 16);
        ctx.stroke();
        ctx.fillStyle = text;
        ctx.fillText(label, CENTRE_X, CENTRE_Y + 1);
      }
    };

    const loop = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min((now - loop.last) / 1000, 0.05);
      loop.last = now;
      s.flash = Math.max(0, s.flash - dt);

      if (!s.paused && s.phase !== 'over') {
        if (s.phase === 'play') {
          step(s, dt);
        } else {
          s.timer -= dt;
          if (s.timer <= 0) {
            if (s.phase === 'ready') {
              s.phase = 'countdown';
              s.countdown = 3;
              s.timer = 0.7;
            } else if (s.phase === 'countdown') {
              s.countdown -= 1;
              s.timer = 0.7;
              if (s.countdown < 0) s.phase = 'play';
            } else {
              s.phase = 'play';
            }
          }
        }
      }

      draw(s);
      animId = requestAnimationFrame(loop);
    };

    loop.last = performance.now();
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const shellScore = p1Score * 100 + p1Blocks;

  return (
    <GameShell
      game={gameMeta}
      score={shellScore}
      isGameOver={isGameOver}
      isVictory={isVictory}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2 text-[11px] font-bold theme-text">
          <span className="px-2 py-1 rounded-lg theme-panel-soft">{vsMachine ? 'Đối kháng máy' : '2 người chơi'}</span>
          {vsMachine && (
            <span className="px-2 py-1 rounded-lg theme-panel-soft">{difficulty.label}</span>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center w-full max-w-xl mx-auto">
        <div className="flex items-center justify-between w-full max-w-md px-4 sm:px-5 py-3 mb-3 rounded-3xl theme-panel-strong border theme-border shadow-lg">
          <div className="text-center min-w-[64px]">
            <span className="block text-[10px] font-bold uppercase tracking-wider theme-muted">Bạn</span>
            <span className="block text-5xl font-black leading-none text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]">
              {p1Score}
            </span>
          </div>
          <div className="flex-1 text-center px-3 border-l theme-border">
            <span className="block text-[10px] font-bold uppercase tracking-wider theme-muted">
              Tới {WIN_SCORE} thắng
            </span>
            <span className="block text-[11px] font-bold text-amber-400 mt-1">
              {vsMachine ? difficulty.label : 'Cùng thiết bị'}
            </span>
            <div className="mt-2 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-rose-400 transition-all duration-500"
                style={{ width: `${Math.min(100, ((p1Score + p2Score) / (WIN_SCORE * 2)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="text-center min-w-[64px]">
            <span className="block text-[10px] font-bold uppercase tracking-wider theme-muted">
              {vsMachine ? 'Máy' : 'Người 2'}
            </span>
            <span className="block text-5xl font-black leading-none text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.6)]">
              {p2Score}
            </span>
          </div>
        </div>

        <div className="w-full max-w-[380px] p-2 rounded-3xl theme-panel-strong border border-sky-400/20 shadow-[0_18px_40px_-24px_rgba(14,165,233,0.7)]">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={e => handlePointer(e.clientX, e.clientY)}
            onPointerMove={e => handlePointer(e.clientX, e.clientY)}
            className="w-full block rounded-2xl game-touch-zone cursor-ew-resize"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        <div className="flex items-center gap-2 mt-3 w-full max-w-[380px]">
          <button
            onClick={() => applyMode(true)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-black game-btn-press transition-colors ${
              vsMachine
                ? 'bg-indigo-600 border border-indigo-400 text-white'
                : 'theme-panel-soft theme-text border'
            }`}
          >
            Đối kháng máy
          </button>
          <button
            onClick={() => applyMode(false)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-black game-btn-press transition-colors ${
              vsMachine
                ? 'theme-panel-soft theme-text border'
                : 'bg-indigo-600 border border-indigo-400 text-white'
            }`}
          >
            2 người chơi
          </button>
        </div>

        {vsMachine && (
          <div className="flex items-center gap-2 mt-2 w-full max-w-[380px]">
            {AIR_HOCKEY_DIFFICULTIES.map(d => (
              <button
                key={d.id}
                onClick={() => applyDifficulty(d)}
                className={`flex-1 px-2 py-2 rounded-xl text-xs font-black game-btn-press transition-colors ${
                  difficulty.id === d.id
                    ? 'bg-amber-500 border border-amber-300 text-slate-900'
                    : 'theme-panel-soft theme-text border'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-stretch justify-between gap-3 mt-3 w-full max-w-[380px]">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] font-bold uppercase theme-muted">Bạn</span>
            <button
              onPointerDown={() => { stateRef.current.left1 = true; }}
              onPointerUp={() => { stateRef.current.left1 = false; }}
              onPointerLeave={() => { stateRef.current.left1 = false; }}
              className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-sky-500 flex items-center justify-center text-white game-btn-press"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onPointerDown={() => { stateRef.current.right1 = true; }}
              onPointerUp={() => { stateRef.current.right1 = false; }}
              onPointerLeave={() => { stateRef.current.right1 = false; }}
              className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-sky-500 flex items-center justify-center text-white game-btn-press"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          <div className={`flex items-center gap-2 flex-1 justify-end ${vsMachine ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              onPointerDown={() => { stateRef.current.left2 = true; }}
              onPointerUp={() => { stateRef.current.left2 = false; }}
              onPointerLeave={() => { stateRef.current.left2 = false; }}
              className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-rose-500 flex items-center justify-center text-white game-btn-press"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onPointerDown={() => { stateRef.current.right2 = true; }}
              onPointerUp={() => { stateRef.current.right2 = false; }}
              onPointerLeave={() => { stateRef.current.right2 = false; }}
              className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-rose-500 flex items-center justify-center text-white game-btn-press"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-bold uppercase theme-muted">{vsMachine ? 'Máy' : 'Ng2'}</span>
          </div>
        </div>

        <p className="mt-3 text-[11px] theme-muted text-center leading-relaxed">
          {vsMachine
            ? 'Kéo chuột hoặc dùng A / D để di chuyển vợt. Chặn lệch tâm để đẩy bóng chéo góc.'
            : 'Người 1 (dưới): A / D hoặc kéo chuột. Người 2 (trên): phím ← →. Nhấn Space để tạm dừng.'}
        </p>
      </div>
    </GameShell>
  );
};