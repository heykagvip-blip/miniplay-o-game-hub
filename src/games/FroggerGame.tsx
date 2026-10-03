import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playGameOverSound,
  playJumpSound,
  playClearSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';
import { Heart, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

const COLS = 11;
const ROWS = 10;
const CELL = 40;
const W = COLS * CELL;
const H = ROWS * CELL;
const LANES = 8; // rows 1..8 are road lanes; row 0 = goal, row 9 = start

const START_ROW = ROWS - 1;
const GOAL_ROW = 0;
const FROG_SIZE = 26;
const CAR_WIDTH = 48;
const CAR_HEIGHT = 24;
const CAR_Y_OFFSET = (CELL - CAR_HEIGHT) / 2;
const INVULNERABLE_TIME = 1.9;
const HOP_TIME = 0.16;
const WRAP_MIN = -80;
const WRAP_PERIOD = W + 160;
const FORWARD_STEP_SCORE = 10;
const GOAL_SCORE = 100;
const INITIAL_LIVES = 4;
const MAX_LIVES = 4;

// --- Difficulty tuning (gentle: capped traffic speed, wider gaps, roomier pads) ---
const LANE_SPEED_BASE = 58;
const LANE_SPEED_PER_STAGE = 9;
const LANE_SPEED_PER_LANE = 4;
const LANE_SPEED_MAX = 118;
const CAR_GAP_BASE = 190;
const CAR_GAP_RANDOM = 110;

const PAD_COLS = [1, 3, 5, 7, 9];
const PAD_CENTERS = PAD_COLS.map((col) => CELL / 2 + col * CELL);
const PAD_TOLERANCE = 25;

const LANE_COLORS = [
  '#f43f5e',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#38bdf8',
];

const ROAD_TOP = '#222c3d';
const ROAD_BOTTOM = '#151d2c';
const CURB = '#3f4c63';
const GRASS_DARK = '#14532d';
const GRASS_LIGHT = '#166534';
const WATER_TOP = '#0c4a6e';
const WATER_BOTTOM = '#082f49';

interface Car { x: number; }
interface Lane { dir: number; speed: number; cars: Car[]; }
interface Ripple { x: number; y: number; r: number; maxR: number; life: number; maxLife: number; }

interface Player {
  x: number;
  row: number;
  fromX: number;
  fromRow: number;
  dirY: number;
  drawX: number;
  drawY: number;
}

const makePlayer = (): Player => ({
  x: W / 2,
  row: START_ROW,
  fromX: W / 2,
  fromRow: START_ROW,
  dirY: 0,
  drawX: W / 2,
  drawY: START_ROW * CELL + CELL / 2,
});

const HopButton: React.FC<{
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ label, onPress, children }) => (
  <button
    type="button"
    aria-label={label}
    onPointerDown={(e) => {
      e.preventDefault();
      onPress();
    }}
    className="h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white select-none game-btn-press"
  >
    {children}
  </button>
);

