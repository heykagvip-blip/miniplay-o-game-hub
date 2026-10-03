import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playScoreSound, playGameOverSound, playClearSound, playBounceSound, triggerHaptic } from '../utils/sound';
import { Heart, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

const W = 480;
const H = 440;
const COLS = 8;
const ROWS = 4;
const SPACING_X = 44;
const SPACING_Y = 36;
const START_X = 60;
const START_Y = 50;

// --- Difficulty tuning (gentle: slower march, fewer bolts, roomier defenses) ---
const MAX_WAVE = 4;
const INITIAL_LIVES = 6;
const MAX_LIVES = 6;
const INVADER_SPEED_BASE = 24;
const INVADER_SPEED_PER_WAVE = 4;
const INVADER_SPEED_PER_KILL = 0.32;
const INVADER_SPEED_MAX = 76;
const INVADER_DROP_STEP = 9;
const PLAYER_SPEED = 320;
const PLAYER_FIRE_COOLDOWN = 0.17;
const PLAYER_MAX_BULLETS = 3;
const PLAYER_BULLET_SPEED = 520;
const PLAYER_HIT_TOLERANCE_X = 10;
const PLAYER_HIT_TOLERANCE_Y = 9;
const INVADER_HIT_TOLERANCE_X = 19;
const INVADER_HIT_TOLERANCE_Y = 17;
const ENEMY_BULLET_SPEED = 138;
const ENEMY_BULLET_MAX = 3;
const ENEMY_FIRE_MIN_DELAY = 1.5;
const ENEMY_FIRE_BASE_DELAY = 3.1;
const ENEMY_FIRE_DELAY_PER_WAVE = 0.05;
const DANGER_LINE_MARGIN = 66;
const SHIELD_COUNT = 4;
const SHIELD_CELL = 4;
const SHIELD_COLS = 13;
const SHIELD_ROWS = 7;
const SHIELD_Y = H - 82;

// --- Palette ---
const SPACE_INNER = '#182347';
const SPACE_MID = '#0d1428';
const SPACE_OUTER = '#04060d';
const PLANET_COLOR = 'rgba(129, 140, 248, 0.16)';
const PLANET_RING = 'rgba(165, 180, 252, 0.22)';
const PLAYER_COLOR = '#22d3ee';
const PLAYER_CORE = '#e0feff';
const PLAYER_LASER = '#fff7cc';
const PLAYER_LASER_GLOW = '#fbbf24';
const ENEMY_BOLT = '#fb7185';
const ENEMY_BOLT_GLOW = '#f43f5e';
const DANGER_LINE = 'rgba(248, 113, 113, 0.5)';
const GROUND_LINE = 'rgba(103, 232, 249, 0.35)';
const ROW_COLORS = ['#f472b6', '#c084fc', '#60a5fa', '#34d399'];

// Classic 1978 silhouettes, 2 animation frames each.
const ALIEN_FRAMES: string[][][] = [
  // Row 0 - squid
  [
    ['...11...', '..1111..', '.111111.', '11.11.11', '11111111', '.1.11.1.', '1.1..1.1', '.1....1.'],
    ['...11...', '..1111..', '.111111.', '11.11.11', '11111111', '.1.11.1.', '.11..11.', '..1..1..'],
  ],
  // Row 1 - crab
  [
    ['..1.....1..', '...1...1...', '..1111111..', '.11.111.11.', '11111111111', '1.1111111.1', '1.1.....1.1', '...11.11...'],
    ['..1.....1..', '..1.1.1.1..', '...11111...', '..1111111..', '.11.111.11.', '11111111111', '11.1...1.11', '...1.1.1...'],
  ],
  // Row 2 - octopus
  [
    ['....1111....', '.1111111111.', '111111111111', '111..11..111', '111111111111', '...1.11.1...', '..1.1111.1..', '11........11'],
    ['....1111....', '.1111111111.', '111111111111', '111..11..111', '111111111111', '..11.11.11..', '.11..11..11.', '1...1..1...1'],
  ],
  // Row 3 - crab (mirrored row)
  [
    ['..1.....1..', '...1...1...', '..1111111..', '.11.111.11.', '11111111111', '1.1111111.1', '1.1.....1.1', '...11.11...'],
    ['..1.....1..', '..1.1.1.1..', '...11111...', '..1111111..', '.11.111.11.', '11111111111', '11.1...1.11', '...1.1.1...'],
  ],
];
const SPRITE_CELL = 2.8;
const SPRITE_BOB = 1.4;

interface Invader { col: number; row: number; alive: boolean; }
interface Shot { x: number; y: number; }

interface Boom {
  x: number;
  y: number;
  t: number;
  color: string;
  scale: number;
}

interface Shield {
  ox: number;
  oy: number;
  cells: Uint8Array;
}

const SHIELD_SHAPE = [
  '..#########..',
  '.###########.',
  '#############',
  '###.......###',
  '##.........##',
  '#...........#',
  '#...........#',
];
const SHIELD_WIDTH = Math.max(...SHIELD_SHAPE.map(line => line.length));

export const SpaceInvadersGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('space-invaders')!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [wave, setWave] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const player = useRef({ x: W / 2, y: H - 30 });
  const keys = useRef({ left: false, right: false, fire: false });
  const invaders = useRef<Invader[]>([]);
  const offset = useRef({ x: 0, y: 0 });
  const dir = useRef(1);
  const bullets = useRef<Shot[]>([]);
  const eBullets = useRef<Shot[]>([]);
  const booms = useRef<Boom[]>([]);
  const shields = useRef<Shield[]>([]);
  const fireCd = useRef(0);
  const eFireCd = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(INITIAL_LIVES);
  const waveRef = useRef(1);
  const hurtFlash = useRef(0);
  const shake = useRef(0);
  const waveBanner = useRef(0);
  const mutedUntil = useRef(0);

  const buildShields = useCallback(() => {
    const span = W / SHIELD_COUNT;
    const cells = new Uint8Array(SHIELD_WIDTH * SHIELD_ROWS);
    SHIELD_SHAPE.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        if (line[x] === '#') cells[y * SHIELD_WIDTH + x] = 1;
      }
    });
    shields.current = Array.from({ length: SHIELD_COUNT }, (_, i) => ({
      ox: Math.round(span * i + span / 2 - (SHIELD_WIDTH * SHIELD_CELL) / 2),
      oy: SHIELD_Y,
      cells: cells.slice(),
    }));
  }, []);

  const buildWave = useCallback(() => {
    const list: Invader[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) list.push({ col: c, row: r, alive: true });
    invaders.current = list;
    offset.current = { x: 0, y: 0 };
    dir.current = 1;
    bullets.current = [];
    eBullets.current = [];
    booms.current = [];
    eFireCd.current = ENEMY_FIRE_BASE_DELAY;
    fireCd.current = 0;
    waveBanner.current = 1.6;
  }, []);

  const resetGame = useCallback(() => {
    player.current = { x: W / 2, y: H - 30 };
    scoreRef.current = 0;
    livesRef.current = INITIAL_LIVES;
    waveRef.current = 1;
    hurtFlash.current = 0;
    shake.current = 0;
    mutedUntil.current = 0;
    setScore(0);
    setLives(INITIAL_LIVES);
    setWave(1);
    setIsGameOver(false);
    setIsVictory(false);
    setIsPaused(false);
    buildShields();
    buildWave();
  }, [buildShields, buildWave]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.current.left = true;
      else if (['ArrowRight', 'KeyD'].includes(e.code)) keys.current.right = true;
      else if (e.code === 'Space') {
        keys.current.fire = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.current.left = false;
      else if (['ArrowRight', 'KeyD'].includes(e.code)) keys.current.right = false;
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

    const stars = [
      {
        speed: 1.2,
        alpha: 0.35,
        pts: Array.from({ length: 34 }, () => ({
          x: Math.random() * W,
          y: Math.random() * H * 0.78,
          r: 0.5 + Math.random() * 0.45,
          phase: Math.random() * Math.PI * 2,
        })),
      },
      {
        speed: 2.8,
        alpha: 0.6,
        pts: Array.from({ length: 26 }, () => ({
          x: Math.random() * W,
          y: Math.random() * H * 0.78,
          r: 0.9 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
        })),
      },
      {
        speed: 5.4,
        alpha: 0.9,
        pts: Array.from({ length: 10 }, () => ({
          x: Math.random() * W,
          y: Math.random() * H * 0.7,
          r: 1.4 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
        })),
      },
    ];

    const addBoom = (x: number, y: number, color: string, scale = 1) => {
      booms.current.push({ x, y, t: 0, color, scale });
      if (booms.current.length > 40) booms.current.shift();
    };

    const aliveList = () => invaders.current.filter(i => i.alive);
    const invX = (i: Invader) => START_X + i.col * SPACING_X + offset.current.x;
    const invY = (i: Invader) => START_Y + i.row * SPACING_Y + offset.current.y;

    // Destructible shields: carve a small blob out of a shield when a shot lands on it.
    const carveShield = (sx: number, sy: number, radius: number) => {
      for (const sh of shields.current) {
        const lx = Math.round((sx - sh.ox) / SHIELD_CELL);
        const ly = Math.round((sy - sh.oy) / SHIELD_CELL);
        // Bound to the actual cell grid (no radius halo): a shot outside the
        // shield's cells must fly past untouched instead of vanishing silently.
        if (lx < 0 || lx >= SHIELD_WIDTH) continue;
        if (ly < 0 || ly >= SHIELD_ROWS) continue;
        const rad = Math.ceil(radius);
        for (let dy = -rad; dy <= rad; dy++) {
          const y = ly + dy;
          if (y < 0 || y >= SHIELD_ROWS) continue;
          for (let dx = -rad; dx <= rad; dx++) {
            const x = lx + dx;
            if (x < 0 || x >= SHIELD_WIDTH) continue;
            if (Math.hypot(dx, dy) <= radius + 0.35) sh.cells[y * SHIELD_WIDTH + x] = 0;
          }
        }
        return true;
      }
      return false;
    };

    const update = (dt: number) => {
      const p = player.current;
      if (keys.current.left) p.x -= PLAYER_SPEED * dt;
      if (keys.current.right) p.x += PLAYER_SPEED * dt;
      p.x = Math.max(24, Math.min(W - 24, p.x));

      if (hurtFlash.current > 0) hurtFlash.current -= dt;
      if (shake.current > 0) shake.current = Math.max(0, shake.current - dt * 42);
      if (waveBanner.current > 0) waveBanner.current -= dt;
      if (mutedUntil.current > 0) mutedUntil.current -= dt;

      fireCd.current -= dt;
      if (
        keys.current.fire &&
        fireCd.current <= 0 &&
        bullets.current.length < PLAYER_MAX_BULLETS &&
        mutedUntil.current <= 0
      ) {
        fireCd.current = PLAYER_FIRE_COOLDOWN;
        bullets.current.push({ x: p.x, y: p.y - 18 });
        playBounceSound();
      }

      bullets.current.forEach(b => (b.y -= PLAYER_BULLET_SPEED * dt));
      eBullets.current.forEach(b => (b.y += ENEMY_BULLET_SPEED * dt));

      booms.current.forEach(b => (b.t += dt));
      booms.current = booms.current.filter(b => b.t < 0.5);

      const alive = aliveList();
      const speed = Math.min(
        INVADER_SPEED_MAX,
        INVADER_SPEED_BASE +
          waveRef.current * INVADER_SPEED_PER_WAVE +
          (ROWS * COLS - alive.length) * INVADER_SPEED_PER_KILL
      ) * dir.current;
      offset.current.x += speed * dt;

      let minX = Infinity;
      let maxX = -Infinity;
      alive.forEach(i => {
        minX = Math.min(minX, invX(i));
        maxX = Math.max(maxX, invX(i));
      });
      if (maxX > W - 22 && dir.current === 1) {
        dir.current = -1;
        offset.current.y += INVADER_DROP_STEP;
      } else if (minX < 22 && dir.current === -1) {
        dir.current = 1;
        offset.current.y += INVADER_DROP_STEP;
      }

      eFireCd.current -= dt;
      if (eFireCd.current <= 0 && alive.length > 0 && eBullets.current.length < ENEMY_BULLET_MAX) {
        eFireCd.current = Math.max(
          ENEMY_FIRE_MIN_DELAY,
          ENEMY_FIRE_BASE_DELAY - waveRef.current * ENEMY_FIRE_DELAY_PER_WAVE
        );
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        eBullets.current.push({ x: invX(shooter), y: invY(shooter) + 14 });
      }

      // Player shots vs shields, then invaders
      for (const b of bullets.current) {
        if (b.y < 0) continue;
        if (carveShield(b.x, b.y, 1.2)) {
          addBoom(b.x, b.y, 'rgba(125, 211, 252, 0.9)', 0.55);
          b.y = -100;
          continue;
        }
        for (const i of alive) {
          if (
            i.alive &&
            Math.abs(b.x - invX(i)) < INVADER_HIT_TOLERANCE_X &&
            Math.abs(b.y - invY(i)) < INVADER_HIT_TOLERANCE_Y
          ) {
            i.alive = false;
            const gain = (ROWS - i.row) * 10;
            scoreRef.current += gain;
            setScore(scoreRef.current);
            addBoom(b.x, invY(i), ROW_COLORS[i.row % ROW_COLORS.length], 1);
            playScoreSound();
            triggerHaptic(12);
            b.y = -100;
            break;
          }
        }
      }
      bullets.current = bullets.current.filter(b => b.y > -10);

      // Enemy shots vs shields, then player
      for (const b of eBullets.current) {
        if (b.y > H) continue;
        if (carveShield(b.x, b.y, 1.4)) {
          addBoom(b.x, b.y, 'rgba(125, 211, 252, 0.9)', 0.55);
          b.y = H + 100;
          continue;
        }
        if (Math.abs(b.x - p.x) < PLAYER_HIT_TOLERANCE_X && Math.abs(b.y - p.y) < PLAYER_HIT_TOLERANCE_Y) {
          b.y = H + 100;
          livesRef.current -= 1;
          setLives(livesRef.current);
          hurtFlash.current = 0.5;
          shake.current = 11;
          mutedUntil.current = 0.9;
          triggerHaptic(40);
          playGameOverSound();
          addBoom(p.x, p.y, '#22d3ee', 1.3);
          if (livesRef.current <= 0) setIsGameOver(true);
        }
      }
      eBullets.current = eBullets.current.filter(b => b.y < H + 10);

      if (alive.some(i => invY(i) >= p.y - 22)) setIsGameOver(true);

      if (alive.length === 0 && !isGameOver) {
        if (waveRef.current >= MAX_WAVE) {
          playClearSound();
          setIsVictory(true);
          setIsGameOver(true);
        } else {
          playClearSound();
          waveRef.current += 1;
          setWave(waveRef.current);
          buildWave();
        }
      }
    };

    const drawBackdrop = (time: number) => {
      const g = ctx.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H * 0.42, W * 0.82);
      g.addColorStop(0, SPACE_INNER);
      g.addColorStop(0.55, SPACE_MID);
      g.addColorStop(1, SPACE_OUTER);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Distant planet with ring, slowly drifting
      const px = W * 0.78 + Math.cos(time * 0.05) * 8;
      const py = H * 0.2 + Math.sin(time * 0.07) * 5;
      const pg = ctx.createRadialGradient(px - 12, py - 12, 4, px, py, 58);
      pg.addColorStop(0, 'rgba(199, 210, 254, 0.28)');
      pg.addColorStop(1, PLANET_COLOR);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PLANET_RING;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(px, py, 76, 16, -0.32, 0, Math.PI * 2);
      ctx.stroke();

      stars.forEach(layer => {
        layer.pts.forEach(st => {
          st.y += layer.speed * 0.35;
          if (st.y > H * 0.82) {
            st.y = -4;
            st.x = Math.random() * W;
          }
          const tw = 0.28 + 0.72 * Math.abs(Math.sin(time * 0.8 + st.phase));
          ctx.fillStyle = `rgba(214, 232, 255, ${(tw * layer.alpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.fillStyle = 'rgba(148, 197, 255, 0.03)';
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    };

    const drawGround = () => {
      const y = H - 62;
      const g = ctx.createLinearGradient(0, y, 0, H);
      g.addColorStop(0, 'rgba(14, 116, 144, 0.16)');
      g.addColorStop(1, 'rgba(8, 47, 73, 0.05)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, H - y);
      ctx.strokeStyle = GROUND_LINE;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
      // Ticks along the deck for a subtle arcade feel
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.16)';
      ctx.lineWidth = 1;
      for (let x = 8; x < W; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x, y + 9);
        ctx.stroke();
      }
    };

    const drawAlien = (cx: number, cy: number, row: number, frame: number) => {
      const frames = ALIEN_FRAMES[row % ALIEN_FRAMES.length];
      const sprite = frames[frame % frames.length];
      const spriteRows = sprite.length;
      const spriteCols = sprite[0].length;
      const left = cx - (spriteCols * SPRITE_CELL) / 2;
      const top = cy - (spriteRows * SPRITE_CELL) / 2 + Math.sin(frame * Math.PI) * SPRITE_BOB;

      const color = ROW_COLORS[row % ROW_COLORS.length];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      for (let r = 0; r < spriteRows; r++) {
        for (let c = 0; c < spriteCols; c++) {
          if (sprite[r][c] === '1') {
            ctx.fillRect(left + c * SPRITE_CELL, top + r * SPRITE_CELL, SPRITE_CELL + 0.4, SPRITE_CELL + 0.4);
          }
        }
      }
      ctx.restore();

      // Eyes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillRect(left + spriteCols * SPRITE_CELL * 0.3, top + spriteRows * SPRITE_CELL * 0.3, SPRITE_CELL, SPRITE_CELL);
      ctx.fillRect(left + spriteCols * SPRITE_CELL * 0.58, top + spriteRows * SPRITE_CELL * 0.3, SPRITE_CELL, SPRITE_CELL);
    };

    const drawShields = () => {
      shields.current.forEach(sh => {
        const width = sh.cells.length / SHIELD_ROWS;
        ctx.save();
        ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
        ctx.shadowBlur = 8;
        for (let y = 0; y < SHIELD_ROWS; y++) {
          for (let x = 0; x < width; x++) {
            if (!sh.cells[y * width + x]) continue;
            ctx.fillStyle = '#67e8f9';
            ctx.fillRect(sh.ox + x * SHIELD_CELL, sh.oy + y * SHIELD_CELL, SHIELD_CELL, SHIELD_CELL);
          }
        }
        ctx.restore();
      });
    };

    const drawBooms = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      booms.current.forEach(b => {
        const k = b.t / 0.5;
        const r = (7 + k * 20) * b.scale;
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + k;
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(a) * r * 0.35, b.y + Math.sin(a) * r * 0.35);
          ctx.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
          ctx.stroke();
        }
      });
      ctx.restore();
    };

    const drawPlayerBullets = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = PLAYER_LASER_GLOW;
      ctx.shadowBlur = 14;
      bullets.current.forEach(b => {
        const glow = ctx.createLinearGradient(b.x, b.y - 18, b.x, b.y + 8);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0)');
        glow.addColorStop(1, 'rgba(251, 191, 36, 0.55)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.roundRect(b.x - 4, b.y - 18, 8, 26, 4);
        ctx.fill();
        ctx.fillStyle = PLAYER_LASER;
        ctx.beginPath();
        ctx.roundRect(b.x - 1.7, b.y - 12, 3.4, 20, 1.7);
        ctx.fill();
      });
      ctx.restore();
    };

    const drawEnemyBullets = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = ENEMY_BOLT_GLOW;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = ENEMY_BOLT;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      eBullets.current.forEach(b => {
        const pulse = 1 + Math.sin(performance.now() / 40) * 0.12;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 8 * pulse);
        ctx.lineTo(b.x - 3.4, b.y - 2);
        ctx.lineTo(b.x + 3.4, b.y + 2);
        ctx.lineTo(b.x, b.y + 8 * pulse);
        ctx.stroke();
      });
      ctx.restore();
    };

    const drawPlayer = (time: number) => {
      const p = player.current;
      const flashing = hurtFlash.current > 0 && Math.floor(time / 0.085) % 2 === 0;

      ctx.save();
      if (!flashing) {
        ctx.shadowColor = PLAYER_COLOR;
        ctx.shadowBlur = 14;
      }
      const base = flashing ? 'rgba(34, 211, 238, 0.32)' : PLAYER_COLOR;
      ctx.fillStyle = base;

      // Cannon
      ctx.beginPath();
      ctx.roundRect(p.x - 3, p.y - 22, 6, 14, 2.4);
      ctx.fill();

      // Base plate
      ctx.beginPath();
      ctx.roundRect(p.x - 21, p.y + 6, 42, 8, 3.5);
      ctx.fill();

      // Hull
      const hull = ctx.createLinearGradient(p.x - 16, p.y - 10, p.x + 16, p.y + 10);
      hull.addColorStop(0, 'rgba(8, 145, 178, 0.95)');
      hull.addColorStop(0.5, '#22d3ee');
      hull.addColorStop(1, 'rgba(8, 145, 178, 0.95)');
      ctx.fillStyle = flashing ? 'rgba(34, 211, 238, 0.3)' : hull;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 18);
      ctx.lineTo(p.x + 16, p.y + 10);
      ctx.lineTo(p.x - 16, p.y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Panel shading + core light
      ctx.fillStyle = 'rgba(8, 20, 34, 0.45)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 18);
      ctx.lineTo(p.x + 7, p.y + 10);
      ctx.lineTo(p.x, p.y + 10);
      ctx.closePath();
      ctx.fill();

      const glow = 0.65 + 0.35 * Math.sin(time * 4);
      ctx.fillStyle = flashing ? 'rgba(224, 254, 255, 0.4)' : `rgba(224, 254, 255, ${glow.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 3.4, 0, Math.PI * 2);
      ctx.fill();

      // Engine wash
      ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createLinearGradient(p.x, p.y + 12, p.x, p.y + 26);
      eg.addColorStop(0, 'rgba(34, 211, 238, 0.4)');
      eg.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y + 12);
      ctx.lineTo(p.x + 9, p.y + 12);
      ctx.lineTo(p.x, p.y + 26 + Math.sin(time * 18) * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawDangerLine = () => {
      const p = player.current;
      const alive = aliveList();
      if (alive.length === 0) return;
      const lowest = Math.max(...alive.map(i => invY(i)));
      if (lowest < p.y - DANGER_LINE_MARGIN) return;

      ctx.save();
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -performance.now() / 60;
      ctx.strokeStyle = DANGER_LINE;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, p.y - 20);
      ctx.lineTo(W, p.y - 20);
      ctx.stroke();
      ctx.restore();
    };

    const drawWaveBanner = () => {
      if (waveBanner.current <= 0) return;
      const a = Math.min(1, waveBanner.current / 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
      ctx.font = '900 30px ui-sans-serif, system-ui, sans-serif';
      ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
      ctx.shadowBlur = 18;
      ctx.fillText(`ĐỢT ${waveRef.current}`, W / 2, H * 0.46);
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
      ctx.fillText('Hạ nhóm cuối cùng để chiến thắng!', W / 2, H * 0.46 + 22);
      ctx.restore();
    };

    const draw = () => {
      const time = performance.now() / 1000;
      ctx.save();
      if (shake.current > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake.current, (Math.random() - 0.5) * shake.current);
      }
      drawBackdrop(time);
      drawGround();
      drawDangerLine();

      const frame = Math.floor(time * 4) % 2;
      invaders.current.forEach(i => {
        if (!i.alive) return;
        drawAlien(invX(i), invY(i), i.row, frame);
      });

      drawShields();
      drawBooms();
      drawPlayerBullets();
      drawEnemyBullets();
      drawPlayer(time);
      drawWaveBanner();
      ctx.restore();

      const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.36, W / 2, H / 2, W * 0.78);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
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
  }, [isGameOver, isPaused, buildWave]);

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isVictory={isVictory}
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
            Đợt {wave}/{MAX_WAVE}
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center w-full max-w-[520px] mx-auto">
        <div className="relative rounded-3xl p-2.5 bg-slate-900 border border-slate-800 shadow-2xl w-full shadow-cyan-950/40">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full block rounded-2xl game-touch-zone shadow-inner"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 md:hidden w-full">
          <button
            onPointerDown={() => (keys.current.left = true)}
            onPointerUp={() => (keys.current.left = false)}
            onPointerLeave={() => (keys.current.left = false)}
            className="w-20 h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onPointerDown={() => (keys.current.fire = true)}
            onPointerUp={() => (keys.current.fire = false)}
            onPointerLeave={() => (keys.current.fire = false)}
            className="w-20 h-12 rounded-xl bg-indigo-600 border border-indigo-500 active:bg-indigo-500 flex items-center justify-center text-white game-btn-press"
          >
            <Zap className="w-5 h-5" />
          </button>
          <button
            onPointerDown={() => (keys.current.right = true)}
            onPointerUp={() => (keys.current.right = false)}
            onPointerLeave={() => (keys.current.right = false)}
            className="w-20 h-12 rounded-xl bg-slate-800 border border-slate-700 active:bg-indigo-600 flex items-center justify-center text-white game-btn-press"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-3 text-[11px] theme-muted text-center hidden md:block">
          ← → di chuyển • Space bắn
        </p>
      </div>
    </GameShell>
  );
};
