import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import {
  playBounceSound,
  playClearSound,
  playJumpSound,
  playMoveSound,
  playScoreSound,
  triggerHaptic,
} from '../utils/sound';
import {
  createParticleSystem,
  createRippleSystem,
  createShake,
  createStarfield,
  drawNebula,
  drawStarfield,
  drawVignette,
  linearGradient,
  radialGradient,
  roundRectPath,
} from '../utils/gameArt';

const W = 420;
const H = 620;
const BASE_W = 300;
const BASE_H = 44;
const BLOCK_H = 30;
const START_W = 168;
const PERFECT_PX = 3;
const SPEED_BASE = 92;
const SPEED_PER_LEVEL = 7;
const SPEED_MAX = 300;
const ENTER_TIME = 0.22;
const CAM_ANCHOR = 0.46;
const FLOOR_POINTS = 10;
const PERFECT_POINTS = 20;
const COMBO_POINTS = 50;
const POOR_RATIO = 0.72;
const WIND_LEVEL = 6;
const WIND_STEP = 7;
const WIND_MAX = 40;
const GRAVITY = 1500;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

interface TowerBlock {
  x: number;
  w: number;
  hue: number;
}

interface Mover {
  x: number;
  w: number;
  hue: number;
  dir: number;
  speed: number;
  wind: number;
  enter: number;
}

interface Debris {
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  hue: number;
  life: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  rise: number;
}

interface Sim {
  blocks: TowerBlock[];
  cur: Mover;
  combo: number;
  bestCombo: number;
  score: number;
  over: boolean;
  debris: Debris[];
  floaters: Floater[];
}

interface Fx {
  particles: ReturnType<typeof createParticleSystem>;
  ripples: ReturnType<typeof createRippleSystem>;
  shake: ReturnType<typeof createShake>;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const hueFor = (level: number): number => (198 + level * 16) % 360;

const towerTopY = (floors: number): number => H - BASE_H - floors * BLOCK_H;

const makeMover = (level: number, w: number): Mover => {
  const dir = level % 2 === 0 ? 1 : -1;
  const wind =
    level >= WIND_LEVEL
      ? (Math.random() * 2 - 1) * Math.min(WIND_MAX, (level - WIND_LEVEL + 1) * WIND_STEP)
      : 0;
  return {
    x: dir > 0 ? 0 : W - w,
    w,
    hue: hueFor(level + 1),
    dir,
    speed: Math.min(SPEED_MAX, SPEED_BASE + level * SPEED_PER_LEVEL),
    wind,
    enter: 0,
  };
};

const createSim = (): Sim => ({
  blocks: [],
  cur: makeMover(0, START_W),
  combo: 0,
  bestCombo: 0,
  score: 0,
  over: false,
  debris: [],
  floaters: [],
});

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
};

