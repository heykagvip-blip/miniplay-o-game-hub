import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playMoveSound,
  playScoreSound,
  playClearSound,
  playBounceSound,
  triggerHaptic,
} from '../utils/sound';

const W = 480;
const H = 640;
const GRAVITY = 1500;
const START_LIVES = 3;
const BLADE_TRAIL_MS = 200;
const SLICE_PAD = 11;
const FRUIT_BONUS = 10;
const SLOWMO_AT = 4;
const SLOWMO_SCALE = 0.3;
const SLOWMO_TIME = 0.9;
const COMBO_HOLD = 0.7;
const WAVE_SECONDS = 12;
const MAX_WAVE = 8;

type DiffId = 'easy' | 'hard';

interface Diff {
  id: DiffId;
  label: string;
  speed: number;
  bomb: number;
  interval: number;
  radius: number;
}

const DIFFS: Diff[] = [
  { id: 'easy', label: 'Dễ', speed: 0.82, bomb: 0.12, interval: 0.95, radius: 31 },
  { id: 'hard', label: 'Khó', speed: 1.18, bomb: 0.3, interval: 0.6, radius: 27 },
];

interface Skin {
  skin: string;
  flesh: string;
}

const FRUITS: Skin[] = [
  { skin: '#f97316', flesh: '#fdba74' },
  { skin: '#22c55e', flesh: '#bbf7d0' },
  { skin: '#ec4899', flesh: '#fbcfe8' },
  { skin: '#eab308', flesh: '#fef08a' },
  { skin: '#a855f7', flesh: '#e9d5ff' },
  { skin: '#38bdf8', flesh: '#bae6fd' },
];

const BOMB_SKIN: Skin = { skin: '#b91c1c', flesh: '#7f1d1d' };
const BOMB_CORE = '#1f2937';

interface Flying {
  id: number;
  bomb: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  skin: string;
  flesh: string;
}

interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  side: number;
  rot: number;
  vrot: number;
  skin: string;
  flesh: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Mark {
  x: number;
  y: number;
  t: number;
}

interface Sim {
  flying: Flying[];
  halves: Half[];
  parts: Particle[];
  blade: Mark[];
  diff: Diff;
  lives: number;
  elapsed: number;
  spawnTimer: number;
  nextId: number;
  swipeHits: number;
  swipeBombs: number;
  comboHold: number;
  slowmo: number;
  wave: number;
  flash: number;
  over: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function createSim(diff: Diff): Sim {
  return {
    flying: [],
    halves: [],
    parts: [],
    blade: [],
    diff,
    lives: START_LIVES,
    elapsed: 0,
    spawnTimer: 0.5,
    nextId: 1,
    swipeHits: 0,
    swipeBombs: 0,
    comboHold: 0,
    slowmo: 0,
    wave: 1,
    flash: 0,
    over: false,
  };
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len > 0 ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function burst(s: Sim, x: number, y: number, color: string, count: number, speed: number): void {
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    const spd = rand(speed * 0.25, speed);
    const life = rand(0.28, 0.72);
    s.parts.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 60,
      life,
      max: life,
      size: rand(2.5, 6.5),
      color,
    });
  }
  if (s.parts.length > 260) s.parts.splice(0, s.parts.length - 260);
}

function spawnOne(s: Sim, bomb: boolean, x: number): void {
  const r = s.diff.radius + rand(-3, 4);
  const skin = bomb ? BOMB_SKIN : FRUITS[Math.floor(Math.random() * FRUITS.length)];
  s.flying.push({
    id: s.nextId++,
    bomb,
    x,
    y: H + r + rand(0, 20),
    vx: rand(-150, 150),
    vy: -rand(1080, 1360) * s.diff.speed,
    r,
    rot: rand(0, Math.PI * 2),
    vrot: rand(-3.4, 3.4),
    skin: skin.skin,
    flesh: skin.flesh,
  });
}

function spawnVolley(s: Sim): void {
  const wave = s.wave;
  const count = 1 + (wave >= 3 ? 1 : 0) + (wave >= 6 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const x = rand(46, W - 46);
    spawnOne(s, Math.random() < s.diff.bomb, x);
  }
}

