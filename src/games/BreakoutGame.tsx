import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playBounceSound, playScoreSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { Heart, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  createParticleSystem,
  createShake,
  createStarfield,
  drawStarfield,
  drawVignette,
  isLightTheme,
  linearGradient,
} from '../utils/gameArt';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 440;
const PADDLE_WIDTH = 84;
const PADDLE_HEIGHT = 12;
const BALL_RADIUS = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_HEIGHT = 16;
const BRICK_PADDING = 5;
const BRICK_OFFSET_TOP = 40;
const BRICK_OFFSET_LEFT = 20;

const ROW_COLORS = [
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
];

interface Brick {
  x: number;
  y: number;
  status: number; // 1 = active, 0 = destroyed
  color: string;
  points: number;
}

interface BreakoutGameProps {
  onBackToHub: () => void;
}

export const BreakoutGame: React.FC<BreakoutGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('breakout')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const stateRef = useRef({
    paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT - 60,
    ballVx: 3.5,
    ballVy: -3.5,
    bricks: [] as Brick[][],
    keyLeft: false,
    keyRight: false,
    trail: [] as { x: number; y: number }[],
  });

  const particlesRef = useRef<ReturnType<typeof createParticleSystem> | null>(null);
  const shakeRef = useRef<ReturnType<typeof createShake> | null>(null);
  if (!particlesRef.current) particlesRef.current = createParticleSystem(240);
  if (!shakeRef.current) shakeRef.current = createShake();

  const initBricks = useCallback(() => {
    const brickWidth =
      (CANVAS_WIDTH - BRICK_OFFSET_LEFT * 2 - (BRICK_COLS - 1) * BRICK_PADDING) /
      BRICK_COLS;

    const bList: Brick[][] = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      bList[r] = [];
      for (let c = 0; c < BRICK_COLS; c++) {
        const x = BRICK_OFFSET_LEFT + c * (brickWidth + BRICK_PADDING);
        const y = BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING);
        bList[r][c] = {
          x,
          y,
          status: 1,
          color: ROW_COLORS[r % ROW_COLORS.length],
          points: (BRICK_ROWS - r) * 10,
        };
      }
    }
    stateRef.current.bricks = bList;
  }, []);

  const resetBallAndPaddle = () => {
    const s = stateRef.current;
    s.paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
    s.ballX = CANVAS_WIDTH / 2;
    s.ballY = CANVAS_HEIGHT - 60;
    const speed = 3.5 + (level - 1) * 0.5;
    s.ballVx = (Math.random() > 0.5 ? 1 : -1) * speed;
    s.ballVy = -speed;
    s.trail.length = 0;
  };

  const resetGame = useCallback(() => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setIsGameOver(false);
    setIsVictory(false);
    setIsPaused(false);
    particlesRef.current?.clear();
    shakeRef.current?.reset();
    initBricks();
    resetBallAndPaddle();
  }, [initBricks, level]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        stateRef.current.keyLeft = true;
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        stateRef.current.keyRight = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        stateRef.current.keyLeft = false;
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        stateRef.current.keyRight = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handlePointerMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const canvasX = (clientX - rect.left) * scaleX;
    stateRef.current.paddleX = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, canvasX - PADDLE_WIDTH / 2)
    );
  };

  // Main animation frame loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    initBricks();
    resetBallAndPaddle();

    const particles = particlesRef.current!;
    const shake = shakeRef.current!;
    const stars = createStarfield(CANVAS_WIDTH, CANVAS_HEIGHT, 52, 0.4, 1.4);

    // Rainbow hue per brick row keeps the wall readable and a bit arcade-y.
    const rowHue = ROW_COLORS.map(c => {
      const m = /^#(..)(..)(..)$/.exec(c);
      if (!m) return 0;
      const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return h;
    });

    const loop = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min((now - loop.last) / 1000, 0.05);
      loop.last = now;
      // Motion was authored per-frame; scale it by real elapsed time.
      const step = dt * 60;

      if (!isGameOver && !isPaused && !isVictory) {
        // Paddle movement with keyboard
        if (s.keyLeft) {
          s.paddleX = Math.max(0, s.paddleX - 6 * step);
        }
        if (s.keyRight) {
          s.paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, s.paddleX + 6 * step);
        }

        // Ball movement
        s.ballX += s.ballVx * step;
        s.ballY += s.ballVy * step;

        s.trail.push({ x: s.ballX, y: s.ballY });
        if (s.trail.length > 12) s.trail.shift();

        // Side wall collisions
        if (s.ballX + BALL_RADIUS > CANVAS_WIDTH || s.ballX - BALL_RADIUS < 0) {
          s.ballVx = -s.ballVx;
          playBounceSound();
        }

        // Top wall collision
        if (s.ballY - BALL_RADIUS < 0) {
          s.ballVy = -s.ballVy;
          playBounceSound();
        }

        // Paddle collision
        const paddleY = CANVAS_HEIGHT - 35;
        if (
          s.ballY + BALL_RADIUS >= paddleY &&
          s.ballY - BALL_RADIUS <= paddleY + PADDLE_HEIGHT &&
          s.ballX >= s.paddleX &&
          s.ballX <= s.paddleX + PADDLE_WIDTH &&
          s.ballVy > 0
        ) {
          // Angle depends on where ball hits paddle (-1 to 1)
          const hitPos = (s.ballX - (s.paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2);
          const currentSpeed = Math.sqrt(s.ballVx * s.ballVx + s.ballVy * s.ballVy);
          s.ballVx = hitPos * currentSpeed * 0.9;
          s.ballVy = -Math.abs(currentSpeed * Math.cos(hitPos * 0.8));
          s.trail.length = 0;
          playBounceSound();
          triggerHaptic(15);
        }

        // Brick collision
        const brickWidth =
          (CANVAS_WIDTH - BRICK_OFFSET_LEFT * 2 - (BRICK_COLS - 1) * BRICK_PADDING) /
          BRICK_COLS;

        let activeBricksLeft = 0;

        for (let r = 0; r < BRICK_ROWS; r++) {
          for (let c = 0; c < BRICK_COLS; c++) {
            const b = s.bricks[r][c];
            if (b.status === 1) {
              activeBricksLeft++;
              if (
                s.ballX > b.x &&
                s.ballX < b.x + brickWidth &&
                s.ballY > b.y &&
                s.ballY < b.y + BRICK_HEIGHT
              ) {
                s.ballVy = -s.ballVy;
                b.status = 0;
                playScoreSound();
                triggerHaptic(20);
                particles.burst(
                  b.x + brickWidth / 2,
                  b.y + BRICK_HEIGHT / 2,
                  12,
                  rowHue[r % rowHue.length],
                  110
                );
                shake.hit(3.5);
                setScore(sc => sc + b.points);
                activeBricksLeft--;
              }
            }
          }
        }

        // Check level clear / victory
        if (activeBricksLeft === 0) {
          playClearSound();
          if (level < 3) {
            setLevel(lvl => lvl + 1);
            initBricks();
            resetBallAndPaddle();
          } else {
            setIsVictory(true);
            setIsGameOver(true);
          }
        }

        // Ball fell to bottom
        if (s.ballY + BALL_RADIUS > CANVAS_HEIGHT) {
          playGameOverSound();
          triggerHaptic(35);
          shake.hit(12);
          s.trail.length = 0;
          setLives(l => {
            const nextL = l - 1;
            if (nextL <= 0) {
              setIsGameOver(true);
            } else {
              resetBallAndPaddle();
            }
            return nextL;
          });
        }
      }

      particles.update(dt);
      shake.update(dt);

      const time = now / 1000;
      const light = isLightTheme();
      ctx.save();
      shake.apply(ctx);

      // Backdrop
      if (light) {
        ctx.fillStyle = '#eef7ff';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        ctx.fillStyle = '#080b16';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawStarfield(ctx, stars, time, { alpha: 0.45 });
      }

      // Play field frame
      ctx.strokeStyle = light ? 'rgba(56,189,248,0.45)' : 'rgba(129, 140, 248, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12, 14);
      ctx.stroke();

      // Draw Bricks
      const brickWidth =
        (CANVAS_WIDTH - BRICK_OFFSET_LEFT * 2 - (BRICK_COLS - 1) * BRICK_PADDING) /
        BRICK_COLS;

      for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const b = s.bricks[r]?.[c];
          if (!b || b.status !== 1) continue;
          ctx.save();
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, brickWidth, BRICK_HEIGHT, 4);
          ctx.fill();
          ctx.restore();
        }
      }

      particles.draw(ctx);

      // Draw Paddle
      const paddleY = CANVAS_HEIGHT - 35;
      ctx.save();
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.roundRect(s.paddleX, paddleY, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
      ctx.fill();
      ctx.restore();

      // Draw Ball
      ctx.save();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
      drawVignette(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, light ? 0.06 : 0.42);

      animId = requestAnimationFrame(loop);
    };

    loop.last = performance.now();
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [initBricks, isGameOver, isPaused, isVictory, level]);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={isVictory}
      gameCustomStats={
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            {Array(3).fill(null).map((_, i) => (
              <Heart
                key={i}
 className={`w-3.5 h-3.5 ${
                  i < lives ? 'text-rose-500 fill-rose-500' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs text-indigo-400 font-bold">
            Màn {level}/3
          </div>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto">
 <div className="relative rounded-3xl p-2.5 bg-slate-900 border border-slate-800 overflow-hidden w-full max-w-[500px]">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onTouchMove={(e) => {
              if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX);
            }}
 className="w-full aspect-[48/44] block rounded-2xl game-touch-zone cursor-ew-resize "
          />
        </div>

        {/* Mobile On-Screen Buttons */}
 <div className="mt-4 flex items-center justify-center gap-6 md:hidden w-full">
          <button
            onTouchStart={() => (stateRef.current.keyLeft = true)}
            onTouchEnd={() => (stateRef.current.keyLeft = false)}
 className="w-20 h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
 <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onTouchStart={() => (stateRef.current.keyRight = true)}
            onTouchEnd={() => (stateRef.current.keyRight = false)}
 className="w-20 h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </GameShell>
  );
};
