import React, { useEffect, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound } from '../utils/sound';

type Point = { x: number; y: number };
type Obstacle = Point & { radius: number };
const START: Point = { x: 0.5, y: 0.88 };
const HOLE: Point = { x: 0.5, y: 0.1 };
const MAX_LEVEL = 9;

const createObstacles = (level: number): Obstacle[] => {
  const count = Math.min(3 + level, 14);
  const radius = 0.055 + Math.min(level - 1, 6) * 0.004;
  const obstacles: Obstacle[] = [];
  let attempts = 0;
  while (obstacles.length < count && attempts < count * 40) {
    attempts++;
    const obstacle = { x: 0.12 + Math.random() * 0.76, y: 0.2 + Math.random() * 0.62, radius };
    const clearOfEndpoints = Math.hypot(obstacle.x - START.x, obstacle.y - START.y) > 0.15 && Math.hypot(obstacle.x - HOLE.x, obstacle.y - HOLE.y) > 0.15;
    const clearOfOthers = obstacles.every(other => Math.hypot(obstacle.x - other.x, obstacle.y - other.y) > radius * 2.2);
    if (clearOfEndpoints && clearOfOthers) obstacles.push(obstacle);
  }
  return obstacles;
};

export const MiniGolfGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('mini-golf')!;
  const [ball, setBall] = useState<Point>(START);
  const [aim, setAim] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [level, setLevel] = useState(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>(() => createObstacles(1));
  const [strokes, setStrokes] = useState(0);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const velocity = useRef<Point>({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef(ball);
  ballRef.current = ball;

  const restart = () => {
    velocity.current = { x: 0, y: 0 };
    setBall(START);
    setAim(null);
    setDragging(false);
    setMoving(false);
    setLevel(1);
    setObstacles(createObstacles(1));
    setStrokes(0);
    setScore(0);
    setWon(false);
    setStatusMessage('');
  };

  useEffect(() => {
    if (!moving) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const scale = Math.min((now - last) / 16, 2);
      last = now;
      let { x, y } = ballRef.current;
      let vx = velocity.current.x * scale;
      let vy = velocity.current.y * scale;
      x += vx;
      y += vy;
      if (x < 0.04 || x > 0.96) { x = Math.max(0.04, Math.min(0.96, x)); vx *= -0.72; }
      if (y < 0.04 || y > 0.96) { y = Math.max(0.04, Math.min(0.96, y)); vy *= -0.72; }
      for (const obstacle of obstacles) {
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        if (Math.hypot(dx, dy) < obstacle.radius + 0.025) { vx *= -0.75; vy *= -0.75; x = obstacle.x + dx * 1.12; y = obstacle.y + dy * 1.12; }
      }
      const holeDistance = Math.hypot(x - HOLE.x, y - HOLE.y);
      if (holeDistance < 0.035 && Math.hypot(vx, vy) < 0.012) {
        setBall(HOLE);
        setMoving(false);
        playClearSound();
        setScore(value => value + Math.max(100, 700 - strokes * 100));
        if (level >= MAX_LEVEL) {
          setWon(true);
          setStatusMessage(`Bạn đã hoàn thành cả ${MAX_LEVEL} màn!`);
        } else {
          const nextLevel = level + 1;
          setLevel(nextLevel);
          setObstacles(createObstacles(nextLevel));
          setBall(START);
          setStrokes(0);
          setStatusMessage(`Qua màn ${level}! Màn ${nextLevel} có thêm chướng ngại vật.`);
        }
        return;
      }
      vx *= 0.985;
      vy *= 0.985;
      velocity.current = { x: vx / scale, y: vy / scale };
      setBall({ x, y });
      if (Math.hypot(vx, vy) < 0.0015) {
        setMoving(false);
        velocity.current = { x: 0, y: 0 };
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving, level, obstacles, strokes]);

  useEffect(() => {
    if (!statusMessage || won) return;
    const timer = setTimeout(() => setStatusMessage(''), 1800);
    return () => clearTimeout(timer);
  }, [statusMessage, won]);

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (moving || won) return;
    const point = pointFromEvent(event);
    if (Math.hypot((point.x - ball.x) * 360, (point.y - ball.y) * 520) > 32) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setAim(point);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) setAim(pointFromEvent(event));
  };

  const onPointerUp = () => {
    if (!dragging || !aim || won) return;
    const dx = Math.max(-0.34, Math.min(0.34, ball.x - aim.x));
    const dy = Math.max(-0.34, Math.min(0.34, ball.y - aim.y));
    if (Math.hypot(dx, dy) > 0.025) {
      velocity.current = { x: dx * 0.045, y: dy * 0.045 };
      setStrokes(value => value + 1);
      setMoving(true);
      playMoveSound();
    }
    setDragging(false);
    setAim(null);
  };

  return (
 <GameShell game={gameMeta} score={score} isGameOver={won} isVictory={won} isPaused={false} onRestart={restart} onBackToHub={onBackToHub} gameCustomStats={<span className="text-xs text-slate-300">Màn {level}/{MAX_LEVEL} · Gậy: {strokes} · Par 3</span>}>
 <div className="flex w-full flex-col items-center gap-3">
 <p className="min-h-5 text-center text-sm text-slate-300">{statusMessage || 'Kéo bóng ngược hướng muốn đánh, thả để vung gậy.'}</p>
 <div ref={boardRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="golf-course relative aspect-[9/13] w-full max-w-[360px] touch-none overflow-hidden rounded-2xl border-4 border-emerald-800 ">
 <div className="golf-boundary absolute inset-3 rounded-xl border" />
 <div className="golf-bumper absolute left-[38%] top-[39%] h-[3%] w-[25%] rounded-full" />
 <div className="golf-bumper absolute left-[18%] top-[58%] h-[3%] w-[28%] rotate-12 rounded-full" />
 {obstacles.map((obstacle, index) => <div key={index} className="golf-rock absolute -translate-x-1/2 -translate-y-1/2 border-2" style={{ width: `${obstacle.radius * 200}%`, aspectRatio: '1', left: `${obstacle.x * 100}%`, top: `${obstacle.y * 100}%` }} />)}
 <div className="golf-flag" style={{ left: `${HOLE.x * 100}%`, top: `${HOLE.y * 100}%` }}>
 <span className="golf-flag-pole" />
 <span className="golf-flag-cloth" />
 <span className="golf-cup" />
          </div>
          {aim && dragging && (
 <div className="pointer-events-none absolute inset-0">
              {/* Dashed aim guide from ball, opposite the drag direction */}
 <svg className="absolute inset-0 h-full w-full overflow-visible">
                <line
                  x1={`${ball.x * 100}%`}
                  y1={`${ball.y * 100}%`}
                  x2={`${(ball.x + (aim.x - ball.x) * 1.6) * 100}%`}
                  y2={`${(ball.y + (aim.y - ball.y) * 1.6) * 100}%`}
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                />
              </svg>
              {/* Power arrow head at the target end */}
              <div
 className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-white/90"
                style={{
                  left: `${(ball.x + (aim.x - ball.x) * 1.55) * 100}%`,
                  top: `${(ball.y + (aim.y - ball.y) * 1.55) * 100}%`,
                }}
              />
              {/* Pull-back power bar */}
              <div
 className="absolute h-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${ball.x * 100}%`,
                  top: `${ball.y * 100}%`,
                  width: `${Math.hypot((aim.x - ball.x) * 360, (aim.y - ball.y) * 520) * 0.5}px`,
                  background: 'rgba(244,63,94,0.95)',
                }}
              />
            </div>
          )}
          <div
 className="pointer-events-none absolute h-[5%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${ball.x * 100}%`,
              top: `${ball.y * 100 + 3}%`,
              background: 'rgba(0,0,0,0.28)',
              filter: 'blur(2px)',
            }}
          />
 <div className="golf-ball absolute h-[4.5%] w-[4.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ left: `${ball.x * 100}%`, top: `${ball.y * 100}%` }} />
        </div>
 {won && <p className="font-bold text-emerald-300">Hole in! {statusMessage}</p>}
      </div>
    </GameShell>
  );
};