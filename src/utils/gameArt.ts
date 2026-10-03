// Shared canvas art helpers for MiniPlay games.
//
// These are deliberately dependency-free and canvas-agnostic: every game here
// renders to a plain 2D context, so a few small helpers avoid repeating the
// same backdrop / particle / shake boilerplate in two dozen files.

export interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

export interface Ripple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

/** True when the app is currently using the light theme. */
export function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('light');
}

export function createStarfield(
  w: number,
  h: number,
  count: number,
  minR = 0.5,
  maxR = 1.6
): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: minR + Math.random() * (maxR - minR),
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 0.8,
  }));
}

/**
 * Draws a parallax starfield. `driftY` scrolls the field downward (px/frame),
 * used for games that scroll vertically.
 */
export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  time: number,
  opts: { alpha?: number; driftY?: number; wrapAt?: number; wrapW?: number } = {}
): void {
  const { alpha = 0.75, driftY = 0, wrapAt, wrapW = 0 } = opts;
  for (const st of stars) {
    if (driftY !== 0) {
      st.y += driftY * st.speed;
      if (wrapAt && st.y > wrapAt) {
        st.y = -4;
        st.x = Math.random() * wrapW;
      }
    }
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.85 + st.phase));
    ctx.fillStyle = `rgba(226, 238, 255, ${(twinkle * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Three-stop radial space backdrop. */
export function drawSpaceGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inner: string,
  outer: string,
  cx = w / 2,
  cy = h / 2
): void {
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawNebula(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  clouds: { x: number; y: number; r: number; color: string; drift?: number }[]
): void {
  clouds.forEach((cl, i) => {
    const cx = cl.x + Math.cos(time * 0.04 + i) * (cl.drift ?? 10);
    const cy = cl.y + Math.sin(time * 0.05 + i) * (cl.drift ?? 10);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cl.r);
    g.addColorStop(0, cl.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, cl.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength = 0.45,
  innerStop = 0.34
): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * innerStop, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Alternating two-tone checkerboard, used for boards and playfields. */
export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: number,
  colorA: string,
  colorB: string
): void {
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
}

/**
 * A reusable particle pool. Games push bursts on events and the system keeps
 * itself bounded, so long sessions cannot grow the array without limit.
 */
export function createParticleSystem(max = 260) {
  const particles: Particle[] = [];
  return {
    burst(x: number, y: number, count: number, hue: number, power = 60): void {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.3 + Math.random()) * power;
        const life = 0.28 + Math.random() * 0.42;
        particles.push({
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
      if (particles.length > max) particles.splice(0, particles.length - max);
    },
    update(dt: number): void {
      const drag = 1 - 1.7 * dt;
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= drag;
        p.vy *= drag;
        p.life -= dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].life <= 0) particles.splice(i, 1);
      }
    },
    draw(ctx: CanvasRenderingContext2D): void {
      if (particles.length === 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = `hsla(${p.hue}, 95%, ${58 + a * 24}%, ${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    clear(): void {
      particles.length = 0;
    },
    get count(): number {
      return particles.length;
    },
  };
}

/** Expanding shockwave rings, drawn additively. */
export function createRippleSystem(max = 14) {
  const ripples: Ripple[] = [];
  return {
    add(x: number, y: number, maxR: number, color: string): void {
      ripples.push({ x, y, r: 4, maxR, life: 0.42, maxLife: 0.42, color });
      if (ripples.length > max) ripples.shift();
    },
    update(dt: number): void {
      for (const rg of ripples) {
        rg.life -= dt;
        rg.r += (rg.maxR - rg.r) * Math.min(1, dt * 12);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (ripples[i].life <= 0) ripples.splice(i, 1);
      }
    },
    draw(ctx: CanvasRenderingContext2D): void {
      if (ripples.length === 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const rg of ripples) {
        // globalAlpha keeps the caller's colour format untouched.
        ctx.globalAlpha = Math.max(0, rg.life / rg.maxLife) * 0.75;
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = 1.6 + ctx.globalAlpha * 1.6;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
    clear(): void {
      ripples.length = 0;
    },
  };
}

/** Decaying screen shake with a random offset applied per frame. */
export function createShake() {
  let amount = 0;
  return {
    hit(power: number): void {
      amount = Math.max(amount, power);
    },
    apply(ctx: CanvasRenderingContext2D): void {
      if (amount <= 0.2) return;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    },
    update(dt: number): void {
      if (amount > 0) amount = Math.max(0, amount - dt * 34);
    },
    reset(): void {
      amount = 0;
    },
    get value(): number {
      return amount;
    },
  };
}

/** Rounded-rect path helper (ctx.roundRect is not available everywhere). */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Linear gradient shorthand taking colour stops as `[offset, color]` pairs. */
export function linearGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][]
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

/** Radial gradient shorthand. */
export function radialGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r0: number,
  cx1: number,
  cy1: number,
  r1: number,
  stops: [number, string][]
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, r0, cx1, cy1, r1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}