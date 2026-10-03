import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playJumpSound, playBounceSound, playGameOverSound, triggerHaptic } from '../utils/sound';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { drawVignette } from '../utils/gameArt';

const CANVAS_WIDTH = 380;
const CANVAS_HEIGHT = 560;
const PLAYER_SIZE = 26;
const GRAVITY = 0.38;
const BOUNCE_VELOCITY = -10.5;
const SUPER_BOUNCE = -16.5;
const PLATFORM_WIDTH = 64;
const PLATFORM_HEIGHT = 12;

interface Platform {
  x: number;
  y: number;
  type: 'standard' | 'moving' | 'spring';
  vx?: number;
}

interface DoodleJumpGameProps {
  onBackToHub: () => void;
}

export const DoodleJumpGame: React.FC<DoodleJumpGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('doodle-jump')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const stateRef = useRef({
    playerX: CANVAS_WIDTH / 2,
    playerY: CANVAS_HEIGHT - 120,
    playerVx: 0,
    playerVy: BOUNCE_VELOCITY,
    cameraY: 0,
    maxAltitude: 0,
    platforms: [] as Platform[],
    keyLeft: false,
    keyRight: false,
  });

  const initPlatforms = () => {
    const plats: Platform[] = [
      { x: CANVAS_WIDTH / 2 - PLATFORM_WIDTH / 2, y: CANVAS_HEIGHT - 60, type: 'standard' },
    ];

    let currentY = CANVAS_HEIGHT - 120;
    while (currentY > -CANVAS_HEIGHT) {
      const typeRand = Math.random();
      const type: 'standard' | 'moving' | 'spring' =
        typeRand < 0.2 ? 'moving' : typeRand < 0.3 ? 'spring' : 'standard';

      plats.push({
        x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: currentY,
        type,
        vx: type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0,
      });

      currentY -= 55 + Math.random() * 25;
    }

    stateRef.current.platforms = plats;
  };

  const resetGame = useCallback(() => {
    stateRef.current = {
      playerX: CANVAS_WIDTH / 2,
      playerY: CANVAS_HEIGHT - 120,
      playerVx: 0,
      playerVy: BOUNCE_VELOCITY,
      cameraY: 0,
      maxAltitude: 0,
      platforms: [],
      keyLeft: false,
      keyRight: false,
    };
    initPlatforms();
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
  }, []);

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

  // Main animation frame loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    resetGame();

    const loop = () => {
      const s = stateRef.current;

      if (!isGameOver && !isPaused) {
        // Horizontal controls & screen wrapping
        if (s.keyLeft) s.playerVx = -4.5;
        else if (s.keyRight) s.playerVx = 4.5;
        else s.playerVx *= 0.85; // friction

        s.playerX += s.playerVx;
        if (s.playerX < -PLAYER_SIZE) s.playerX = CANVAS_WIDTH;
        else if (s.playerX > CANVAS_WIDTH) s.playerX = -PLAYER_SIZE;

        // Apply vertical physics
        s.playerVy += GRAVITY;
        s.playerY += s.playerVy;

        // Moving platforms
        s.platforms.forEach(p => {
          if (p.type === 'moving' && p.vx) {
            p.x += p.vx;
            if (p.x <= 0 || p.x + PLATFORM_WIDTH >= CANVAS_WIDTH) {
              p.vx = -p.vx;
            }
          }
        });

        // Platform bounce collision (only when falling downwards)
        if (s.playerVy > 0) {
          s.platforms.forEach(p => {
            const playerFeet = s.playerY + PLAYER_SIZE;
            if (
              playerFeet >= p.y &&
              playerFeet <= p.y + PLATFORM_HEIGHT + 10 &&
              s.playerX + PLAYER_SIZE >= p.x &&
              s.playerX <= p.x + PLATFORM_WIDTH
            ) {
              if (p.type === 'spring') {
                s.playerVy = SUPER_BOUNCE;
                playJumpSound();
                triggerHaptic(25);
              } else {
                s.playerVy = BOUNCE_VELOCITY;
                playBounceSound();
                triggerHaptic(15);
              }
            }
          });
        }

        // Camera scroll tracking: when player rises above middle of screen
        const targetCameraY = CANVAS_HEIGHT / 2 - s.playerY;
        if (targetCameraY > s.cameraY) {
          const diff = targetCameraY - s.cameraY;
          s.cameraY = targetCameraY;

          const currentAltitude = Math.floor(s.cameraY);
          if (currentAltitude > s.maxAltitude) {
            s.maxAltitude = currentAltitude;
            setScore(currentAltitude);
          }

          // Generate new platforms ahead and remove old ones far below
          const topPlat = s.platforms.reduce((min, p) => (p.y < min ? p.y : min), Infinity);
          if (topPlat > -s.cameraY - 200) {
            const typeRand = Math.random();
            const type = typeRand < 0.25 ? 'moving' : typeRand < 0.35 ? 'spring' : 'standard';
            s.platforms.push({
              x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
              y: topPlat - (55 + Math.random() * 25),
              type,
              vx: type === 'moving' ? (Math.random() > 0.5 ? 2.2 : -2.2) : 0,
            });
          }

          // Cleanup platforms that fell off bottom of screen
          s.platforms = s.platforms.filter(p => p.y < -s.cameraY + CANVAS_HEIGHT + 100);
        }

        // Falling below camera view -> Game Over
        if (s.playerY > -s.cameraY + CANVAS_HEIGHT) {
          setIsGameOver(true);
          playGameOverSound();
          triggerHaptic(40);
        }
      }

// Draw background
      const isLight = document.documentElement.classList.contains('light');
      const sky = isLight ? '#bae6fd' : '#4c1d95';
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.translate(0, s.cameraY);

      // Parallax hills scrolling slower than the world
      ctx.fillStyle = isLight ? 'rgba(125, 211, 252, 0.45)' : 'rgba(30, 27, 75, 0.6)';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      for (let x = 0; x <= CANVAS_WIDTH; x += 30) {
        ctx.lineTo(x, 320 + Math.sin(x * 0.02 + s.cameraY * 0.0006) * 34);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Draw platforms with a lit top face
      s.platforms.forEach(p => {
        const color =
          p.type === 'moving' ? '#06b6d4' : p.type === 'spring' ? '#a855f7' : '#10b981';
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, PLATFORM_WIDTH, PLATFORM_HEIGHT, 5);
        ctx.fill();
        ctx.restore();

        // Draw spring icon if spring platform
        if (p.type === 'spring') {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.roundRect(p.x + PLATFORM_WIDTH / 2 - 7, p.y - 7, 14, 7, 2.5);
          ctx.fill();
        }
      });

      // Draw Doodle character
      const cx = s.playerX + PLAYER_SIZE / 2;
      const cy = s.playerY + PLAYER_SIZE / 2;
      // Stretch on the way up, squash on the way down, for a bit of life.
      const stretch = Math.max(-0.1, Math.min(0.1, s.playerVy * 0.02));
      const sx = 1 - stretch;
      const sy = 1 + stretch;
      ctx.save();
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.ellipse(cx, cy, (PLAYER_SIZE / 2) * sx, (PLAYER_SIZE / 2) * sy, 0, 0, Math.PI * 2);
      ctx.fill();
      // Feet
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.ellipse(cx - 8, cy + PLAYER_SIZE / 2 - 2, 5, 3.4, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 8, cy + PLAYER_SIZE / 2 - 2, 5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      const lookingRight = s.playerVx >= 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.playerX + (lookingRight ? 18 : 8), s.playerY + 8, 4, 0, Math.PI * 2);
      ctx.arc(s.playerX + (lookingRight ? 24 : 14), s.playerY + 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(63, 98, 18, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(s.playerX + (lookingRight ? 19 : 7), s.playerY + 8, 2, 0, Math.PI * 2);
      ctx.arc(s.playerX + (lookingRight ? 25 : 13), s.playerY + 8, 2, 0, Math.PI * 2);
      ctx.fill();

      // Cute snout / nose
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.arc(s.playerX + (lookingRight ? 26 : 0), s.playerY + 16, 4, 0, Math.PI * 2);
      ctx.fill();

      // Cheek blush
      ctx.fillStyle = 'rgba(248, 113, 133, 0.3)';
      ctx.beginPath();
      ctx.arc(s.playerX + (lookingRight ? 22 : 4), s.playerY + 14, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.restore();
      drawVignette(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, isLight ? 0.05 : 0.4);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isGameOver, isPaused, resetGame]);

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
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-bold text-emerald-400">
          Độ cao: {score}m
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
 <div className="relative p-2.5 rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden select-none game-touch-zone">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
 className="w-[300px] h-[440px] sm:w-[360px] sm:h-[530px] rounded-2xl block "
          />
        </div>

        {/* Mobile controls */}
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