function drawJagged(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  const teeth = 11;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = rot + (i / teeth) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * 0.7;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawEntity(ctx: CanvasRenderingContext2D, f: Flying, leaf: string, stem: string): void {
  if (f.bomb) {
    drawJagged(ctx, f.x, f.y, f.r, f.rot);
    ctx.fillStyle = f.skin;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = f.flesh;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = BOMB_CORE;
    ctx.fill();
    ctx.strokeStyle = stem;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.x + f.r * 0.25, f.y - f.r * 0.75);
    ctx.lineTo(f.x + f.r * 0.55, f.y - f.r * 1.1);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.fillStyle = f.skin;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(f.x - f.r * 0.22, f.y - f.r * 0.26, f.r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = f.flesh;
  ctx.fill();
  ctx.fillStyle = stem;
  ctx.fillRect(f.x - 2.5, f.y - f.r - 9, 5, 11);
  ctx.beginPath();
  ctx.ellipse(f.x + 9, f.y - f.r - 4, 9, 5, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = leaf;
  ctx.fill();
}

function drawHalf(ctx: CanvasRenderingContext2D, h: Half): void {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rot);
  const a0 = h.side < 0 ? 0 : Math.PI;
  ctx.beginPath();
  ctx.arc(0, 0, h.r, a0, a0 + Math.PI);
  ctx.closePath();
  ctx.fillStyle = h.skin;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, h.r * 0.68, a0, a0 + Math.PI);
  ctx.closePath();
  ctx.fillStyle = h.flesh;
  ctx.fill();
  ctx.restore();
}

function drawBlade(ctx: CanvasRenderingContext2D, blade: Mark[], wide: string, core: string): void {
  if (blade.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(blade[0].x, blade[0].y);
  for (let i = 1; i < blade.length; i++) ctx.lineTo(blade[i].x, blade[i].y);
  ctx.strokeStyle = wide;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = core;
  ctx.lineWidth = 3.5;
  ctx.stroke();
}

export const FruitNinjaGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [combo, setCombo] = useState(0);
  const [wave, setWave] = useState(1);
  const [slow, setSlow] = useState(false);
  const [diffId, setDiffId] = useState<DiffId>('easy');
  const [isPaused, setIsPaused] = useState(false);
  const [ended, setEnded] = useState(false);

  const simRef = useRef<Sim>(createSim(DIFFS[0]));
  const inputRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, down: false, active: false });
  const waveRef = useRef(1);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  const loseLife = useCallback((s: Sim) => {
    s.lives -= 1;
    s.flash = 0.35;
    s.swipeHits = 0;
    s.swipeBombs = 0;
    playBounceSound();
    triggerHaptic(45);
    setCombo(0);
    if (s.lives <= 0) {
      s.lives = 0;
      s.over = true;
      s.flying.length = 0;
      s.halves.length = 0;
      setEnded(true);
    } else {
      setLives(s.lives);
    }
  }, []);

  const applySlice = useCallback(
    (s: Sim, x0: number, y0: number, x1: number, y1: number) => {
      for (let i = s.flying.length - 1; i >= 0; i--) {
        const f = s.flying[i];
        if (distToSeg(f.x, f.y, x0, y0, x1, y1) > f.r + SLICE_PAD) continue;
        s.flying.splice(i, 1);
        if (f.bomb) {
          s.swipeBombs += 1;
          loseLife(s);
          continue;
        }
        s.swipeHits += 1;
        setCombo(s.swipeHits);
        s.comboHold = COMBO_HOLD;
        setScore(p => p + FRUIT_BONUS);
        playScoreSound();
        triggerHaptic(18);
        for (let k = 0; k < 2; k++) {
          const side = k === 0 ? -1 : 1;
          s.halves.push({
            x: f.x,
            y: f.y,
            vx: f.vx + side * rand(120, 210),
            vy: f.vy * 0.25 - rand(60, 150),
            r: f.r,
            side,
            rot: f.rot + (side < 0 ? 0 : Math.PI),
            vrot: side * rand(3, 6.5),
            skin: f.skin,
            flesh: f.flesh,
          });
        }
        burst(s, f.x, f.y, f.flesh, 12, 320);
        if (s.swipeHits >= SLOWMO_AT) {
          s.slowmo = SLOWMO_TIME;
          setSlow(true);
        }
      }
    },
    [loseLife],
  );

  const endSwipe = useCallback((s: Sim) => {
    const fruits = s.swipeHits;
    const bombs = s.swipeBombs;
    s.swipeHits = 0;
    s.swipeBombs = 0;
    if (bombs === 0 && fruits >= 2) {
      const bonus = (fruits * (fruits - 1) * FRUIT_BONUS) / 2;
      setScore(p => p + bonus);
      playClearSound();
      triggerHaptic(30);
      setCombo(fruits);
    }
  }, []);

  const restart = useCallback(() => {
    const next = DIFFS.find(d => d.id === diffId) ?? DIFFS[0];
    simRef.current = createSim(next);
    inputRef.current = { x: 0, y: 0, lastX: 0, lastY: 0, down: false, active: false };
    waveRef.current = 1;
    setScore(0);
    setLives(START_LIVES);
    setCombo(0);
    setWave(1);
    setSlow(false);
    setIsPaused(false);
    setEnded(false);
    playMoveSound();
  }, [diffId]);

  const applyDiff = useCallback((d: Diff) => {
    simRef.current.diff = d;
    setDiffId(d.id);
    playMoveSound();
  }, []);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toCanvas(e.clientX, e.clientY);
      if (!p) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const s = simRef.current;
      s.blade.length = 0;
      s.blade.push({ x: p.x, y: p.y, t: performance.now() });
      inputRef.current = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, down: true, active: true };
    },
    [toCanvas],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toCanvas(e.clientX, e.clientY);
      if (!p) return;
      const s = simRef.current;
      if (s.over || pausedRef.current) return;
      const input = inputRef.current;
      if (!input.down) return;
      const now = performance.now();
      const prev = input.active ? { x: input.x, y: input.y } : p;
      input.x = p.x;
      input.y = p.y;
      input.active = true;
      applySlice(s, prev.x, prev.y, p.x, p.y);
      s.blade.push({ x: p.x, y: p.y, t: now });
    },
    [applySlice, toCanvas],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const s = simRef.current;
    endSwipe(s);
    inputRef.current.down = false;
    inputRef.current.active = false;
  }, [endSwipe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId = 0;

    const loop = (now: number) => {
      const s = simRef.current;
      const raw = Math.min((now - loop.last) / 1000, 0.05);
      loop.last = now;

      const running = !isPaused && !ended;
      const slowNow = s.slowmo > 0;
      const step = raw * (slowNow ? SLOWMO_SCALE : 1);

      if (running) {
        s.elapsed += step;
        s.wave = Math.min(MAX_WAVE, 1 + Math.floor(s.elapsed / WAVE_SECONDS));

        if (s.slowmo > 0) {
          s.slowmo = Math.max(0, s.slowmo - raw);
          if (s.slowmo === 0) setSlow(false);
        }
        if (s.comboHold > 0) {
          s.comboHold = Math.max(0, s.comboHold - raw);
          if (s.comboHold === 0 && s.swipeHits === 0) setCombo(0);
        }
        if (s.flash > 0) s.flash = Math.max(0, s.flash - raw);

        s.spawnTimer -= step;
        if (s.spawnTimer <= 0) {
          spawnVolley(s);
          s.spawnTimer = (s.diff.interval * rand(0.78, 1.24)) / (1 + (s.wave - 1) * 0.17);
        }

        for (let i = s.flying.length - 1; i >= 0; i--) {
          const f = s.flying[i];
          f.vy += GRAVITY * step;
          f.x += f.vx * step;
          f.y += f.vy * step;
          f.rot += f.vrot * step;
          if (f.x < f.r || f.x > W - f.r) {
            f.x = Math.max(f.r, Math.min(W - f.r, f.x));
            f.vx = -f.vx * 0.85;
          }
          if (f.y > H + f.r * 2) {
            s.flying.splice(i, 1);
            if (!f.bomb) loseLife(s);
          } else if (f.y < -f.r * 3) {
            s.flying.splice(i, 1);
          }
        }

        for (let i = s.halves.length - 1; i >= 0; i--) {
          const h = s.halves[i];
          h.vy += GRAVITY * step;
          h.x += h.vx * step;
          h.y += h.vy * step;
          h.rot += h.vrot * step;
          if (h.y > H + h.r * 2) s.halves.splice(i, 1);
        }

        for (let i = s.parts.length - 1; i >= 0; i--) {
          const p = s.parts[i];
          p.vy += GRAVITY * 0.6 * step;
          p.x += p.vx * step;
          p.y += p.vy * step;
          p.life -= step;
          if (p.life <= 0) s.parts.splice(i, 1);
        }

        const cutoff = now - BLADE_TRAIL_MS;
        while (s.blade.length && s.blade[0].t < cutoff) s.blade.shift();

        const input = inputRef.current;
        if (!s.over && input.down && input.active) {
          applySlice(s, input.lastX, input.lastY, input.x, input.y);
          input.lastX = input.x;
          input.lastY = input.y;
        }

        if (s.wave !== waveRef.current) {
          waveRef.current = s.wave;
          setWave(s.wave);
        }
      }

      const isLight = document.documentElement.classList.contains('light');
      const bg = isLight ? '#e2e8f0' : '#111827';
      const board = isLight ? '#f8fafc' : '#1f2937';
      const bladeWide = isLight ? '#475569' : '#cbd5e1';
      const bladeCore = isLight ? '#0f172a' : '#f8fafc';
      const leaf = isLight ? '#15803d' : '#4ade80';
      const stem = isLight ? '#7c2d12' : '#78350f';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = board;
      ctx.fillRect(6, 6, W - 12, H - 12);

      ctx.fillStyle = isLight ? 'rgba(71,85,105,0.16)' : 'rgba(148,163,184,0.14)';
      for (let row = 1; row < 8; row++) ctx.fillRect(6, (H / 8) * row - 1, W - 12, 2);

      for (let i = 0; i < s.parts.length; i++) {
        const p = s.parts[i];
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < s.halves.length; i++) drawHalf(ctx, s.halves[i]);
      for (let i = 0; i < s.flying.length; i++) drawEntity(ctx, s.flying[i], leaf, stem);

      if (running) drawBlade(ctx, s.blade, bladeWide, bladeCore);

      if (s.flash > 0) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, W - 10, H - 10);
      }

      animId = requestAnimationFrame(loop);
    };

    loop.last = performance.now();
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, ended, applySlice]);

  return (
    <GameShell
      game={getGameById('fruit-ninja')!}
      score={score}
      isGameOver={ended}
      isVictory={false}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={restart}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div
          className="px-3 py-1 rounded-xl border theme-border flex items-center gap-1.5 bg-slate-800"
          style={{ background: 'var(--surface-strong)' }}
        >
          <span className="text-[10px] uppercase font-bold theme-muted">Đợt {wave}</span>
          <span className="text-sm sm:text-base font-black text-amber-400">x{combo}</span>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto">
        <div className="flex items-stretch justify-between gap-2 w-full max-w-[460px] py-2 px-3 rounded-2xl border theme-border mb-3" style={{ background: 'var(--game-status-bg)' }}>
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold theme-muted block">Điểm</span>
            <span className="text-2xl font-black text-indigo-400">{score}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold theme-muted block">Mạng</span>
            <span className="text-2xl font-black text-rose-400">{lives}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold theme-muted block">Combo</span>
            <span className="text-2xl font-black text-amber-400">x{combo}</span>
          </div>
        </div>

        <div className="relative w-full max-w-[460px] rounded-3xl p-2.5 border theme-border overflow-hidden" style={{ background: 'var(--card-bg)' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={e => e.preventDefault()}
            className="w-full block rounded-2xl game-touch-zone cursor-crosshair touch-none"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
          {slow && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 border border-amber-300 text-slate-900 text-[11px] font-black uppercase tracking-widest pointer-events-none">
              Chậm lại
            </div>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] theme-muted max-w-[460px]">
          Quét ngón tay hoặc chuột cắt trái cây. Cắt 3 quả trở lên trong một lần quét để nhân điểm — từ 4 quát là
          thời gian chậm lại. Bom đỏ có gai: chạm vào mất 1 mạng, không được tính điểm. Rơi mất quả xuống đáy
          cũng mất 1 mạng. Hết 3 mạng là kết thúc.
        </p>

        <div className="flex items-center gap-2 mt-3 w-full max-w-[380px]">
          {DIFFS.map(d => (
            <button
              key={d.id}
              onClick={() => applyDiff(d)}
              className={`flex-1 px-2 py-2 rounded-xl text-xs font-black game-btn-press transition-colors ${
                diffId === d.id
                  ? 'bg-amber-500 border border-amber-300 text-slate-900'
                  : 'theme-panel-soft theme-text border'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  );
};
