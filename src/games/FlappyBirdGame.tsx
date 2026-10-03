import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playJumpSound, playScoreSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import {
  createParticleSystem,
  createShake,
  createStarfield,
  drawStarfield,
  drawVignette,
  isLightTheme,
} from '../utils/gameArt';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 560;
const BIRD_SIZE = 24;
const GRAVITY = 0.38;
const JUMP_FORCE = -7.2;
const PIPE_WIDTH = 58;
const PIPE_GAP = 140;
const PIPE_SPACING = 210;

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

interface FlappyBirdGameProps {
  onBackToHub: () => void;
}

export const FlappyBirdGame: React.FC<FlappyBirdGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('flappy-bird')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Status refs so the animation loop always reads latest values without resetting
  const isGameOverRef = useRef(false);
  const isPausedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const scoreRef = useRef(0);

  const stateRef = useRef({
    birdY: CANVAS_HEIGHT / 2 - 30,
    birdVelocity: 0,
    pipes: [] as Pipe[],
    pipeSpeed: 2.4,
    frame: 0,
  });

  const particlesRef = useRef<ReturnType<typeof createParticleSystem> | null>(null);
  const shakeRef = useRef<ReturnType<typeof createShake> | null>(null);
  const popsRef = useRef<{ x: number; y: number; t: number; label: string }[]>([]);
  if (!particlesRef.current) particlesRef.current = createParticleSystem(200);
  if (!shakeRef.current) shakeRef.current = createShake();

  const createInitialPipes = (): Pipe[] => [
    {
      x: CANVAS_WIDTH + 80,
      topHeight: 120 + Math.floor(Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 200)),
      passed: false,
    },
    {
      x: CANVAS_WIDTH + 80 + PIPE_SPACING,
      topHeight: 120 + Math.floor(Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 200)),
      passed: false,
    },
  ];

  const resetGame = useCallback(() => {
    stateRef.current = {
      birdY: CANVAS_HEIGHT / 2 - 30,
      birdVelocity: 0,
      pipes: createInitialPipes(),
      pipeSpeed: 2.4,
      frame: 0,
    };
    scoreRef.current = 0;
    isGameOverRef.current = false;
    isPausedRef.current = false;
    hasStartedRef.current = false;

    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setHasStarted(false);
  }, []);

  const flap = useCallback(() => {
    // If game is over, restart immediately on flap/space
    if (isGameOverRef.current) {
      resetGame();
      hasStartedRef.current = true;
      setHasStarted(true);
      stateRef.current.birdVelocity = JUMP_FORCE;
      playJumpSound();
      triggerHaptic(15);
      return;
    }

    if (isPausedRef.current) return;

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      setHasStarted(true);
    }

    stateRef.current.birdVelocity = JUMP_FORCE;
    particlesRef.current?.burst(CANVAS_WIDTH / 3 - 8, stateRef.current.birdY + 4, 6, 200, 70);
    playJumpSound();
    triggerHaptic(15);
  }, [resetGame]);

  // Global & window keyboard controls: Space, ArrowUp, KeyW
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (
        e.code === 'Space' ||
        e.key === ' ' ||
        e.key === 'Spacebar' ||
        e.code === 'ArrowUp' ||
        e.key === 'ArrowUp' ||
        e.code === 'KeyW' ||
        e.key === 'w' ||
        e.key === 'W'
      ) {
        e.preventDefault();
        e.stopPropagation();
        flap();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [flap]);

  // Keep refs in sync with props/state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Initialize once on mount
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Continuous animation loop (never re-creates on start/flap)
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = createStarfield(CANVAS_WIDTH, CANVAS_HEIGHT, 40, 0.5, 1.5);
    const clouds = [
      { x: 40, y: 90, r: 30, speed: 0.25 },
      { x: 200, y: 150, r: 22, speed: 0.45 },
      { x: 330, y: 66, r: 26, speed: 0.18 },
      { x: 120, y: 240, r: 18, speed: 0.6 },
      { x: 290, y: 280, r: 24, speed: 0.34 },
    ];

    const loop = (now: number) => {
      const s = stateRef.current;
      const started = hasStartedRef.current;
      const over = isGameOverRef.current;
      const paused = isPausedRef.current;
      const dt = Math.min((now - loop.last) / 1000, 0.05);
      loop.last = now;
      const time = now / 1000;
      const light = isLightTheme();

      if (started && !over && !paused) {
        s.frame++;

        // Apply vertical physics
        s.birdVelocity += GRAVITY;
        s.birdY += s.birdVelocity;

        const die = () => {
          isGameOverRef.current = true;
          setIsGameOver(true);
          playGameOverSound();
          triggerHaptic(50);
          shakeRef.current?.hit(15);
          particlesRef.current?.burst(CANVAS_WIDTH / 3, s.birdY, 30, 45, 150);
        };

        // Ground / ceiling collision
        if (s.birdY + BIRD_SIZE >= CANVAS_HEIGHT - 30) {
          s.birdY = CANVAS_HEIGHT - 30 - BIRD_SIZE;
          die();
        } else if (s.birdY - BIRD_SIZE <= 0) {
          s.birdY = BIRD_SIZE;
          s.birdVelocity = 0;
        }

        // Move pipes
        for (let i = 0; i < s.pipes.length; i++) {
          const pipe = s.pipes[i];
          pipe.x -= s.pipeSpeed;

          // Check score pass
          if (!pipe.passed && pipe.x + PIPE_WIDTH < CANVAS_WIDTH / 3) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
            playScoreSound();
            triggerHaptic(20);
            popsRef.current.push({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.3, t: 0, label: '+1' });

            if (scoreRef.current % 5 === 0) {
              s.pipeSpeed = Math.min(4.8, s.pipeSpeed + 0.18);
            }
          }

          // Check collision with bird
          const birdX = CANVAS_WIDTH / 3;
          const birdRadius = BIRD_SIZE - 4;

          const inPipeHoriz =
            birdX + birdRadius > pipe.x && birdX - birdRadius < pipe.x + PIPE_WIDTH;

          if (inPipeHoriz) {
            const inTopPipe = s.birdY - birdRadius < pipe.topHeight;
            const inBottomPipe = s.birdY + birdRadius > pipe.topHeight + PIPE_GAP;

            if (inTopPipe || inBottomPipe) {
              die();
            }
          }
        }

        // Recycle pipes
        if (s.pipes.length > 0 && s.pipes[0].x + PIPE_WIDTH < -10) {
          s.pipes.shift();
          const lastX = s.pipes[s.pipes.length - 1].x;
          const newHeight =
            100 + Math.floor(Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 200));
          s.pipes.push({
            x: lastX + PIPE_SPACING,
            topHeight: newHeight,
            passed: false,
          });
        }
      }

      particlesRef.current?.update(dt);
      shakeRef.current?.update(dt);
      popsRef.current.forEach(p => (p.t += dt));
      popsRef.current = popsRef.current.filter(p => p.t < 0.9);

      ctx.save();
      shakeRef.current!.apply(ctx);

      // --- Sky ---
      const sky = light ? '#7dd3fc' : '#0f1e46';
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (!light) drawStarfield(ctx, stars, time, { alpha: 0.55 });

      // Sun / moon
      const sunX = CANVAS_WIDTH - 74;
      const sunY = 74;
      ctx.fillStyle = light ? '#fef9c3' : '#fde047';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 17, 0, Math.PI * 2);
      ctx.fill();

      // Parallax clouds
      ctx.save();
      clouds.forEach((cl, i) => {
        const cx = (cl.x - (s.frame * cl.speed) % (CANVAS_WIDTH + 120)) - 40;
        ctx.fillStyle = light ? 'rgba(255,255,255,0.82)' : `rgba(226, 232, 240, ${0.1 + i * 0.05})`;
        const bob = Math.sin(time * 0.5 + i) * 3;
        ctx.beginPath();
        ctx.ellipse(cx, cl.y + bob, cl.r, cl.r * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + cl.r * 0.7, cl.y + bob + 5, cl.r * 0.7, cl.r * 0.42, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - cl.r * 0.65, cl.y + bob + 6, cl.r * 0.6, cl.r * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Rolling hills behind the city
      ctx.fillStyle = light ? 'rgba(110, 190, 130, 0.55)' : 'rgba(30, 58, 92, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT - 30);
      for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
        ctx.lineTo(x, CANVAS_HEIGHT - 62 - Math.sin(x * 0.015 + 1) * 22);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 30);
      ctx.closePath();
      ctx.fill();

      // Distant city silhouette
      ctx.fillStyle = light ? '#6fb8de' : '#0f172a';
      for (let i = 0; i < 8; i++) {
        const bx = i * 55;
        const bh = 50 + ((i * 33) % 60);
        ctx.fillRect(bx, CANVAS_HEIGHT - 30 - bh, 45, bh);
        // Lit windows
        if (!light) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
          for (let wy = 0; wy < bh - 10; wy += 12) {
            for (let wx = 0; wx < 45; wx += 12) {
              if ((i * 7 + wy * 3 + wx) % 5 === 0) ctx.fillRect(bx + wx + 4, CANVAS_HEIGHT - 30 - bh + wy + 5, 4, 5);
            }
          }
          ctx.fillStyle = '#0f172a';
        }
      }

      // Draw Pipes with rim light
      s.pipes.forEach(pipe => {
        ctx.fillStyle = '#065f46';
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.fillStyle = '#065f46';
        ctx.fillRect(pipe.x - 3, pipe.topHeight - 16, PIPE_WIDTH + 6, 16);
        ctx.fillStyle = 'rgba(209, 250, 229, 0.5)';
        ctx.fillRect(pipe.x - 3, pipe.topHeight - 16, PIPE_WIDTH + 6, 4);

        const bottomY = pipe.topHeight + PIPE_GAP;
        const bottomHeight = CANVAS_HEIGHT - bottomY - 30;
        ctx.fillStyle = '#065f46';
        ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomHeight);
        ctx.fillStyle = '#065f46';
        ctx.fillRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 16);
        ctx.fillStyle = 'rgba(209, 250, 229, 0.5)';
        ctx.fillRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 4);
      });

      // Ground with scrolling stripes
      const gy = CANVAS_HEIGHT - 30;
      ctx.fillStyle = light ? '#79c96a' : '#1e293b';
      ctx.fillRect(0, gy, CANVAS_WIDTH, 30);
      ctx.fillStyle = light ? '#d9f99d' : '#475569';
      ctx.fillRect(0, gy, CANVAS_WIDTH, 4);
      ctx.fillStyle = light ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.18)';
      const scroll = (s.frame * s.pipeSpeed) % 24;
      for (let x = -24 + scroll; x < CANVAS_WIDTH; x += 24) ctx.fillRect(x, gy + 12, 12, 3);

      particlesRef.current!.draw(ctx);

      // Draw Bird (Yellow chick with animated wing & beak)
      const birdX = CANVAS_WIDTH / 3;
      const angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, s.birdVelocity * 0.08));

      // Drop  on the ground
      const shadowY = Math.min(CANVAS_HEIGHT - 34, s.birdY + BIRD_SIZE * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(birdX, shadowY, BIRD_SIZE * 0.8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(birdX, s.birdY);
      ctx.rotate(angle);

      // Body
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE, 0, Math.PI * 2);
      ctx.fill();

      // Tail feathers
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(-BIRD_SIZE + 2, -2);
      ctx.lineTo(-BIRD_SIZE - 8, -8);
      ctx.lineTo(-BIRD_SIZE - 6, 2);
      ctx.lineTo(-BIRD_SIZE - 1, 5);
      ctx.closePath();
      ctx.fill();

      // Wing
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      const wingFlap = Math.sin(s.frame * 0.3) * 4;
      ctx.ellipse(-8, wingFlap, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
      ctx.beginPath();
      ctx.ellipse(-8, wingFlap - 2, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(10, -6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(12, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(13, -7, 1, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(28, 4);
      ctx.lineTo(18, 8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Floating score pops
      popsRef.current.forEach(p => {
        const k = p.t / 0.9;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.5)';
        ctx.lineWidth = 3;
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(p.label, p.x, p.y - k * 42);
        ctx.fillText(p.label, p.x, p.y - k * 42);
        ctx.restore();
      });

      // Start Prompt overlay
      if (!started && !over) {
        ctx.fillStyle = light ? 'rgba(255,255,255,0.68)' : 'rgba(4, 8, 22, 0.62)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = light ? '#12314d' : '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nhấn SPACE để bay!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('hoặc nhấp chuột / chạm màn hình', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

        // Animated bouncing arrow indicator
        const bounce = Math.sin(Date.now() * 0.006) * 6;
        ctx.font = '24px sans-serif';
        ctx.fillText('⬆', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65 + bounce);
      }

      ctx.restore();
      drawVignette(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, light ? 0.05 : 0.38);

      animId = requestAnimationFrame(loop);
    };

    loop.last = performance.now();
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
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-bold text-amber-400">
          Điểm: {score}
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto select-none">
        {/* Game Canvas Container */}
        <div
          onClick={flap}
          onTouchStart={e => {
            e.preventDefault();
            flap();
          }}
 className="relative p-2.5 rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden cursor-pointer game-touch-zone active:border-indigo-500/50 transition"
          title="Nhấp chuột hoặc nhấn Space để vỗ cánh"
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
 className="w-[300px] h-[420px] sm:w-[360px] sm:h-[504px] rounded-2xl block bg-[#090d16]"
          />
        </div>

        {/* Responsive Controls Bar: Desktop keyboard badge & Mobile big button */}
 <div className="mt-3 w-full flex flex-col items-center gap-2">
          {/* Mobile Big Tap Button */}
          <button
            type="button"
            onClick={flap}
 className="w-full max-w-xs py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold text-sm transition flex items-center justify-center gap-2 md:hidden"
          >
            <span>🚀 VỖ CÁNH BAY LÊN</span>
 <span className="text-[11px] opacity-75 font-normal">(Chạm)</span>
          </button>

          {/* Desktop Keyboard Controls Hint */}
 <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <span>Phím điều khiển:</span>
 <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono font-bold text-[11px]">
              SPACE
            </kbd>
            <span>hoặc</span>
 <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono font-bold text-[11px]">
              ↑ Mũi tên lên
            </kbd>
            <span>/</span>
 <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono font-bold text-[11px]">
              W
            </kbd>
          </div>
        </div>
      </div>
    </GameShell>
  );
};