export const StackTowerGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('stack-tower')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [height, setHeight] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const simRef = useRef<Sim>(createSim());
  const pausedRef = useRef(false);
  const fxRef = useRef<Fx | null>(null);
  if (!fxRef.current) {
    fxRef.current = {
      particles: createParticleSystem(300),
      ripples: createRippleSystem(10),
      shake: createShake(),
    };
  }
  const fx = fxRef.current;

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  const resetGame = useCallback(() => {
    simRef.current = createSim();
    pausedRef.current = false;
    setScore(0);
    setHeight(0);
    setCombo(0);
    setBestCombo(0);
    setIsGameOver(false);
    setIsPaused(false);
    playMoveSound();
  }, []);

  const dropBlock = useCallback(() => {
    const s = simRef.current;
    const f = fxRef.current;
    if (!f || s.over || pausedRef.current) return;
    if (s.cur.enter < 1) return;

    const m = s.cur;
    const support: TowerBlock = s.blocks.length
      ? s.blocks[s.blocks.length - 1]
      : { x: (W - BASE_W) / 2, w: BASE_W, hue: hueFor(0) };
    const left = Math.max(m.x, support.x);
    const right = Math.min(m.x + m.w, support.x + support.w);
    const overlap = right - left;
    const baseTop = towerTopY(s.blocks.length);

    playJumpSound();

    if (overlap <= 0.5) {
      s.over = true;
      f.shake.hit(10);
      f.particles.burst(m.x + m.w / 2, baseTop - BLOCK_H / 2, 18, m.hue, 130);
      triggerHaptic(60);
      setIsGameOver(true);
      return;
    }

    const missed = m.w - overlap;
    const perfect = missed <= PERFECT_PX;
    const level = s.blocks.length;
    const hue = hueFor(level + 1);
    const nextX = perfect ? support.x + support.w / 2 - m.w / 2 : left;
    const nextW = perfect ? m.w : overlap;

    let gained = FLOOR_POINTS;
    if (perfect) {
      s.combo += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      gained += PERFECT_POINTS + COMBO_POINTS * s.combo;
    } else {
      s.combo = 0;
    }

    s.blocks.push({ x: nextX, w: nextW, hue });
    s.score += gained;

    const placedY = baseTop - BLOCK_H;
    const cx = nextX + nextW / 2;

    if (perfect) {
      playClearSound();
      triggerHaptic(26);
      f.shake.hit(3);
      f.particles.burst(cx, placedY + BLOCK_H / 2, 18, hue, 110);
      f.ripples.add(cx, placedY + BLOCK_H / 2, Math.max(24, nextW * 0.85), `hsl(${hue}, 92%, 72%)`);
      s.floaters.push({
        x: cx,
        y: placedY - 4,
        text: `Hoàn hảo! x${s.combo}`,
        color: '#fde68a',
        life: 0.95,
        maxLife: 0.95,
        rise: 26,
      });
      s.floaters.push({
        x: cx,
        y: placedY + 10,
        text: `+${gained}`,
        color: '#a7f3d0',
        life: 0.95,
        maxLife: 0.95,
        rise: 20,
      });
    } else {
      playScoreSound();
      triggerHaptic(16);
      f.shake.hit(3.5 + Math.min(7, missed * 0.2));
      const leftOver = Math.max(0, support.x - m.x);
      const rightOver = Math.max(0, m.x + m.w - (support.x + support.w));
      const cut = leftOver > 0 ? leftOver : rightOver;
      const vx = (leftOver > 0 ? -1 : 1) * (58 + Math.random() * 62);
      s.debris.push({
        x: leftOver > 0 ? m.x : support.x + support.w,
        y: placedY,
        w: cut,
        vx,
        vy: -90 - Math.random() * 40,
        rot: 0,
        vrot: (leftOver > 0 ? -1 : 1) * (1.8 + Math.random() * 2.4),
        hue: m.hue,
        life: 2.2,
      });
      f.particles.burst(leftOver > 0 ? m.x + cut / 2 : support.x + support.w + cut / 2, placedY + BLOCK_H / 2, 8, m.hue, 70);
      if (missed > 10) playBounceSound();
      if (nextW / m.w < POOR_RATIO) {
        s.floaters.push({
          x: cx,
          y: placedY - 4,
          text: `−${Math.round(missed)}`,
          color: '#fca5a5',
          life: 0.8,
          maxLife: 0.8,
          rise: 22,
        });
      }
    }

    s.cur = makeMover(s.blocks.length, nextW);
    setScore(s.score);
    setHeight(s.blocks.length);
    setCombo(s.combo);
    setBestCombo(s.bestCombo);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
        e.preventDefault();
        dropBlock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropBlock]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = createStarfield(W, H, 70, 0.4, 1.5);
    const clouds = [
      { x: W * 0.24, y: H * 0.3, r: 130, color: 'rgba(120, 72, 190, 0.20)', drift: 12 },
      { x: W * 0.78, y: H * 0.46, r: 150, color: 'rgba(226, 96, 140, 0.16)', drift: 16 },
      { x: W * 0.5, y: H * 0.16, r: 110, color: 'rgba(72, 132, 220, 0.14)', drift: 9 },
    ];
    let animId = 0;
    let last = performance.now();

    // Giữ đỉnh tháp ở vị trí CAM_ANCHOR (46% chiều cao canvas).
// Khi tháp cao lên, towerTopY giảm dần nên camera phải DỊCH NỘI DUNG XUỐNG,
// tức offset = H*CAM_ANCHOR - towerTopY. Công thức cũ lấy ngược dấu
// (towerTopY - H*CAM_ANCHOR) khiến toàn bộ gạch bị đẩy ra dưới màn hình.
const camY = (s: Sim): number => H * CAM_ANCHOR - towerTopY(s.blocks.length);

    const drawBackdrop = (time: number) => {
      ctx.fillStyle = linearGradient(ctx, 0, 0, 0, H, [
        [0, '#160c26'],
        [0.42, '#2b1540'],
        [0.74, '#5c2549'],
        [1, '#8d3a3c'],
      ]);
      ctx.fillRect(0, 0, W, H);

      const moonX = W * 0.78;
      const moonY = H * 0.14;
      ctx.fillStyle = radialGradient(ctx, moonX, moonY, 4, moonX, moonY, 62, [
        [0, 'rgba(255, 244, 214, 0.55)'],
        [0.4, 'rgba(255, 226, 178, 0.18)'],
        [1, 'rgba(255, 210, 150, 0)'],
      ]);
      ctx.beginPath();
      ctx.arc(moonX, moonY, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 247, 224, 0.85)';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 13, 0, Math.PI * 2);
      ctx.fill();

      drawNebula(ctx, W, H, time, clouds);
      drawStarfield(ctx, stars, time, { alpha: 0.72, driftY: 0.09, wrapAt: H, wrapW: W });
    };

    const drawBlock = (x: number, y: number, w: number, h: number, hue: number, alpha: number) => {
      const rad = Math.min(6, w / 4, h / 4);
      ctx.globalAlpha = alpha;

      // đổ bông
      ctx.fillStyle = 'rgba(10, 5, 18, 0.34)';
      roundRectPath(ctx, x + 2, y + 5, w, h, rad);
      ctx.fill();

      // thân gạch: nhiều chặng sắc cho có chiều sâu
      ctx.fillStyle = linearGradient(ctx, x, y, x, y + h, [
        [0, `hsl(${hue}, 90%, 76%)`],
        [0.18, `hsl(${hue}, 80%, 60%)`],
        [0.62, `hsl(${hue}, 68%, 44%)`],
        [1, `hsl(${hue}, 58%, 28%)`],
      ]);
      roundRectPath(ctx, x, y, w, h, rad);
      ctx.fill();

      ctx.save();
      roundRectPath(ctx, x, y, w, h, rad);
      ctx.clip();

      // mặt trên sáng -> tạo nổi
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.4);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h * 0.15);
      ctx.closePath();
      ctx.fill();

      // mặt dưới tối -> đáy nặng
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.72);
      ctx.lineTo(x + w, y + h * 0.72);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();

      // vết chân tường ngang
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.stroke();

      // đinh ốc vàng nhỏ thay cho các ô vuông cứng nhắc trước đây
      if (w > 46 && h > 12) {
        for (let i = 0; i < 3; i++) {
          const wx = x + w * (0.24 + i * 0.26);
          const wy = y + h * 0.34;
          ctx.fillStyle = 'rgba(253, 230, 138, 0.85)';
          ctx.beginPath();
          ctx.arc(wx, wy, 2.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(120, 70, 10, 0.35)';
          ctx.beginPath();
          ctx.arc(wx, wy + 1.6, 2.1, 0, Math.PI, true);
          ctx.fill();
        }
      }

      // vệt sáng chéo cho bề mặt bóng
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.12, y);
      ctx.lineTo(x + w * 0.5, y);
      ctx.lineTo(x + w * 0.18, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // viền ngoài sắc nét
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `hsla(${hue}, 92%, 86%, 0.5)`;
      ctx.lineWidth = 1;
      roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, rad);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawBase = (offset: number) => {
      const by = H - BASE_H + offset;
      ctx.fillStyle = 'rgba(8, 4, 16, 0.45)';
      ctx.beginPath();
      ctx.ellipse(W / 2, by + BASE_H + 2, BASE_W * 0.62, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = linearGradient(ctx, 0, by - 12, 0, by + BASE_H, [
        [0, 'rgba(148, 118, 214, 0.35)'],
        [1, 'rgba(38, 22, 62, 0.9)'],
      ]);
      roundRectPath(ctx, (W - BASE_W) / 2 - 18, by + BASE_H - 16, BASE_W + 36, 26, 12);
      ctx.fill();

      drawBlock((W - BASE_W) / 2, by, BASE_W, BASE_H, 262, 1);
    };

    const drawGuide = (s: Sim, offset: number) => {
      const m = s.cur;
      const top = towerTopY(s.blocks.length) + offset;
      const bx = m.x + m.w / 2;
      const by = towerTopY(s.blocks.length + 1) + offset;
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(bx, by + BLOCK_H);
      ctx.lineTo(bx, top);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx - 6, top - 3);
      ctx.lineTo(bx + 6, top - 3);
      ctx.stroke();
      ctx.restore();
    };

    const drawMoverShadow = (s: Sim, offset: number) => {
      const m = s.cur;
      const top = towerTopY(s.blocks.length) + offset;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'rgba(6, 3, 14, 1)';
      roundRectPath(ctx, m.x + 2, top + 2, m.w, BLOCK_H, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawWind = (s: Sim, time: number) => {
      const wind = s.cur.wind;
      if (Math.abs(wind) < 0.5) return;
      const sign = wind > 0 ? 1 : -1;
      const strength = Math.min(1, Math.abs(wind) / WIND_MAX);
      const pw = 84;
      const ph = 22;
      const px = W / 2 - pw / 2;
      const py = 14;
      ctx.fillStyle = 'rgba(12, 7, 24, 0.62)';
      roundRectPath(ctx, px, py, pw, ph, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.4)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, px, py, pw, ph, 11);
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Gió ${sign > 0 ? '→' : '←'} ${Math.abs(Math.round(wind))}`, W / 2, py + ph / 2 + 0.5);

      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const phase = ((time * 0.55 * sign + i * 0.33) % 1 + 1) % 1;
        const cx = sign > 0 ? phase * (W + 90) - 45 : W + 45 - phase * (W + 90);
        const len = 22 + strength * 34;
        const yy = 34 + i * 12;
        ctx.globalAlpha = 0.14 + strength * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, yy);
        ctx.lineTo(cx + sign * len, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const drawFloaters = (s: Sim) => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const fl of s.floaters) {
        const a = Math.max(0, fl.life / fl.maxLife);
        const y = fl.y - (1 - a) * fl.rise;
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = `800 16px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(10, 5, 18, 0.75)';
        ctx.strokeText(fl.text, fl.x, y);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, fl.x, y);
      }
      ctx.globalAlpha = 1;
    };

    const drawOverlays = (s: Sim, time: number) => {
      if (s.over) {
        ctx.fillStyle = 'rgba(9, 5, 16, 0.74)';
        roundRectPath(ctx, W / 2 - 158, H / 2 - 62, 316, 124, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
        ctx.lineWidth = 1.4;
        roundRectPath(ctx, W / 2 - 158, H / 2 - 62, 316, 124, 22);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fecaca';
        ctx.font = `800 30px ${FONT}`;
        ctx.fillText('Game Over', W / 2, H / 2 - 20);
        ctx.fillStyle = '#e9d5ff';
        ctx.font = `600 15px ${FONT}`;
        ctx.fillText(`Bạn xây được ${s.blocks.length} tầng`, W / 2, H / 2 + 14);
        return;
      }
      if (s.blocks.length === 0) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 3.2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#f5f3ff';
        ctx.font = `700 16px ${FONT}`;
        ctx.fillText('Chạm để thả khối', W / 2, H * 0.17);
        ctx.globalAlpha = pulse * 0.7;
        ctx.fillStyle = '#c4b5fd';
        ctx.font = `600 12px ${FONT}`;
        ctx.fillText('hoặc nhấn phím Space', W / 2, H * 0.17 + 20);
        ctx.globalAlpha = 1;
      }
    };

    const update = (dt: number) => {
      const s = simRef.current;
      if (s.over) {
        for (const d of s.debris) {
          d.vy += GRAVITY * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.rot += d.vrot * dt;
        }
        s.debris = s.debris.filter((d) => d.y < H + 80 && d.life > 0);
        return;
      }

      const m = s.cur;
      if (m.enter < 1) {
        m.enter = Math.min(1, m.enter + dt / ENTER_TIME);
      } else {
        m.x += (m.dir * m.speed + m.wind) * dt;
        const maxX = W - m.w;
        if (m.x <= 0) {
          m.x = 0;
          if (m.dir < 0) m.dir = 1;
        } else if (m.x >= maxX) {
          m.x = maxX;
          if (m.dir > 0) m.dir = -1;
        }
      }

      for (const d of s.debris) {
        d.vy += GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vrot * dt;
        d.life -= dt;
      }
      s.debris = s.debris.filter((d) => d.y < H + 80 && d.life > 0);

      for (const fl of s.floaters) fl.life -= dt;
      s.floaters = s.floaters.filter((fl) => fl.life > 0);

      fx.particles.update(dt);
      fx.ripples.update(dt);
      fx.shake.update(dt);
    };

    const draw = (time: number) => {
      const s = simRef.current;
      const offset = camY(s);
      const f = fxRef.current;

      drawBackdrop(time);

      ctx.save();
      if (f) f.shake.apply(ctx);

      drawBase(offset);
      drawGuide(s, offset);
      if (!s.over) drawMoverShadow(s, offset);

      for (let i = 0; i < s.blocks.length; i++) {
        const b = s.blocks[i];
        const y = towerTopY(i + 1) + offset;
        drawBlock(b.x, y, b.w, BLOCK_H, b.hue, 1);
      }

      if (!s.over) {
        const m = s.cur;
        const y = towerTopY(s.blocks.length + 1) + offset;
        drawBlock(m.x, y + (1 - m.enter) * 8, m.w, BLOCK_H, m.hue, Math.min(1, m.enter * 1.4));
      }

      for (const d of s.debris) {
        const a = clamp(d.life / 0.7, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(d.x + d.w / 2, d.y + BLOCK_H / 2);
        ctx.rotate(d.rot);
        drawBlock(-d.w / 2, -BLOCK_H / 2, d.w, BLOCK_H, d.hue, 1);
        ctx.restore();
      }

      if (f) {
        fx.ripples.draw(ctx);
        fx.particles.draw(ctx);
      }

      drawVignette(ctx, W, H, 0.5, 0.36);
      drawWind(s, time);
      drawFloaters(s);
      drawOverlays(s, time);

      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!pausedRef.current) update(dt);
      draw(now / 1000);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [fx]);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isVictory={false}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={resetGame}
      onBackToHub={onBackToHub}
      gameCustomStats={
        <div className="flex items-center gap-2 text-[11px] font-bold theme-text">
          <span className="px-2 py-1 rounded-xl theme-panel-soft border theme-border">
            Cao <span className="text-amber-400">{height} tầng</span>
          </span>
          <span className="px-2 py-1 rounded-xl theme-panel-soft border theme-border">
            Combo <span className="text-emerald-400">x{combo}</span>
          </span>
          <span className="px-2 py-1 rounded-xl theme-panel-soft border theme-border">
            Tốt nhất <span className="text-sky-400">x{bestCombo}</span>
          </span>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[520px] mx-auto">
        <div className="relative rounded-3xl p-2.5 w-full" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-color)' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={e => {
              e.preventDefault();
              dropBlock();
            }}
            className="w-full block rounded-2xl game-touch-zone cursor-pointer"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        <p className="mt-3 text-[11px] theme-muted text-center leading-relaxed">
          Chạm vào khung hoặc nhấn <span className="theme-text font-semibold">Space</span> để thả khối • Càng chồng
          chính xàng càng nhận thưởng combo
        </p>
      </div>
    </GameShell>
  );
};
