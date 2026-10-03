import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  createParticleSystem,
  createRippleSystem,
  createShake,
  createStarfield,
  drawCheckerboard,
  drawStarfield,
  drawVignette,
  isLightTheme,
} from '../utils/gameArt';

const GRID_SIZE = 20;
const CANVAS = 400;
const INITIAL_SPEED = 140; // ms
const SPEED_STEP = 3;
const MIN_SPEED = 60;

const SNAKE_HEAD = '#34d399';
const SNAKE_BODY = '#10b981';
const APPLE = '#ef4444';
const APPLE_HI = '#fecaca';
const GOLD = '#facc15';
const GOLD_HI = '#fef9c3';

const DIR_VEC: Record<Direction, [number, number]> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface SnakeGameProps {
  onBackToHub: () => void;
}

const START_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

export const SnakeGame: React.FC<SnakeGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('snake')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [snake, setSnake] = useState<Point[]>(START_SNAKE);
  const [direction, setDirection] = useState<Direction>('UP');
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [goldenFood, setGoldenFood] = useState<Point | null>(null);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  const dirRef = useRef<Direction>('UP');
  const nextDirRef = useRef<Direction>('UP');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Ref mirrors so the render loop can animate between ticks.
  const snakeRef = useRef<Point[]>(START_SNAKE);
  const prevSnakeRef = useRef<Point[]>([]);
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const goldenRef = useRef<Point | null>(null);
  const tickAtRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);

  // Effects systems live at component level so game events can trigger them.
  const particlesRef = useRef<ReturnType<typeof createParticleSystem> | null>(null);
  const ripplesRef = useRef<ReturnType<typeof createRippleSystem> | null>(null);
  const shakeRef = useRef<ReturnType<typeof createShake> | null>(null);
  if (!particlesRef.current) particlesRef.current = createParticleSystem(240);
  if (!ripplesRef.current) ripplesRef.current = createRippleSystem(12);
  if (!shakeRef.current) shakeRef.current = createShake();

  // Spawn random food not on snake
  const getRandomPosition = useCallback((currentSnake: Point[]): Point => {
    let newPos: Point;
    let collision: boolean;
    do {
      newPos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      collision = currentSnake.some(seg => seg.x === newPos.x && seg.y === newPos.y);
    } while (collision);
    return newPos;
  }, []);

  const resetGame = useCallback(() => {
    setSnake(START_SNAKE);
    setDirection('UP');
    dirRef.current = 'UP';
    nextDirRef.current = 'UP';
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setIsGameOver(false);
    setIsPaused(false);
    setGoldenFood(null);
    setFood(getRandomPosition(START_SNAKE));
    particlesRef.current?.clear();
    ripplesRef.current?.clear();
    shakeRef.current?.reset();
  }, [getRandomPosition]);

  const changeDirection = useCallback((newDir: Direction) => {
    const current = dirRef.current;
    // Prevent 180 degree instant turn
    if (
      (newDir === 'UP' && current !== 'DOWN') ||
      (newDir === 'DOWN' && current !== 'UP') ||
      (newDir === 'LEFT' && current !== 'RIGHT') ||
      (newDir === 'RIGHT' && current !== 'LEFT')
    ) {
      nextDirRef.current = newDir;
      triggerHaptic(10);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        changeDirection('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        changeDirection('DOWN');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        changeDirection('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        changeDirection('RIGHT');
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  // Touch Swipe controls on canvas
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const threshold = 25; // minimum pixels for swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) changeDirection('RIGHT');
        else changeDirection('LEFT');
      }
    } else {
      if (Math.abs(diffY) > threshold) {
        if (diffY > 0) changeDirection('DOWN');
        else changeDirection('UP');
      }
    }
  };

  // Main game tick loop
  useEffect(() => {
    if (isGameOver || isPaused) return;

    const timer = setTimeout(() => {
      dirRef.current = nextDirRef.current;
      setDirection(nextDirRef.current);

      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        switch (dirRef.current) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        const die = (): Point[] => {
          shakeRef.current?.hit(14);
          particlesRef.current?.burst(head.x * (CANVAS / GRID_SIZE), head.y * (CANVAS / GRID_SIZE), 26, 155, 130);
          setIsGameOver(true);
          return prevSnake;
        };

        // Wall collision check
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          return die();
        }

        // Self collision check
        if (prevSnake.some((seg, idx) => idx !== 0 && seg.x === head.x && seg.y === head.y)) {
          return die();
        }

        const newSnake = [head, ...prevSnake];
        const cellPx = CANVAS / GRID_SIZE;

        // Eat standard food
        if (head.x === food.x && head.y === food.y) {
          playScoreSound();
          triggerHaptic(20);
          particlesRef.current?.burst(head.x * cellPx, head.y * cellPx, 16, 0, 90);
          ripplesRef.current?.add(head.x * cellPx, head.y * cellPx, 34, 'rgba(248, 113, 113, 0.85)');
          setScore(s => s + 10);
          setSpeed(sp => Math.max(MIN_SPEED, sp - SPEED_STEP));
          setFood(getRandomPosition(newSnake));

          // Chance to spawn golden apple
          if (Math.random() < 0.35 && !goldenFood) {
            setGoldenFood(getRandomPosition(newSnake));
          }
          return newSnake;
        }

        // Eat golden food
        if (goldenFood && head.x === goldenFood.x && head.y === goldenFood.y) {
          playClearSound();
          triggerHaptic(30);
          particlesRef.current?.burst(head.x * cellPx, head.y * cellPx, 34, 48, 130);
          ripplesRef.current?.add(head.x * cellPx, head.y * cellPx, 52, 'rgba(250, 204, 21, 0.9)');
          setScore(s => s + 50);
          setGoldenFood(null);
          return newSnake;
        }

        // Normal move (remove tail)
        newSnake.pop();
        return newSnake;
      });
    }, speed);

    return () => clearTimeout(timer);
  }, [snake, direction, food, goldenFood, isGameOver, isPaused, speed, getRandomPosition]);

  // Hand the frame timing over to the render loop on every state change.
  useEffect(() => {
    prevSnakeRef.current = snakeRef.current;
    snakeRef.current = snake;
    foodRef.current = food;
    goldenRef.current = goldenFood;
    speedRef.current = speed;
    tickAtRef.current = performance.now();
  }, [snake, food, goldenFood, speed]);

  // Animated canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = CANVAS / GRID_SIZE;
    const stars = createStarfield(CANVAS, CANVAS, 46, 0.4, 1.3);
    const particles = particlesRef.current!;
    const ripples = ripplesRef.current!;
    const shake = shakeRef.current!;

    let animId = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const drawFruit = (gx: number, gy: number, base: string, hi: string, glow: string, time: number) => {
      const x = gx * cell + cell / 2;
      const y = gy * cell + cell / 2;
      const r = cell * 0.34 * (1 + Math.sin(time * 4.5) * 0.05);
      ctx.save();
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.9);
      ctx.quadraticCurveTo(x + 2, y - r - 4, x + 5, y - r - 5);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(x + 6.5, y - r - 5, 3.6, 2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawHead = (cx: number, cy: number, s: number) => {
      const [dx, dy] = DIR_VEC[dirRef.current];
      // Perpendicular axis, so the two eyes sit correctly for any heading.
      const px = -dy;
      const py = dx;
      const flick = (Math.sin(performance.now() / 90) + 1) / 2;

      for (const side of [-1, 1]) {
        const ex = cx + px * side * s * 0.24;
        const ey = cy + py * side * s * 0.24;
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(ex, ey, s * 0.19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ex + dx * s * 0.09, ey + dy * s * 0.09, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Forked tongue flicking out from the nose
      if (flick > 0.55) {
        const tx = cx + dx * s * 0.5;
        const ty = cy + dy * s * 0.5;
        const len = s * (0.18 + flick * 0.24);
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + dx * len, ty + dy * len);
        ctx.moveTo(tx + dx * len, ty + dy * len);
        ctx.lineTo(tx + dx * len + px * len * 0.55, ty + dy * len + py * len * 0.55);
        ctx.moveTo(tx + dx * len, ty + dy * len);
        ctx.lineTo(tx + dx * len - px * len * 0.55, ty + dy * len - py * len * 0.55);
        ctx.stroke();
      }
    };

    const drawSnake = (t: number, time: number) => {
      const cur = snakeRef.current;
      const prev = prevSnakeRef.current;
      const breathe = 1 + Math.sin(time * 3) * 0.015;

      // Tail first so overlapping segments layer in the right order.
      for (let i = cur.length - 1; i >= 0; i--) {
        const to = cur[i];
        // Segment i slides in from the segment that used to precede it.
        const from = prev.length ? (prev[Math.max(0, i - 1)] ?? to) : to;
        const gx = lerp(from.x, to.x, t);
        const gy = lerp(from.y, to.y, t);
        const isHead = i === 0;

        const x = gx * cell + 1.6;
        const y = gy * cell + 1.6;
        const size = (cell - 3.2) * (isHead ? breathe : 1);

        ctx.save();
        ctx.fillStyle = isHead ? SNAKE_HEAD : SNAKE_BODY;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, isHead ? cell * 0.3 : cell * 0.24);
        ctx.fill();

        if (isHead) drawHead(x + size / 2, y + size / 2, size);
        ctx.restore();
      }
    };

    const draw = (time: number) => {
      const light = isLightTheme();
      const raw = (performance.now() - tickAtRef.current) / speedRef.current;
      const t = Math.max(0, Math.min(1, raw));
      const ease = t * t * (3 - 2 * t);

      ctx.save();
      shake.apply(ctx);

      if (light) {
        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(0, 0, CANVAS, CANVAS);
      } else {
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, CANVAS, CANVAS);
        drawStarfield(ctx, stars, time, { alpha: 0.5 });
      }

      drawCheckerboard(
        ctx,
        0,
        0,
        CANVAS,
        CANVAS,
        cell,
        light ? 'rgba(255,255,255,0.6)' : 'rgba(148, 197, 255, 0.035)',
        light ? 'rgba(224,242,254,0.6)' : 'rgba(148, 197, 255, 0.012)'
      );
      ctx.strokeStyle = light ? 'rgba(56,189,248,0.4)' : 'rgba(148, 197, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, CANVAS - 2, CANVAS - 2);

      drawFruit(foodRef.current.x, foodRef.current.y, APPLE, APPLE_HI, 'rgba(248, 113, 113, 0.9)', time);
      const gold = goldenRef.current;
      if (gold) drawFruit(gold.x, gold.y, GOLD, GOLD_HI, 'rgba(250, 204, 21, 0.95)', time);

      ripples.draw(ctx);
      drawSnake(ease, time);
      particles.draw(ctx);
      ctx.restore();
      drawVignette(ctx, CANVAS, CANVAS, light ? 0.08 : 0.4);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - (loop.last || now)) / 1000, 0.05);
      loop.last = now;
      ripples.update(dt);
      particles.update(dt);
      shake.update(dt);
      draw(now / 1000);
      animId = requestAnimationFrame(loop);
    };
    loop.last = 0;
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs hidden md:flex items-center gap-1.5 text-slate-400">
          <span>Độ dài:</span>
 <span className="font-bold text-emerald-400">{snake.length}</span>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Game Canvas Container */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
 className="relative p-2 rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden game-touch-zone "
        >
          <canvas
            ref={canvasRef}
            width={CANVAS}
            height={CANVAS}
 className="rounded-2xl w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] block "
          />

          {goldenFood && (
 <div className="absolute top-4 right-4 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span>⭐ Táo vàng +50!</span>
            </div>
          )}
        </div>

        {/* Intuitive On-Screen D-Pad (Touch & Pointer support) */}
 <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-[240px]">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              changeDirection('UP');
            }}
 className="w-16 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 flex items-center justify-center text-white game-btn-press select-none"
            aria-label="Lên"
          >
 <ArrowUp className="w-6 h-6" />
          </button>

 <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                changeDirection('LEFT');
              }}
 className="w-16 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 flex items-center justify-center text-white game-btn-press select-none"
              aria-label="Trái"
            >
 <ArrowLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                changeDirection('DOWN');
              }}
 className="w-16 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 flex items-center justify-center text-white game-btn-press select-none"
              aria-label="Xuống"
            >
 <ArrowDown className="w-6 h-6" />
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                changeDirection('RIGHT');
              }}
 className="w-16 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 border border-slate-700 flex items-center justify-center text-white game-btn-press select-none"
              aria-label="Phải"
            >
 <ArrowRight className="w-6 h-6" />
            </button>
          </div>

 <span className="text-[11px] text-slate-400 mt-1">
            D-pad cảm ứng hoặc vuốt trực tiếp trên bàn chơi
          </span>
        </div>
      </div>
    </GameShell>
  );
};