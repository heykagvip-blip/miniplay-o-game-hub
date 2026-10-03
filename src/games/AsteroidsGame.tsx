import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playScoreSound, playGameOverSound, playBounceSound, triggerHaptic } from '../utils/sound';
import { Heart, ChevronLeft, ChevronRight, ChevronUp, Zap } from 'lucide-react';

const W = 480;
const H = 480;

// --- Difficulty tuning (gentle: capped rock speed, wide forgiveness windows) ---
const INITIAL_LIVES = 6;
const MAX_LIVES = 6;
const SPAWN_INVULNERABLE = 3.2;
const RESPAWN_INVULNERABLE = 3.6;
const FIRE_COOLDOWN = 0.11;
const BULLET_SPEED = 460;
const BULLET_LIFE = 1.35;
const BULLET_HIT_PADDING = 7;
const SHIP_HIT_PADDING = -1;
const SHIP_ACCELERATION = 300;
const SHIP_DRAG = 0.8;
const TURN_SPEED = 3.8;
const ROCKS_AT_LEVEL_ONE = 2;
const ROCKS_PER_LEVEL = 1;
const ROCKS_MAX = 6;
const ROCK_SPEED_BASE = 17;
const ROCK_SPEED_PER_LEVEL = 3.5;
const ROCK_SPEED_MAX = 34;
const SPLIT_SPEED_BASE = 30;
const SPLIT_SPEED_RANDOM = 20;
const CLEAR_RADIUS_ON_RESPAWN = 96;
const MAX_PARTICLES = 260;
const MAX_RINGS = 14;

// --- Palette ---
const SPACE_INNER = '#1b2748';
const SPACE_MID = '#111a33';
const SPACE_OUTER = '#05070f';
const NEBULA_A = 'rgba(56, 189, 248, 0.09)';
const NEBULA_B = 'rgba(168, 85, 247, 0.08)';
const NEBULA_C = 'rgba(244, 114, 182, 0.05)';
const ROCK_LIGHT = '#c7d6f0';
const ROCK_MID = '#7f8fb3';
const ROCK_DARK = '#39466a';
const SHIP_COLOR = '#5eead4';
const SHIP_HULL = '#0d2c33';
const SHIP_COCKPIT = '#a5f3fc';
const FLAME_OUTER = '#fb923c';
const FLAME_INNER = '#fde68a';
const BULLET_CORE = '#fffbeb';
const BULLET_GLOW = '#fbbf24';

const SIZE_RADIUS: Record<number, number> = { 3: 40, 2: 24, 1: 13.5 };

interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  size: number;
  rot: number;
  spin: number;
  shape: number[];
  tint: number;
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}
interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export const AsteroidsGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('asteroids')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const ship = useRef({ x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 0 });
  const rocks = useRef<Rock[]>([]);
  const bullets = useRef<Bullet[]>([]);
  const particles = useRef<Particle[]>([]);
  const rings = useRef<Ring[]>([]);
  const keys = useRef({ left: false, right: false, thrust: false, fire: false });
  const fireCd = useRef(0);
  const shake = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(INITIAL_LIVES);
  const levelRef = useRef(1);

  const makeRock = useCallback((x: number, y: number, size: number, speed: number): Rock => {
    const angle = Math.random() * Math.PI * 2;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: SIZE_RADIUS[size] ?? 14,
      size,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.1,
      shape: Array.from({ length: 10 }, () => 0.68 + Math.random() * 0.54),
      tint: Math.random(),
    };
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, hue: number, power: number) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random()) * power;
      const life = 0.28 + Math.random() * 0.42;
      particles.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        size: 1.2 + Math.random() * 2.2,
        hue: hue + (Math.random() - 0.5) * 26,
      });
    }
    if (particles.current.length > MAX_PARTICLES) particles.current.splice(0, particles.current.length - MAX_PARTICLES);
  }, []);

  const spawnRing = useCallback((x: number, y: number, maxR: number, color: string) => {
    rings.current.push({ x, y, r: 4, maxR, life: 0.42, maxLife: 0.42, color });
    if (rings.current.length > MAX_RINGS) rings.current.shift();
  }, []);

  const spawnLevel = useCallback(
    (lvl: number) => {
      const count = Math.min(ROCKS_MAX, ROCKS_AT_LEVEL_ONE + (lvl - 1) * ROCKS_PER_LEVEL);
      const speed = Math.min(ROCK_SPEED_MAX, ROCK_SPEED_BASE + (lvl - 1) * ROCK_SPEED_PER_LEVEL);
      const list: Rock[] = [];
      for (let i = 0; i < count; i++) {
        let x = 0;
        let y = 0;
        if (Math.random() > 0.5) {
          x = Math.random() * W;
          y = Math.random() > 0.5 ? 0 : H;
        } else {
          x = Math.random() > 0.5 ? 0 : W;
          y = Math.random() * H;
        }
        list.push(makeRock(x, y, 3, speed));
      }
      rocks.current = list;
    },
    [makeRock]
  );

  const clearAsteroidsNear = useCallback(
    (x: number, y: number, radius: number) => {
      rocks.current = rocks.current.filter(r => {
        if (Math.hypot(r.x - x, r.y - y) >= radius) return true;
        spawnParticles(r.x, r.y, 8, 200, 46);
        return false;
      });
    },
    [spawnParticles]
  );

  const resetGame = useCallback(() => {
    ship.current = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: SPAWN_INVULNERABLE };
    bullets.current = [];
    particles.current = [];
    rings.current = [];
    scoreRef.current = 0;
    livesRef.current = INITIAL_LIVES;
    levelRef.current = 1;
    fireCd.current = 0;
    shake.current = 0;
    setScore(0);
    setLives(INITIAL_LIVES);
    setLevel(1);
    setIsGameOver(false);
    setIsPaused(false);
    spawnLevel(1);
  }, [spawnLevel]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.current.left = true;
      else if (['ArrowRight', 'KeyD'].includes(e.code)) keys.current.right = true;
      else if (['ArrowUp', 'KeyW'].includes(e.code)) keys.current.thrust = true;
      else if (e.code === 'Space') {
        keys.current.fire = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.current.left = false;
      else if (['ArrowRight', 'KeyD'].includes(e.code)) keys.current.right = false;
      else if (['ArrowUp', 'KeyW'].includes(e.code)) keys.current.thrust = false;
      else if (e.code === 'Space') keys.current.fire = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let last = performance.now();

    // Three parallax star layers, each with its own drift speed.
    const starLayers = [
      { count: 46, r: [0.5, 0.9], speed: 0.35, alpha: 0.4 },
      { count: 34, r: [0.8, 1.4], speed: 0.8, alpha: 0.62 },
      { count: 16, r: [1.3, 2.1], speed: 1.6, alpha: 0.9 },
    ].map(layer => ({
      ...layer,
      stars: Array.from({ length: layer.count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: layer.r[0] + Math.random() * (layer.r[1] - layer.r[0]),
        phase: Math.random() * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.6,
      })),
    }));

    const drift = (angle: number, speed: number, dt: number) => {
      starLayers.forEach(layer => {
        layer.stars.forEach(st => {
          st.x += Math.cos(angle) * speed * st.speed * dt;
          st.y += Math.sin(angle) * speed * st.speed * dt;
          if (st.x < 0) st.x += W;
          if (st.x > W) st.x -= W;
          if (st.y < 0) st.y += H;
          if (st.y > H) st.y -= H;
        });
      });
    };

    const update = (dt: number) => {
      const s = ship.current;
      if (keys.current.left) s.a -= TURN_SPEED * dt;
      if (keys.current.right) s.a += TURN_SPEED * dt;
      if (keys.current.thrust) {
        s.vx += Math.cos(s.a) * SHIP_ACCELERATION * dt;
        s.vy += Math.sin(s.a) * SHIP_ACCELERATION * dt;
        spawnParticles(
          s.x - Math.cos(s.a) * 12,
          s.y - Math.sin(s.a) * 12,
          1,
          28,
          26
        );
      }
      s.vx *= 1 - SHIP_DRAG * dt;
      s.vy *= 1 - SHIP_DRAG * dt;
      const prevX = s.x;
      const prevY = s.y;
      s.x = (s.x + s.vx * dt + W) % W;
      s.y = (s.y + s.vy * dt + H) % H;
      const moved = Math.hypot(s.x - prevX, s.y - prevY);
      if (moved > 0.4) drift(Math.atan2(s.y - prevY, s.x - prevX), 14, dt);
      if (s.inv > 0) s.inv -= dt;

      fireCd.current -= dt;
      if (keys.current.fire && fireCd.current <= 0) {
        fireCd.current = FIRE_COOLDOWN;
        const mx = s.x + Math.cos(s.a) * 15;
        const my = s.y + Math.sin(s.a) * 15;
        bullets.current.push({
          x: mx,
          y: my,
          vx: Math.cos(s.a) * BULLET_SPEED + s.vx,
          vy: Math.sin(s.a) * BULLET_SPEED + s.vy,
          life: BULLET_LIFE,
        });
        spawnRing(mx, my, 11, 'rgba(253, 230, 138, 0.75)');
        playBounceSound();
      }

      bullets.current.forEach(b => {
        b.x = (b.x + b.vx * dt + W) % W;
        b.y = (b.y + b.vy * dt + H) % H;
        b.life -= dt;
      });
      bullets.current = bullets.current.filter(b => b.life > 0);

      rocks.current.forEach(r => {
        r.x = (r.x + r.vx * dt + W) % W;
        r.y = (r.y + r.vy * dt + H) % H;
        r.rot += r.spin * dt;
      });

      const newRocks: Rock[] = [];
      for (const r of rocks.current) {
        let destroyed = false;
        for (const b of bullets.current) {
          if (b.life > 0 && Math.hypot(b.x - r.x, b.y - r.y) < r.r + BULLET_HIT_PADDING) {
            b.life = 0;
            destroyed = true;
            const gain = r.size === 3 ? 20 : r.size === 2 ? 50 : 100;
            scoreRef.current += gain;
            setScore(scoreRef.current);
            playScoreSound();
            spawnParticles(r.x, r.y, 10 + r.size * 3, 205, 60 + r.size * 14);
            spawnRing(r.x, r.y, r.r * 2.4, 'rgba(226, 240, 255, 0.6)');
            shake.current = Math.min(9, shake.current + 1.6);
            if (r.size > 1) {
              for (let k = 0; k < 2; k++) {
                newRocks.push(makeRock(r.x, r.y, r.size - 1, SPLIT_SPEED_BASE + Math.random() * SPLIT_SPEED_RANDOM));
              }
            }
            break;
          }
        }
        if (!destroyed) newRocks.push(r);
      }
      bullets.current = bullets.current.filter(b => b.life > 0);
      rocks.current = newRocks;

      for (const r of rocks.current) {
        if (s.inv <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + SHIP_HIT_PADDING) {
          livesRef.current -= 1;
          setLives(livesRef.current);
          triggerHaptic(40);
          playGameOverSound();
          spawnParticles(s.x, s.y, 34, 190, 150);
          spawnRing(s.x, s.y, 90, 'rgba(251, 113, 133, 0.75)');
          shake.current = 16;
          s.x = W / 2;
          s.y = H / 2;
          s.vx = 0;
          s.vy = 0;
          s.a = -Math.PI / 2;
          s.inv = RESPAWN_INVULNERABLE;
          // Classic mercy rule: clear whatever surrounds the respawn point.
          clearAsteroidsNear(s.x, s.y, CLEAR_RADIUS_ON_RESPAWN);
          if (livesRef.current <= 0) setIsGameOver(true);
          break;
        }
      }

      if (rocks.current.length === 0) {
        levelRef.current += 1;
        setLevel(levelRef.current);
        spawnParticles(W / 2, H / 2, 26, 165, 90);
        spawnLevel(levelRef.current);
      }

      particles.current.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 1.7 * dt;
        p.vy *= 1 - 1.7 * dt;
        p.life -= dt;
      });
      particles.current = particles.current.filter(p => p.life > 0);

      rings.current.forEach(rg => {
        rg.life -= dt;
        rg.r += (rg.maxR - rg.r) * Math.min(1, dt * 12);
      });
      rings.current = rings.current.filter(rg => rg.life > 0);

      if (shake.current > 0) shake.current = Math.max(0, shake.current - dt * 34);
    };

    const drawBackdrop = (time: number) => {
      const g = ctx.createRadialGradient(W / 2, H * 0.46, 20, W / 2, H / 2, W * 0.82);
      g.addColorStop(0, SPACE_INNER);
      g.addColorStop(0.55, SPACE_MID);
      g.addColorStop(1, SPACE_OUTER);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const clouds = [
        { x: W * 0.24, y: H * 0.2, r: 168, c: NEBULA_A, drift: 2.4 },
        { x: W * 0.78, y: H * 0.34, r: 190, c: NEBULA_B, drift: -1.9 },
        { x: W * 0.52, y: H * 0.84, r: 172, c: NEBULA_C, drift: 1.4 },
      ];
      clouds.forEach((cl, i) => {
        const cx = (cl.x + Math.cos(time * 0.04 + i) * 14) % W;
        const cy = (cl.y + Math.sin(time * 0.05 + i) * 10) % H;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cl.r);
        grd.addColorStop(0, cl.c);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, cl.r, 0, Math.PI * 2);
        ctx.fill();
      });

      starLayers.forEach(layer => {
        layer.stars.forEach(st => {
          const twinkle = 0.32 + 0.68 * Math.abs(Math.sin(time * 0.85 + st.phase));
          ctx.fillStyle = `rgba(226, 238, 255, ${(twinkle * layer.alpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.fillStyle = 'rgba(190, 214, 255, 0.9)';
      starLayers[2].stars.forEach((st, i) => {
        if (i % 3 !== 0) return;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.85 + st.phase));
        ctx.strokeStyle = `rgba(214, 232, 255, ${(twinkle * 0.5).toFixed(3)})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(st.x - st.r * 4, st.y);
        ctx.lineTo(st.x + st.r * 4, st.y);
        ctx.moveTo(st.x, st.y - st.r * 4);
        ctx.lineTo(st.x, st.y + st.r * 4);
        ctx.stroke();
      });
    };

    const drawRocks = () => {
      rocks.current.forEach(r => {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);

        const pts = r.shape.map((m, i) => {
          const ang = (i / r.shape.length) * Math.PI * 2;
          return { x: Math.cos(ang) * r.r * m, y: Math.sin(ang) * r.r * m } as const;
        });

        const trace = () => {
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
        };

        // Soft outer glow for large rocks
        if (r.size >= 2) {
          ctx.shadowColor = `rgba(127, 143, 179, ${0.22 + r.tint * 0.12})`;
          ctx.shadowBlur = 16;
        }

        const grd = ctx.createLinearGradient(-r.r, -r.r, r.r, r.r);
        grd.addColorStop(0, ROCK_DARK);
        grd.addColorStop(0.5, ROCK_MID);
        grd.addColorStop(1, ROCK_LIGHT);
        trace();
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rim light on the leading edge
        ctx.save();
        trace();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3.2;
        trace();
        ctx.stroke();

        const craterCount = r.size === 3 ? 3 : r.size === 2 ? 2 : 1;
        const seed = r.tint * 6.28;
        for (let i = 0; i < craterCount; i++) {
          const ang = seed + i * 2.1;
          const dist = r.r * (0.18 + i * 0.16);
          const cr = Math.max(1.6, r.r * (0.2 - i * 0.04));
          const cgrd = ctx.createRadialGradient(
            Math.cos(ang) * dist,
            Math.sin(ang) * dist,
            cr * 0.2,
            Math.cos(ang) * dist,
            Math.sin(ang) * dist,
            cr
          );
          cgrd.addColorStop(0, 'rgba(20, 27, 48, 0.55)');
          cgrd.addColorStop(1, 'rgba(148, 163, 184, 0.05)');
          ctx.fillStyle = cgrd;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, cr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        ctx.strokeStyle = ROCK_LIGHT;
        ctx.lineWidth = 1.8;
        trace();
        ctx.stroke();
        ctx.restore();
      });
    };

    const drawParticles = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      particles.current.forEach(p => {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = `hsla(${p.hue}, 95%, ${58 + a * 24}%, ${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const drawRings = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      rings.current.forEach(rg => {
        const a = Math.max(0, rg.life / rg.maxLife);
        ctx.strokeStyle = rg.color.replace(/[\d.]+\)$/, `${(a * 0.7).toFixed(3)})`);
        ctx.lineWidth = 1.6 + a * 1.6;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    };

    const drawBullets = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = BULLET_GLOW;
      ctx.shadowBlur = 14;
      bullets.current.forEach(b => {
        const tailLen = 0.026;
        const g = ctx.createLinearGradient(b.x - b.vx * tailLen, b.y - b.vy * tailLen, b.x, b.y);
        g.addColorStop(0, 'rgba(251, 191, 36, 0)');
        g.addColorStop(1, 'rgba(251, 191, 36, 0.85)');
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * tailLen, b.y - b.vy * tailLen);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = BULLET_CORE;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.9, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const drawShip = (time: number) => {
      const s = ship.current;
      if (s.inv > 0 && Math.floor(time / 0.1) % 2 !== 0) return;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);

      if (keys.current.thrust) {
        const flicker = 0.72 + Math.random() * 0.55;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(-9, 0, 8 * flicker, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = FLAME_OUTER;
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-21 * flicker, 0);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = FLAME_INNER;
        ctx.beginPath();
        ctx.moveTo(-8, -2.3);
        ctx.lineTo(-13.5 * flicker, 0);
        ctx.lineTo(-8, 2.3);
        ctx.closePath();
        ctx.fill();
      }

      // Hull with gradient + neon outline
      const hull = ctx.createLinearGradient(-12, -10, 14, 10);
      hull.addColorStop(0, '#123c44');
      hull.addColorStop(0.5, SHIP_HULL);
      hull.addColorStop(1, '#0a2126');
      ctx.shadowColor = SHIP_COLOR;
      ctx.shadowBlur = 16;
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = SHIP_COLOR;
      ctx.lineWidth = 2.1;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Wing highlight
      ctx.fillStyle = 'rgba(94, 234, 212, 0.25)';
      ctx.beginPath();
      ctx.moveTo(11, -1.6);
      ctx.lineTo(-8, -7.2);
      ctx.lineTo(-5, -2.6);
      ctx.closePath();
      ctx.fill();

      // Engine nozzles
      ctx.fillStyle = '#0b3b42';
      ctx.beginPath();
      ctx.roundRect(-12, -6.4, 4, 4.2, 1.4);
      ctx.roundRect(-12, 2.2, 4, 4.2, 1.4);
      ctx.fill();

      // Cockpit
      const glass = ctx.createRadialGradient(2, -1, 0.4, 2.5, 0, 4.2);
      glass.addColorStop(0, '#ffffff');
      glass.addColorStop(1, SHIP_COCKPIT);
      ctx.fillStyle = glass;
      ctx.beginPath();
      ctx.arc(2.5, 0, 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawVignette = () => {
      const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.34, W / 2, H / 2, W * 0.76);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    };

    const draw = () => {
      const time = performance.now() / 1000;
      ctx.save();
      if (shake.current > 0.2) {
        ctx.translate(
          (Math.random() - 0.5) * shake.current,
          (Math.random() - 0.5) * shake.current
        );
      }
      drawBackdrop(time);
      drawRocks();
      drawRings();
      drawBullets();
      drawParticles();
      drawShip(time);
      ctx.restore();
      drawVignette();
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
  }, [isGameOver, isPaused, makeRock, spawnLevel, spawnParticles, spawnRing, clearAsteroidsNear]);

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
            Màn {level}
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[520px] mx-auto">
        <div className="relative rounded-3xl p-2.5 bg-slate-900 border border-slate-800 shadow-2xl w-full shadow-indigo-950/40">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full aspect-square block rounded-2xl game-touch-zone shadow-inner"
          />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3 w-full max-w-sm md:hidden">
          <button
            onPointerDown={() => (keys.current.left = true)}
            onPointerUp={() => (keys.current.left = false)}
            onPointerLeave={() => (keys.current.left = false)}
            className="h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onPointerDown={() => (keys.current.thrust = true)}
            onPointerUp={() => (keys.current.thrust = false)}
            onPointerLeave={() => (keys.current.thrust = false)}
            className="h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onPointerDown={() => (keys.current.right = true)}
            onPointerUp={() => (keys.current.right = false)}
            onPointerLeave={() => (keys.current.right = false)}
            className="h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onPointerDown={() => (keys.current.fire = true)}
            onPointerUp={() => (keys.current.fire = false)}
            onPointerLeave={() => (keys.current.fire = false)}
            className="h-12 rounded-xl bg-indigo-600 border border-indigo-500 active:bg-indigo-500 flex items-center justify-center text-white game-btn-press"
          >
            <Zap className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-3 text-[11px] theme-muted text-center hidden md:block">
          ← → xoay tàu • ↑ đẩy • Space bắn
        </p>
      </div>
    </GameShell>
  );
};