export const FroggerGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('frogger')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [stage, setStage] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const player = useRef<Player>(makePlayer());
  const lanes = useRef<Lane[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(INITIAL_LIVES);
  const stageRef = useRef(1);
  const inv = useRef(0);
  const hop = useRef(0);
  const furthestRow = useRef(START_ROW);

  const buildLanes = useCallback((stg: number) => {
    const list: Lane[] = [];
    for (let r = 0; r < LANES; r++) {
      const dir = r % 2 === 0 ? 1 : -1;
      const speed = Math.min(LANE_SPEED_MAX, LANE_SPEED_BASE + stg * LANE_SPEED_PER_STAGE + r * LANE_SPEED_PER_LANE);
      const gap = CAR_GAP_BASE + Math.random() * CAR_GAP_RANDOM;
      const cars: Car[] = [];
      let x = Math.random() * gap;
      while (x < W + 80) {
        cars.push({ x });
        x += gap;
      }
      list.push({ dir, speed, cars });
    }
    lanes.current = list;
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = INITIAL_LIVES;
    stageRef.current = 1;
    setScore(0);
    setLives(INITIAL_LIVES);
    setStage(1);
    setIsGameOver(false);
    setIsPaused(false);
    player.current = makePlayer();
    inv.current = 0;
    hop.current = 0;
    ripples.current = [];
    furthestRow.current = START_ROW;
    buildLanes(1);
  }, [buildLanes]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const respawn = useCallback(() => {
    player.current = makePlayer();
    inv.current = INVULNERABLE_TIME;
    hop.current = 0;
    ripples.current = [];
    furthestRow.current = START_ROW;
  }, []);

  const handleHit = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    triggerHaptic(40);
    playGameOverSound();
    if (livesRef.current <= 0) setIsGameOver(true);
    else respawn();
  }, [respawn]);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (isGameOver || isPaused) return;
      const p = player.current;
      const nextRow = Math.max(GOAL_ROW, Math.min(START_ROW, p.row + dy));
      const nextX = Math.max(CELL / 2, Math.min(W - CELL / 2, p.x + dx * CELL));
      if (nextRow === p.row && nextX === p.x) return;

      p.fromX = p.x;
      p.fromRow = p.row;
      p.dirY = dy;
      p.row = nextRow;
      p.x = nextX;
      hop.current = HOP_TIME;
      playJumpSound();
      triggerHaptic(10);

      if (p.row < furthestRow.current) {
        furthestRow.current = p.row;
        scoreRef.current += FORWARD_STEP_SCORE;
        setScore(scoreRef.current);
        playScoreSound();
      }

      if (p.row === GOAL_ROW) {
        ripples.current.push({
          x: p.x,
          y: GOAL_ROW * CELL + CELL / 2,
          r: 4,
          maxR: 26,
          life: 0.6,
          maxLife: 0.6,
        });
        const landedOnPad = PAD_CENTERS.some((cx) => Math.abs(p.x - cx) <= PAD_TOLERANCE);
        if (!landedOnPad) {
          handleHit();
          return;
        }
        scoreRef.current += GOAL_SCORE;
        setScore(scoreRef.current);
        playClearSound();
        triggerHaptic(30);
        stageRef.current += 1;
        setStage(stageRef.current);
        buildLanes(stageRef.current);
        respawn();
      }
    },
    [isGameOver, isPaused, respawn, buildLanes, handleHit]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); move(0, -1); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); move(0, 1); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); move(-1, 0); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); move(1, 0); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [move]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let last = performance.now();

    // Grass tufts on both banks, generated once for a textured look.
    const tufts = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      row: Math.random() > 0.5 ? GOAL_ROW : START_ROW,
      len: 3 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
    }));
    const lilyFlowers = Array.from({ length: 14 }, () => ({
      x: Math.random() * W,
      phase: Math.random() * Math.PI * 2,
      hue: [330, 45, 285, 200][Math.floor(Math.random() * 4)],
    }));

    const update = (dt: number) => {
      lanes.current.forEach((lane) => {
        lane.cars.forEach((car) => {
          car.x += lane.dir * lane.speed * dt;
          if (car.x > WRAP_MIN + WRAP_PERIOD) car.x -= WRAP_PERIOD;
          if (car.x < WRAP_MIN) car.x += WRAP_PERIOD;
        });
      });

      if (inv.current > 0) inv.current -= dt;
      if (hop.current > 0) hop.current = Math.max(0, hop.current - dt);

// Resolve the rendered hop position once so collision matches what is drawn.
      const p = player.current;
      const k = hop.current / HOP_TIME;
      const ease = Math.sin((1 - k) * Math.PI * 0.5);
      p.drawX = p.fromX + (p.x - p.fromX) * ease;
      // Arc envelope tied to ease so it vanishes exactly as the frog reaches the
      // target cell, instead of overshooting the destination row.
      p.drawY =
        (p.fromRow + (p.row - p.fromRow) * ease) * CELL + CELL / 2 - 4 * ease * (1 - ease) * 9;

      ripples.current.forEach(rp => {
        rp.life -= dt;
        rp.r += (rp.maxR - rp.r) * Math.min(1, dt * 8);
      });
      ripples.current = ripples.current.filter(rp => rp.life > 0);

      if (p.row >= 1 && p.row <= LANES && inv.current <= 0) {
        const lane = lanes.current[p.row - 1];
        if (lane && lane.cars.some((car) => Math.abs(car.x - p.drawX) < (CAR_WIDTH + FROG_SIZE) / 2 - 6)) {
          handleHit();
        }
      }
    };

    const drawBank = (time: number) => {
      // Water band behind the lily pads
      const wg = ctx.createLinearGradient(0, 0, 0, CELL);
      wg.addColorStop(0, WATER_BOTTOM);
      wg.addColorStop(0.5, WATER_TOP);
      wg.addColorStop(1, WATER_BOTTOM);
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, CELL);

      ctx.strokeStyle = 'rgba(125, 211, 252, 0.16)';
      ctx.lineWidth = 1.4;
      for (let y = 6; y < CELL; y += 9) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) {
          const yy = y + Math.sin(x * 0.08 + time * 1.6 + y) * 1.8;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }

      lilyFlowers.forEach(f => {
        const cx = f.x;
        const cy = 6 + Math.sin(time * 0.9 + f.phase) * 1.2;
        ctx.fillStyle = `hsla(${f.hue}, 80%, 70%, 0.5)`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Goal bank
      const gg = ctx.createLinearGradient(0, 0, 0, CELL);
      gg.addColorStop(0, GRASS_DARK);
      gg.addColorStop(1, '#052e16');
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, W, CELL * 0.42);
      ctx.fillStyle = GRASS_LIGHT;
      ctx.fillRect(0, 0, W, 2);

      PAD_CENTERS.forEach((cx) => {
        const cy = CELL * 0.72;
        ctx.fillStyle = 'rgba(2, 44, 34, 0.75)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const pg = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 15);
        pg.addColorStop(0, '#4ade80');
        pg.addColorStop(1, '#15803d');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 15, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(134, 239, 172, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 11, 6, 0, Math.PI * 0.15, Math.PI * 0.95);
        ctx.stroke();
        // Little flower on the pad
        ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const drawRoad = () => {
      const rg = ctx.createLinearGradient(0, CELL, 0, CELL * (LANES + 1));
      rg.addColorStop(0, ROAD_TOP);
      rg.addColorStop(1, ROAD_BOTTOM);
      ctx.fillStyle = rg;
      ctx.fillRect(0, CELL, W, LANES * CELL);

      // Curbs top and bottom of the highway
      ctx.fillStyle = CURB;
      ctx.fillRect(0, CELL - 3, W, 3);
      ctx.fillRect(0, CELL * (LANES + 1), W, 3);

      // Lane dividers
      lanes.current.forEach((lane, r) => {
        const y = CELL * (r + 1);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.26)';
        for (let x = 4; x < W; x += 26) ctx.fillRect(x, y - 1, 13, 2);

        const cy = y + CELL / 2;
        const tipX = lane.dir > 0 ? W - 8 : 8;
        const backX = lane.dir > 0 ? W - 17 : 17;
        ctx.fillStyle = 'rgba(248, 250, 252, 0.24)';
        ctx.beginPath();
        ctx.moveTo(backX, cy - 8);
        ctx.lineTo(tipX, cy);
        ctx.lineTo(backX, cy + 8);
        ctx.closePath();
        ctx.fill();
      });
    };

    const drawStartBank = (time: number) => {
      const y0 = START_ROW * CELL;
      const sg = ctx.createLinearGradient(0, y0, 0, y0 + CELL);
      sg.addColorStop(0, GRASS_LIGHT);
      sg.addColorStop(1, GRASS_DARK);
      ctx.fillStyle = sg;
      ctx.fillRect(0, y0, W, CELL);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
      ctx.fillRect(0, y0, W, 3);

      tufts.forEach(t => {
        const baseY = t.row === GOAL_ROW ? CELL * 0.42 : y0 + CELL;
        const sway = Math.sin(time * 1.2 + t.phase) * 0.9;
        ctx.strokeStyle = 'rgba(134, 239, 172, 0.4)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(t.x, baseY);
        ctx.quadraticCurveTo(t.x + sway, baseY - t.len * 0.6, t.x + sway * 1.6, baseY - t.len);
        ctx.stroke();
      });
    };

    const drawCars = () => {
      lanes.current.forEach((lane, r) => {
        const y = (r + 1) * CELL + CAR_Y_OFFSET;
        const body = LANE_COLORS[r % LANE_COLORS.length];
        lane.cars.forEach((car) => {
          const x = car.x - CAR_WIDTH / 2;

          // Shadow
          ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
          ctx.beginPath();
          ctx.roundRect(x + 2, y + CAR_HEIGHT - 2, CAR_WIDTH, CAR_HEIGHT, 6);
          ctx.fill();

          // Wheels
          ctx.fillStyle = '#0b1220';
          const wheelY = lane.dir > 0 ? y + CAR_HEIGHT - 3 : y - 1;
          ctx.beginPath();
          ctx.roundRect(x + 7, wheelY, 9, 5, 2.4);
          ctx.roundRect(x + CAR_WIDTH - 16, wheelY, 9, 5, 2.4);
          ctx.fill();

          // Body with vertical gradient
          const bg = ctx.createLinearGradient(0, y, 0, y + CAR_HEIGHT);
          bg.addColorStop(0, body);
          bg.addColorStop(0.55, body);
          bg.addColorStop(1, 'rgba(15, 23, 42, 0.55)');
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.roundRect(x, y, CAR_WIDTH, CAR_HEIGHT, 6);
          ctx.fill();
          ctx.fillStyle = bg;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.roundRect(x, y, CAR_WIDTH, CAR_HEIGHT, 6);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Cabin / windshield
          ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
          const cabX = lane.dir > 0 ? x + 7 : x + CAR_WIDTH * 0.36;
          ctx.beginPath();
          ctx.roundRect(cabX, y + 5, CAR_WIDTH * 0.42, CAR_HEIGHT - 11, 3);
          ctx.fill();
          ctx.fillStyle = 'rgba(224, 242, 254, 0.3)';
          ctx.beginPath();
          ctx.roundRect(cabX + 2, y + 6.5, CAR_WIDTH * 0.42 - 4, 4, 2);
          ctx.fill();

          // Headlights + beam for the travel direction
          const frontX = lane.dir > 0 ? x + CAR_WIDTH - 7 : x + 3;
          ctx.fillStyle = '#fef9c3';
          ctx.beginPath();
          ctx.arc(frontX + 2, y + 5, 2.4, 0, Math.PI * 2);
          ctx.arc(frontX + 2, y + CAR_HEIGHT - 5, 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(254, 249, 195, 0.16)';
          ctx.beginPath();
          ctx.moveTo(frontX + 3, y + 1);
          ctx.lineTo(frontX + (lane.dir > 0 ? 22 : -22), y - 3);
          ctx.lineTo(frontX + (lane.dir > 0 ? 22 : -22), y + CAR_HEIGHT + 3);
          ctx.lineTo(frontX + 3, y + CAR_HEIGHT - 1);
          ctx.closePath();
          ctx.fill();

          // Tail lights
          const tailX = lane.dir > 0 ? x + 2 : x + CAR_WIDTH - 6;
          ctx.fillStyle = 'rgba(248, 113, 133, 0.85)';
          ctx.fillRect(tailX, y + 5, 3.4, 4);
          ctx.fillRect(tailX, y + CAR_HEIGHT - 9, 3.4, 4);
        });
      });
    };

    const drawRipples = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ripples.current.forEach(rp => {
        const a = Math.max(0, rp.life / rp.maxLife);
        ctx.strokeStyle = `rgba(186, 230, 253, ${(a * 0.7).toFixed(3)})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    };

    const drawFrog = (time: number) => {
      const p = player.current;
      const k = hop.current / HOP_TIME;

      if (inv.current > 0 && Math.floor(time / 0.1) % 2 === 0) return;

      const cx = p.drawX;
      const cy = p.drawY;
      const ease = Math.sin((1 - k) * Math.PI * 0.5);
      const squash = 1 + 4 * ease * (1 - ease) * 0.14;
      const legSwing = 4 * ease * (1 - ease);

      // Shadow
      ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + FROG_SIZE * 0.55, FROG_SIZE * 0.5, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(squash, 1 / squash);

      // Back legs
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.roundRect(-FROG_SIZE / 2 - 2, 2, 6, 10 - legSwing * 2, 3);
      ctx.roundRect(FROG_SIZE / 2 - 4, 2, 6, 10 - legSwing * 2, 3);
      ctx.fill();

      // Body with gradient
      const bg = ctx.createRadialGradient(-4, -6, 2, 0, 0, FROG_SIZE * 0.8);
      bg.addColorStop(0, '#86efac');
      bg.addColorStop(0.55, '#4ade80');
      bg.addColorStop(1, '#15803d');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(-FROG_SIZE / 2, -FROG_SIZE / 2, FROG_SIZE, FROG_SIZE, 8);
      ctx.fill();

      // Belly
      ctx.fillStyle = 'rgba(240, 253, 244, 0.35)';
      ctx.beginPath();
      ctx.roundRect(-FROG_SIZE / 2 + 3, -1, FROG_SIZE - 6, FROG_SIZE / 2 - 4, 5);
      ctx.fill();

      // Spots
      ctx.fillStyle = 'rgba(21, 128, 61, 0.45)';
      ctx.beginPath();
      ctx.arc(-6, -3, 2, 0, Math.PI * 2);
      ctx.arc(5, 1, 1.7, 0, Math.PI * 2);
      ctx.arc(0, 6, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'rgba(20, 83, 45, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-FROG_SIZE / 2, -FROG_SIZE / 2, FROG_SIZE, FROG_SIZE, 8);
      ctx.stroke();

      // Eyes
      const blink = Math.sin(time * 1.3) > 0.985;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(-6.5, -8, 4.4, 0, Math.PI * 2);
      ctx.arc(6.5, -8, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 83, 45, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-6.5, -8, 4.4, 0, Math.PI * 2);
      ctx.arc(6.5, -8, 4.4, 0, Math.PI * 2);
      ctx.stroke();
      if (!blink) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-6.5, -8.6, 2.1, 0, Math.PI * 2);
        ctx.arc(6.5, -8.6, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(-7.4, -9.5, 0.8, 0, Math.PI * 2);
        ctx.arc(5.6, -9.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-8.4, -8);
        ctx.lineTo(-4.6, -8);
        ctx.moveTo(4.6, -8);
        ctx.lineTo(8.4, -8);
        ctx.stroke();
      }

      // Mouth facing the direction of travel
      ctx.strokeStyle = 'rgba(20, 83, 45, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (p.dirY < 0) {
        ctx.arc(0, -9, 6, Math.PI * 0.2, Math.PI * 0.8);
      } else {
        ctx.arc(0, 9, 6, Math.PI * 1.2, Math.PI * 1.8);
      }
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      const time = performance.now() / 1000;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, W, H);
      drawBank(time);
      drawRoad();
      drawStartBank(time);
      drawCars();
      drawRipples();
      drawFrog(time);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!isGameOver && !isPaused) update(dt);
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isGameOver, isPaused, handleHit]);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused((p) => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
            {Array(MAX_LIVES).fill(null).map((_, i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${i < lives ? 'text-rose-500 fill-rose-500' : 'text-slate-700'}`}
              />
            ))}
          </div>
          <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs text-indigo-400 font-bold">
            Màn {stage}
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[520px] mx-auto">
        <div className="relative rounded-3xl p-2.5 bg-slate-900 border border-slate-800 shadow-2xl w-full shadow-emerald-950/40">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full block rounded-2xl game-touch-zone shadow-inner"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 w-full max-w-[220px] mx-auto md:hidden">
          <span />
          <HopButton label="Nhảy lên" onPress={() => move(0, -1)}>
            <ChevronUp className="w-5 h-5" />
          </HopButton>
          <span />
          <HopButton label="Sang trái" onPress={() => move(-1, 0)}>
            <ChevronLeft className="w-5 h-5" />
          </HopButton>
          <HopButton label="Nhảy xuống" onPress={() => move(0, 1)}>
            <ChevronDown className="w-5 h-5" />
          </HopButton>
          <HopButton label="Sang phải" onPress={() => move(1, 0)}>
            <ChevronRight className="w-5 h-5" />
          </HopButton>
        </div>
        <p className="mt-3 text-[11px] theme-muted text-center hidden md:block">
          ← → ↑ ↓ hoặc W A S D để nhảy • Tránh xe, băng qua 8 làn đường tới bờ bên kia
        </p>
      </div>
    </GameShell>
  );
};