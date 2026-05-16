// Particles — struct-of-arrays pool, zero allocation in hot path

const MAX = 100;
const x = new Float32Array(MAX), y = new Float32Array(MAX);
const vx = new Float32Array(MAX), vy = new Float32Array(MAX);
const life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
const size = new Float32Array(MAX), grav = new Float32Array(MAX);
const r = new Uint8Array(MAX), g = new Uint8Array(MAX), b = new Uint8Array(MAX);
let count = 0;

function add(px, py, pvx, pvy, plife, psize, pr, pg, pb, pgrav) {
  let i = count < MAX ? count++ : 0; // overwrite oldest if full
  x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy;
  life[i] = maxLife[i] = plife; size[i] = psize;
  r[i] = pr; g[i] = pg; b[i] = pb; grav[i] = pgrav || 0;
}

export function update(dt) {
  for (let i = count - 1; i >= 0; i--) {
    life[i] -= dt;
    if (life[i] <= 0) { // swap-remove
      count--;
      x[i] = x[count]; y[i] = y[count]; vx[i] = vx[count]; vy[i] = vy[count];
      life[i] = life[count]; maxLife[i] = maxLife[count]; size[i] = size[count];
      r[i] = r[count]; g[i] = g[count]; b[i] = b[count]; grav[i] = grav[count];
      continue;
    }
    vy[i] += grav[i] * dt;
    x[i] += vx[i] * dt; y[i] += vy[i] * dt;
  }
}

export function draw(ctx, scrollX, UNIT, GROUND_LINE_Y) {
  for (let i = 0; i < count; i++) {
    const a = life[i] / maxLife[i];
    const s = size[i] * a;
    const sx = x[i] * UNIT - scrollX;
    const sy = GROUND_LINE_Y - y[i] * UNIT;
    if (sx < -20 || sx > 820) continue;
    ctx.fillStyle = `rgba(${r[i]},${g[i]},${b[i]},${a.toFixed(2)})`;
    ctx.fillRect(sx - s / 2 | 0, sy - s / 2 | 0, s | 0, s | 0);
  }
}

export function clear() { count = 0; }

// Emitter presets
function rng(lo, hi) { return lo + Math.random() * (hi - lo); }

export function emitDeath(px, py, cr, cg, cb) {
  for (let i = 0; i < 20; i++)
    add(px, py, rng(-8, 8), rng(-8, 8), rng(0.3, 0.6), rng(3, 8), cr, cg, cb, 30);
}

export function emitJump(px, py) {
  for (let i = 0; i < 4; i++)
    add(px, py, rng(-2, 2), rng(-3, -1), 0.3, rng(2, 4), 255, 255, 255, 20);
}

export function emitLand(px, py, cr, cg, cb) {
  for (let i = 0; i < 4; i++)
    add(px, py, rng(-3, 3), rng(-1, 0), 0.2, rng(2, 3), cr, cg, cb, 10);
}

export function emitOrb(px, py, cr, cg, cb) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(px, py, Math.cos(a) * 6, Math.sin(a) * 6, 0.3, rng(3, 5), cr, cg, cb, 0);
  }
}

export function emitCheckpoint(px, py) {
  for (let i = 0; i < 10; i++)
    add(px, py, rng(-2, 2), rng(-6, -2), 0.6, rng(2, 4), 255, 255, 0, 15);
}

export function emitTrail(px, py, cr, cg, cb) {
  add(px, py, -1, rng(-0.5, 0.5), 0.4, rng(2, 3), cr, cg, cb, 0);
}
