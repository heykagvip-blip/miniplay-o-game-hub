import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { createParticleSystem, drawVignette } from '../utils/gameArt';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
const WINNING_SCORE = 7;

interface PongGameProps {
  onBackToHub: () => void;
}

export const PongGame: React.FC<PongGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('pong')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  // Mutable game physics state
  const stateRef = useRef({
    playerY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
    aiY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT / 2,
    ballVx: 5,
    ballVy: 3,
    baseSpeed: 5,
    keyUp: false,
    keyDown: false,
    trail: [] as { x: number; y: number }[],
  });

  const particlesRef = useRef<ReturnType<typeof createParticleSystem> | null>(null);
  if (!particlesRef.current) particlesRef.current = createParticleSystem(200);

  const resetBall = (direction: 'LEFT' | 'RIGHT') => {
    const s = stateRef.current;
    s.ballX = CANVAS_WIDTH / 2;
    s.ballY = CANVAS_HEIGHT / 2;
    s.baseSpeed = 5;
    s.ballVx = direction === 'LEFT' ? -5 : 5;
    s.ballVy = (Math.random() - 0.5) * 6;
    s.trail.length = 0;
  };

  const resetGame = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsVictory(false);
    const s = stateRef.current;
    s.playerY = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    s.aiY = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    resetBall('RIGHT');
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        stateRef.current.keyUp = true;
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        stateRef.current.keyDown = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused(p => !p);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        stateRef.current.keyUp = false;
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        stateRef.current.keyDown = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse & Touch tracking on canvas
  const handlePointerMove = (clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = CANVAS_HEIGHT / rect.height;
    const canvasY = (clientY - rect.top) * scaleY;
    stateRef.current.playerY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, canvasY - PADDLE_HEIGHT / 2)
    );
  };

  // Main animation frame game loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min((now - loop.last) / 1000, 0.05);
      loop.last = now;
      // Physics was authored per-frame; scale it by real elapsed time.
      const step = dt * 60;

      if (!isGameOver && !isPaused) {
        // Player keyboard paddle movement
        if (s.keyUp) {
          s.playerY = Math.max(0, s.playerY - 8 * step);
        }
        if (s.keyDown) {
          s.playerY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.playerY + 8 * step);
        }

        // AI paddle tracking with reaction smoothing
        const aiCenter = s.aiY + PADDLE_HEIGHT / 2;
        const targetY = s.ballY;
        const aiSpeed = 4.5 * step;
        if (aiCenter < targetY - 12) {
          s.aiY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.aiY + aiSpeed);
        } else if (aiCenter > targetY + 12) {
          s.aiY = Math.max(0, s.aiY - aiSpeed);
        }

        // Move ball
        s.ballX += s.ballVx * step;
        s.ballY += s.ballVy * step;

        s.trail.push({ x: s.ballX, y: s.ballY });
        if (s.trail.length > 14) s.trail.shift();

        // Top & bottom wall collision
        if (s.ballY <= BALL_SIZE / 2 || s.ballY >= CANVAS_HEIGHT - BALL_SIZE / 2) {
          s.ballVy = -s.ballVy;
          playMoveSound();
        }

        // Left paddle collision (Player)
        const paddleLeftX = 25;
        if (
          s.ballX - BALL_SIZE / 2 <= paddleLeftX + PADDLE_WIDTH &&
          s.ballX + BALL_SIZE / 2 >= paddleLeftX &&
          s.ballY >= s.playerY &&
          s.ballY <= s.playerY + PADDLE_HEIGHT &&
          s.ballVx < 0
        ) {
          // Angle depends on where ball hits paddle (-1 to 1)
          const hitPos = (s.ballY - (s.playerY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          s.baseSpeed = Math.min(13, s.baseSpeed + 0.4);
          s.ballVx = s.baseSpeed;
          s.ballVy = hitPos * (s.baseSpeed * 0.9);
          s.trail.length = 0;
          particlesRef.current?.burst(s.ballX, s.ballY, 8, 230, 80);
          playMoveSound();
          triggerHaptic(20);
        }

        // Right paddle collision (AI)
        const paddleRightX = CANVAS_WIDTH - 25 - PADDLE_WIDTH;
        if (
          s.ballX + BALL_SIZE / 2 >= paddleRightX &&
          s.ballX - BALL_SIZE / 2 <= paddleRightX + PADDLE_WIDTH &&
          s.ballY >= s.aiY &&
          s.ballY <= s.aiY + PADDLE_HEIGHT &&
          s.ballVx > 0
        ) {
          const hitPos = (s.ballY - (s.aiY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          s.baseSpeed = Math.min(13, s.baseSpeed + 0.4);
          s.ballVx = -s.baseSpeed;
          s.ballVy = hitPos * (s.baseSpeed * 0.9);
          s.trail.length = 0;
          playMoveSound();
        }

        // Scoring: Player scores
        if (s.ballX > CANVAS_WIDTH) {
          playScoreSound();
          triggerHaptic(30);
          particlesRef.current?.burst(s.ballX - 6, s.ballY, 26, 230, 160);
          s.trail.length = 0;
          setPlayerScore(p => {
            const nextP = p + 1;
            if (nextP >= WINNING_SCORE) {
              setIsVictory(true);
              setIsGameOver(true);
            } else {
              resetBall('LEFT');
            }
            return nextP;
          });
        }

        // Scoring: AI scores
        if (s.ballX < 0) {
          playGameOverSound();
          triggerHaptic(30);
          particlesRef.current?.burst(s.ballX + 6, s.ballY, 26, 350, 160);
          s.trail.length = 0;
          setAiScore(a => {
            const nextA = a + 1;
            if (nextA >= WINNING_SCORE) {
              setIsVictory(false);
              setIsGameOver(true);
            } else {
              resetBall('RIGHT');
            }
            return nextA;
          });
        }
      }

      particlesRef.current?.update(dt);

      // Render Pong frame
      // Background
      const isLight = document.documentElement.classList.contains('light');
      const bg = isLight ? '#dbeafe' : '#140b2b';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Arena side walls
      ctx.strokeStyle = isLight ? 'rgba(99,102,241,0.35)' : 'rgba(99, 102, 241, 0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(1.5, 0);
      ctx.lineTo(1.5, CANVAS_HEIGHT);
      ctx.moveTo(CANVAS_WIDTH - 1.5, 0);
      ctx.lineTo(CANVAS_WIDTH - 1.5, CANVAS_HEIGHT);
      ctx.stroke();

      // Center dashed net line
      ctx.strokeStyle = isLight ? 'rgba(99,102,241,0.45)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, 0);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Player Paddle
      ctx.save();
      ctx.fillStyle = '#3730a3';
      ctx.beginPath();
      ctx.roundRect(25, s.playerY, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
      ctx.fill();
      ctx.restore();

      // Draw AI Paddle
      ctx.save();
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH - 25 - PADDLE_WIDTH, s.aiY, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
      ctx.fill();
      ctx.restore();

      // Draw Ball
      ctx.save();
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      particlesRef.current?.draw(ctx);
      drawVignette(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, isLight ? 0.06 : 0.42);

      animId = requestAnimationFrame(loop);
    };

    loop.last = performance.now();
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isGameOver, isPaused]);

  return (
    <GameShell
      game={gameMeta}
      score={playerScore * 100}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      isVictory={isVictory}
    >
 <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto">
        {/* Score header in arena */}
 <div className="flex items-center justify-around w-full max-w-md py-2 px-6 bg-slate-900 border border-slate-800 rounded-2xl mb-3 ">
 <div className="text-center">
 <span className="text-[10px] uppercase font-bold text-indigo-400 block">Bạn</span>
 <span className="text-3xl font-black text-white">{playerScore}</span>
          </div>
 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Tới {WINNING_SCORE} Thắng
          </div>
 <div className="text-center">
 <span className="text-[10px] uppercase font-bold text-rose-400 block">Máy</span>
 <span className="text-3xl font-black text-white">{aiScore}</span>
          </div>
        </div>

        {/* Pong Canvas */}
 <div className="relative rounded-3xl p-2.5 bg-slate-900 border border-slate-800 overflow-hidden w-full max-w-[620px]">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseMove={(e) => handlePointerMove(e.clientY)}
            onTouchMove={(e) => {
              if (e.touches.length > 0) {
                handlePointerMove(e.touches[0].clientY);
              }
            }}
 className="w-full aspect-[3/2] block rounded-2xl game-touch-zone cursor-ns-resize "
          />
        </div>

        {/* Mobile On-Screen Buttons */}
 <div className="mt-4 flex items-center gap-6 md:hidden">
          <button
            onTouchStart={() => (stateRef.current.keyUp = true)}
            onTouchEnd={() => (stateRef.current.keyUp = false)}
            onMouseDown={() => (stateRef.current.keyUp = true)}
            onMouseUp={() => (stateRef.current.keyUp = false)}
 className="w-20 h-14 rounded-2xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
 <ArrowUp className="w-6 h-6" />
          </button>
          <button
            onTouchStart={() => (stateRef.current.keyDown = true)}
            onTouchEnd={() => (stateRef.current.keyDown = false)}
            onMouseDown={() => (stateRef.current.keyDown = true)}
            onMouseUp={() => (stateRef.current.keyDown = false)}
 className="w-20 h-14 rounded-2xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
 <ArrowDown className="w-6 h-6" />
          </button>
        </div>
      </div>
    </GameShell>
  );
};
