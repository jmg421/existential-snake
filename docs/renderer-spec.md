# Renderer Technical Design Specification

**Project:** skibidi-things (browser-based Geometry Dash clone)
**Canvas:** 800×400, 2D context
**Target:** 60fps on 2020 mobile browser
**Date:** 2026-05-01

---

## Current State & Problems

The existing `gd-renderer.js` is a single 189-line `render()` function. Key issues:

1. **Ground uses `SLOPE = 0.06`** — draws an angled line. GD ground is flat.
2. **No layer separation** — everything draws in one pass with implicit ordering.
3. **Uses `ctx.shadowBlur`** for glow on every spike/pad/player — expensive, inconsistent.
4. **No particle system** — death is just a red overlay, no explosion.
5. **No player trail, squash/stretch, or proper rotation** — rotation is continuous `+= 360 * dt` instead of 90° per jump arc.
6. **No parallax, no beat pulse, no object shadows** — visually flat.
7. **Color strings built inline** — `rgb(${r},${g},${b})` in hot path every frame.

---

## 1. Layer System

Rendering order, back to front. Each layer is a function called in sequence — not separate canvases (one canvas is fine at 800×400).

### Layer 0: Background Gradient

| Property | Value |
|----------|-------|
| Draws | Vertical linear gradient from `bg` color (top) to darker variant (bottom) |
| Scroll | None |
| Opacity | 1.0 |
| Blend | `source-over` (default) |

**Implementation:**
```js
// Cache gradient — only recreate when bg color changes
let bgGradCache = null;
let bgGradKey = '';

function drawBackground(ctx, bg) {
  const key = `${bg[0]|0},${bg[1]|0},${bg[2]|0}`;
  if (key !== bgGradKey) {
    bgGradCache = ctx.createLinearGradient(0, 0, 0, CH);
    bgGradCache.addColorStop(0, rgbStr(bg[0], bg[1], bg[2]));
    bgGradCache.addColorStop(1, rgbStr(bg[0] * 0.4 | 0, bg[1] * 0.4 | 0, bg[2] * 0.4 | 0));
    bgGradKey = key;
  }
  ctx.fillStyle = bgGradCache;
  ctx.fillRect(0, 0, CW, CH);
}
```

### Layer 1: Far Parallax (Stars/Shapes)

| Property | Value |
|----------|-------|
| Draws | 30-50 small dots/diamonds, seeded positions |
| Scroll | `scrollX * 0.05` (very slow) |
| Opacity | 0.15–0.4 per element, pulse on beat |
| Blend | `source-over` |

**Implementation:**
```js
// Pre-generate star positions once per level load (not per frame)
const FAR_STARS = []; // {x, y, size, baseAlpha} — filled on level load

function initFarStars(levelWidthPx) {
  FAR_STARS.length = 0;
  for (let i = 0; i < 40; i++) {
    FAR_STARS.push({
      x: Math.random() * (levelWidthPx * 0.05 + CW),
      y: Math.random() * (GROUND_Y - 20),
      size: 1 + Math.random() * 2 | 0,
      baseAlpha: 0.15 + Math.random() * 0.25,
    });
  }
}

function drawFarParallax(ctx, scrollX, beatFrac) {
  const offset = (scrollX * 0.05) | 0;
  const pulse = 1 + Math.max(0, 1 - beatFrac) * 0.3; // beatFrac = beat() % 1
  for (let i = 0; i < FAR_STARS.length; i++) {
    const s = FAR_STARS[i];
    const sx = ((s.x - offset) % (CW + 40)) - 20;
    if (sx < -5 || sx > CW + 5) continue;
    ctx.fillStyle = starColors[i & 3]; // pre-computed rgba strings
    ctx.fillRect(sx | 0, s.y | 0, (s.size * pulse) | 0, (s.size * pulse) | 0);
  }
}
```

### Layer 2: Mid Parallax (Mountain Silhouettes)

| Property | Value |
|----------|-------|
| Draws | 2-3 overlapping mountain/wave silhouettes |
| Scroll | `scrollX * 0.3` |
| Opacity | 0.15–0.25 per layer |
| Blend | `source-over` |

**Implementation:**
```js
// Mountains are a repeating polyline. Pre-compute Y values for a tile width.
const MTN_TILE_W = 400;
const MTN_LAYERS = [
  { yBase: GROUND_Y - 60, amplitude: 40, freq: 0.008, alpha: 0.12, speedMul: 0.3 },
  { yBase: GROUND_Y - 30, amplitude: 25, freq: 0.012, alpha: 0.18, speedMul: 0.2 },
];

function drawMidParallax(ctx, scrollX, gnd) {
  for (const m of MTN_LAYERS) {
    const offset = (scrollX * m.speedMul) | 0;
    ctx.fillStyle = rgbaStr(gnd[0] + 20, gnd[1] + 20, gnd[2] + 20, m.alpha);
    ctx.beginPath();
    ctx.moveTo(0, CH);
    for (let x = 0; x <= CW; x += 4) {
      const wx = x + offset;
      const y = m.yBase - Math.sin(wx * m.freq) * m.amplitude
                        - Math.sin(wx * m.freq * 2.3) * m.amplitude * 0.4;
      ctx.lineTo(x, y | 0);
    }
    ctx.lineTo(CW, CH);
    ctx.closePath();
    ctx.fill();
  }
}
```

### Layer 3: Ground + Ground Decoration

| Property | Value |
|----------|-------|
| Draws | Flat ground fill, ground line, scrolling grid |
| Scroll | `scrollX * 1.0` (world speed) |
| Opacity | 1.0 |
| Blend | `source-over` |

See §6 Ground Rendering for full detail.

### Layer 4: Level Objects

| Property | Value |
|----------|-------|
| Draws | Blocks, spikes, pads, orbs, portals + shadows |
| Scroll | `scrollX * 1.0` |
| Opacity | 1.0 |
| Blend | `source-over` |

See §3 Object Rendering for full detail. Objects are culled to `[scrollX - UNIT, scrollX + CW + UNIT]`.

### Layer 5: Player + Player Effects

| Property | Value |
|----------|-------|
| Draws | Trail, glow, player cube, eyes |
| Scroll | None (player is at fixed screen X) |
| Opacity | 1.0 |
| Blend | `source-over`, trail uses `lighter` |

See §2 Player Rendering for full detail.

### Layer 6: Particles + Screen Effects

| Property | Value |
|----------|-------|
| Draws | All particle types, flash overlay, screen shake offset |
| Scroll | Particles track world coords, effects are screen-space |
| Opacity | Per-particle |
| Blend | Particles use `lighter` for additive glow |

See §4 Particle System and §5 Screen Effects.

### Layer 7: UI Overlay

| Property | Value |
|----------|-------|
| Draws | Progress bar, attempt counter, percentage, checkpoint msg, win screen |
| Scroll | None |
| Opacity | 1.0 |
| Blend | `source-over` |

No changes to current UI rendering logic — it already works. Just ensure it draws last.

---

## 2. Player Rendering

### 2.1 State Extensions

Add to player state in `physics.js`:

```js
// Add to createPlayer():
squashTimer: 0,    // frames remaining for squash (landing)
stretchTimer: 0,   // frames remaining for stretch (jump start)
jumpArcStart: 0,   // rotation at jump start (degrees)
jumpArcTarget: 0,  // rotation target (jumpArcStart + 90)
inAir: false,      // true from jump to landing
trail: new Float64Array(24), // ring buffer: [x0,y0, x1,y1, ...] 12 positions
trailHead: 0,      // write index into trail buffer
trailLen: 0,       // current number of valid entries (0-12)
```

### 2.2 Rotation: 90° Snap Per Jump

In real GD, the cube rotates exactly 90° over the duration of one jump arc. It does NOT spin continuously.

**Physics integration (in `updatePlayer`):**
```js
if (!player.grounded) {
  // Lerp rotation toward target over the jump arc
  const t = Math.min(1, (player.jumpArcTarget - player.jumpArcStart) === 0
    ? 1 : (player.rotation - player.jumpArcStart) / 90);
  player.rotation += (90 / jumpDuration) * dt * 360 / 90;
  // Clamp to target
  if (player.rotation >= player.jumpArcTarget) {
    player.rotation = player.jumpArcTarget;
  }
} else {
  // Snap to nearest 90°
  player.rotation = Math.round(player.rotation / 90) * 90;
}
```

**On jump trigger:**
```js
player.jumpArcStart = player.rotation;
player.jumpArcTarget = player.rotation + 90;
player.stretchTimer = 3;
```

**On landing:**
```js
player.squashTimer = 3;
player.rotation = Math.round(player.rotation / 90) * 90;
```

### 2.3 Squash & Stretch

Applied as scale transforms around the player center. Values are in scale multipliers.

| Effect | scaleX | scaleY | Duration | Trigger |
|--------|--------|--------|----------|---------|
| Stretch (jump) | 0.85 | 1.2 | 3 frames | Jump start |
| Squash (land) | 1.2 | 0.8 | 3 frames | Ground contact |
| Idle | 1.0 | 1.0 | — | Default |

```js
function getPlayerScale(player) {
  if (player.stretchTimer > 0) {
    const t = player.stretchTimer / 3; // 1.0 → 0.0
    return { sx: 1 - 0.15 * t, sy: 1 + 0.2 * t };
  }
  if (player.squashTimer > 0) {
    const t = player.squashTimer / 3;
    return { sx: 1 + 0.2 * t, sy: 1 - 0.2 * t };
  }
  return { sx: 1, sy: 1 };
}
```

Decrement timers each frame: `if (player.squashTimer > 0) player.squashTimer--;`

### 2.4 Trail

Store last 12 world positions in a ring buffer. Draw from oldest to newest with decreasing opacity and size.

```js
// Each frame while alive and moving:
function updateTrail(player, scrollX) {
  const worldX = PLAYER_X * UNIT + scrollX;
  const idx = (player.trailHead * 2) % 24;
  player.trail[idx] = worldX;
  player.trail[idx + 1] = player.y;
  player.trailHead = (player.trailHead + 1) % 12;
  if (player.trailLen < 12) player.trailLen++;
}

// Render trail (before player, so player draws on top):
function drawTrail(ctx, player, scrollX, playerColor) {
  if (player.trailLen < 2) return;
  const ps = PLAYER_SIZE * UNIT;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < player.trailLen; i++) {
    const age = (player.trailLen - 1 - i) / player.trailLen; // 0=newest, 1=oldest
    const idx = (((player.trailHead - player.trailLen + i) % 12) + 12) % 12;
    const wx = player.trail[idx * 2];
    const wy = player.trail[idx * 2 + 1];
    const sx = wx - scrollX;
    const sy = toCanvasY(wy + PLAYER_SIZE, sx);
    const scale = 1 - age * 0.5;
    const alpha = (1 - age) * 0.3;
    const sz = ps * scale;
    ctx.fillStyle = rgbaStr(playerColor[0], playerColor[1], playerColor[2], alpha);
    ctx.fillRect((sx + ps / 2 - sz / 2) | 0, (sy + ps / 2 - sz / 2) | 0, sz | 0, sz | 0);
  }
  ctx.globalCompositeOperation = 'source-over';
}
```

### 2.5 Glow

Manual glow — draw a larger, semi-transparent rectangle behind the player. No `ctx.shadowBlur`.

```js
function drawPlayerGlow(ctx, px, py, ps, color) {
  const glowSize = ps * 1.4;
  const offset = (ps - glowSize) / 2;
  ctx.fillStyle = rgbaStr(color[0], color[1], color[2], 0.15);
  ctx.fillRect((px + offset) | 0, (py + offset) | 0, glowSize | 0, glowSize | 0);
}
```

### 2.6 Full Player Draw Order

1. `drawPlayerGlow()` — soft colored rectangle behind
2. `drawTrail()` — fading trail positions
3. Translate to player center, apply rotation, apply squash/stretch scale
4. Fill player square with player color
5. Draw 1px lighter border
6. Draw eyes (two small black rectangles + white pupils)
7. Restore transform
8. If airborne: draw ground shadow (ellipse at ground Y, alpha based on height)

---

## 3. Object Rendering

All objects share: culling to `[scrollX - UNIT, scrollX + CW + UNIT]`, a drop shadow, and color derived from the ground color channel.

### 3.1 Coordinate Conversion

**Remove the slope.** Replace `groundAtX` and `toCanvasY`:

```js
const GROUND_Y = CH - 80; // flat, constant

function toCanvasY(worldY) {
  return GROUND_Y - worldY * UNIT;
}
```

No `sx` parameter needed anymore. Every `toCanvasY(oy, sx)` call becomes `toCanvasY(oy)`.

### 3.2 Drop Shadow (All Objects)

Draw a small semi-transparent ellipse below each object, on the ground plane. Cheap — one `fillRect` with rounded alpha.

```js
function drawObjectShadow(ctx, sx, groundY, objWidth) {
  ctx.fillStyle = SHADOW_COLOR; // pre-computed 'rgba(0,0,0,0.15)'
  ctx.fillRect((sx + 2) | 0, (groundY + 1) | 0, (objWidth - 4) | 0, 3);
}
```

### 3.3 Spikes

Proper triangle with inner detail line and subtle glow.

```js
function drawSpike(ctx, sx, sy, gnd) {
  const base = sy;          // bottom of spike (canvas Y)
  const top = sy - UNIT;    // tip
  const mid = sx + UNIT / 2;

  // Glow: slightly larger, semi-transparent triangle behind
  ctx.fillStyle = SPIKE_GLOW_COLOR; // pre-computed 'rgba(255,68,68,0.2)'
  ctx.beginPath();
  ctx.moveTo(sx - 2, base + 2);
  ctx.lineTo(mid, top - 4);
  ctx.lineTo(sx + UNIT + 2, base + 2);
  ctx.closePath();
  ctx.fill();

  // Main triangle
  ctx.fillStyle = SPIKE_FILL; // '#e44'
  ctx.beginPath();
  ctx.moveTo(sx, base);
  ctx.lineTo(mid, top);
  ctx.lineTo(sx + UNIT, base);
  ctx.closePath();
  ctx.fill();

  // Inner detail line (smaller triangle outline)
  ctx.strokeStyle = SPIKE_DETAIL; // 'rgba(255,150,150,0.5)'
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + UNIT * 0.25, base - 2);
  ctx.lineTo(mid, top + UNIT * 0.3);
  ctx.lineTo(sx + UNIT * 0.75, base - 2);
  ctx.closePath();
  ctx.stroke();

  // Shadow
  drawObjectShadow(ctx, sx, base, UNIT);
}
```

### 3.4 Blocks

Filled rectangle with ground color, lighter border, optional inner cross pattern.

```js
function drawBlock(ctx, sx, sy, w, h, gnd, gndBorder, gndCross) {
  const pw = w * UNIT;
  const ph = h * UNIT;

  // Fill
  ctx.fillStyle = gnd;        // pre-computed ground+30 rgb string
  ctx.fillRect(sx | 0, sy | 0, pw | 0, ph | 0);

  // Border (2px lighter)
  ctx.strokeStyle = gndBorder; // pre-computed ground+60 rgb string
  ctx.lineWidth = 2;
  ctx.strokeRect(sx | 0, sy | 0, pw | 0, ph | 0);

  // Inner cross pattern (only for 1×1 blocks)
  if (w === 1 && h === 1) {
    ctx.strokeStyle = gndCross; // pre-computed ground+15 rgba string, alpha 0.3
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx | 0, sy | 0);
    ctx.lineTo((sx + pw) | 0, (sy + ph) | 0);
    ctx.moveTo((sx + pw) | 0, sy | 0);
    ctx.lineTo(sx | 0, (sy + ph) | 0);
    ctx.stroke();
  }

  // Shadow
  drawObjectShadow(ctx, sx, sy + ph, pw);
}
```

### 3.5 Orbs

Pulsing circle with outer ring. Color-coded by orb type.

| Orb Type | Fill Color | Ring Color |
|----------|-----------|------------|
| Yellow (36) | `#ffcc00` | `#ffe066` |
| Blue (84) | `#4488ff` | `#88bbff` |
| Pink (141) | `#ff44aa` | `#ff88cc` |

```js
function drawOrb(ctx, sx, sy, orbColor, ringColor, beatFrac) {
  const cx = (sx + UNIT / 2) | 0;
  const cy = (sy - UNIT / 2) | 0;
  const pulse = 1 + Math.max(0, 1 - beatFrac) * 0.15; // pulse on beat
  const r = (UNIT * 0.35 * pulse) | 0;

  // Glow
  ctx.fillStyle = orbColor.glow; // pre-computed rgba with alpha 0.2
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fill();

  // Fill
  ctx.fillStyle = orbColor.fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Ring
  ctx.strokeStyle = orbColor.ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Shadow
  drawObjectShadow(ctx, sx, toCanvasY(0), UNIT);
}
```

### 3.6 Pads

Flat arrow/chevron shape sitting on the ground. Color-coded same as orbs.

```js
function drawPad(ctx, sx, sy, padColor) {
  const w = UNIT;
  const h = UNIT * 0.35;

  // Glow
  ctx.fillStyle = padColor.glow;
  ctx.fillRect((sx - 2) | 0, (sy - h - 2) | 0, (w + 4) | 0, (h + 4) | 0);

  // Arrow shape
  ctx.fillStyle = padColor.fill;
  ctx.beginPath();
  ctx.moveTo(sx + 2, sy);
  ctx.lineTo(sx + w / 2, sy - h);
  ctx.lineTo(sx + w - 2, sy);
  ctx.closePath();
  ctx.fill();

  // Top highlight line
  ctx.strokeStyle = padColor.ring;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + 6, sy - 2);
  ctx.lineTo(sx + w / 2, sy - h + 2);
  ctx.lineTo(sx + w - 6, sy - 2);
  ctx.stroke();
}
```

### 3.7 Portals

Tall rectangular gate with animated vertical lines.

```js
function drawPortal(ctx, sx, sy, portalColor, time) {
  const w = UNIT * 0.6;
  const h = UNIT * 2.5;
  const x = (sx + (UNIT - w) / 2) | 0;
  const y = (sy - h) | 0;

  // Outer frame
  ctx.strokeStyle = portalColor.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w | 0, h | 0);

  // Inner animated lines (scrolling vertically)
  ctx.strokeStyle = portalColor.inner;
  ctx.lineWidth = 1;
  const lineOffset = (time * 60) % 8;
  for (let ly = lineOffset; ly < h; ly += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 3, (y + ly) | 0);
    ctx.lineTo(x + w - 3, (y + ly) | 0);
    ctx.stroke();
  }

  // Glow fill
  ctx.fillStyle = portalColor.glow;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}
```

### 3.8 Pre-computed Color Strings

All color strings are computed once per frame (after color lerp), not per object:

```js
// Computed once at top of render(), stored in a colors object:
const colors = {
  gndFill: rgbStr(gnd[0] + 30, gnd[1] + 30, gnd[2] + 30),
  gndBorder: rgbStr(min255(gnd[0] + 60), min255(gnd[1] + 60), min255(gnd[2] + 60)),
  gndCross: rgbaStr(gnd[0] + 15, gnd[1] + 15, gnd[2] + 15, 0.3),
  gndLine: rgbStr(min255(gnd[0] + 40), min255(gnd[1] + 40), min255(gnd[2] + 40)),
  // ... spike, orb, pad colors are static, computed once at init
};
```

---

## 4. Particle System

Replace the existing `particles.js` (which is snake-game specific) with a GD-specific particle system.

### 4.1 Particle Data Structure

Use a flat pre-allocated pool to avoid GC pressure. No object allocation in the hot path.

```js
const MAX_PARTICLES = 100;

// Struct-of-arrays for cache-friendly iteration
const P = {
  x:       new Float32Array(MAX_PARTICLES),
  y:       new Float32Array(MAX_PARTICLES),
  vx:      new Float32Array(MAX_PARTICLES),
  vy:      new Float32Array(MAX_PARTICLES),
  life:    new Float32Array(MAX_PARTICLES), // seconds remaining
  maxLife: new Float32Array(MAX_PARTICLES),
  size:    new Float32Array(MAX_PARTICLES),
  r:       new Uint8Array(MAX_PARTICLES),
  g:       new Uint8Array(MAX_PARTICLES),
  b:       new Uint8Array(MAX_PARTICLES),
  gravity: new Float32Array(MAX_PARTICLES), // 0 = no gravity, 1 = normal
  active:  new Uint8Array(MAX_PARTICLES),   // 0 or 1
};
let particleCount = 0; // number of active particles (for fast skip)
```

### 4.2 Spawn Function

```js
function spawnParticle(x, y, vx, vy, life, size, r, g, b, gravity) {
  if (particleCount >= MAX_PARTICLES) return; // hard cap
  // Find first inactive slot
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (P.active[i]) continue;
    P.x[i] = x; P.y[i] = y;
    P.vx[i] = vx; P.vy[i] = vy;
    P.life[i] = life; P.maxLife[i] = life;
    P.size[i] = size;
    P.r[i] = r; P.g[i] = g; P.b[i] = b;
    P.gravity[i] = gravity;
    P.active[i] = 1;
    particleCount++;
    return;
  }
}
```

### 4.3 Update & Draw (Single Pass)

```js
function updateAndDrawParticles(ctx, dt, scrollX) {
  if (particleCount === 0) return;
  ctx.globalCompositeOperation = 'lighter'; // additive blending
  let alive = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (!P.active[i]) continue;
    P.life[i] -= dt;
    if (P.life[i] <= 0) { P.active[i] = 0; continue; }
    alive++;

    // Physics
    P.vy[i] += P.gravity[i] * 400 * dt; // gravity in px/s²
    P.x[i] += P.vx[i] * dt;
    P.y[i] += P.vy[i] * dt;
    P.vx[i] *= 0.98;

    // Draw
    const alpha = P.life[i] / P.maxLife[i];
    const sz = P.size[i] * alpha;
    const sx = (P.x[i] - scrollX) | 0;
    if (sx < -10 || sx > CW + 10) continue; // off-screen cull
    const sy = P.y[i] | 0;

    // Use pre-built color string with alpha baked in
    ctx.fillStyle = `rgba(${P.r[i]},${P.g[i]},${P.b[i]},${(alpha * 0.8).toFixed(2)})`;
    ctx.fillRect(sx, sy, sz | 0 || 1, sz | 0 || 1);
  }
  particleCount = alive;
  ctx.globalCompositeOperation = 'source-over';
}
```

### 4.4 Particle Emitter Presets

Each preset is a function that calls `spawnParticle` N times with appropriate parameters.

#### Death Explosion
```js
function emitDeath(worldX, canvasY, r, g, b) {
  const count = 15 + (Math.random() * 10) | 0; // 15-25
  for (let i = 0; i < count; i++) {
    spawnParticle(
      worldX, canvasY,
      (Math.random() - 0.5) * 300,  // vx: random spread
      (Math.random() - 1) * 250,    // vy: mostly upward
      0.4 + Math.random() * 0.2,    // life: 0.4-0.6s
      3 + Math.random() * 4,        // size: 3-7px
      r, g, b,
      1                              // gravity: yes
    );
  }
}
```

#### Jump Particles
```js
function emitJump(worldX, canvasY, r, g, b) {
  for (let i = 0; i < 4; i++) {
    spawnParticle(
      worldX + Math.random() * UNIT * PLAYER_SIZE,
      canvasY,
      (Math.random() - 0.5) * 60,
      Math.random() * 30,           // downward (canvas coords)
      0.2 + Math.random() * 0.1,
      2 + Math.random() * 2,
      r, g, b, 0
    );
  }
}
```

#### Landing Particles
```js
function emitLanding(worldX, canvasY, r, g, b) {
  for (let i = 0; i < 4; i++) {
    spawnParticle(
      worldX + Math.random() * UNIT * PLAYER_SIZE,
      canvasY,
      (Math.random() - 0.5) * 80,
      -(Math.random() * 40),        // upward burst
      0.15 + Math.random() * 0.1,
      2 + Math.random() * 2,
      r, g, b, 0.5
    );
  }
}
```

#### Trail Particles (Continuous)
```js
function emitTrail(worldX, canvasY, r, g, b) {
  // Emit 1 particle per frame (called every frame while alive)
  spawnParticle(
    worldX - 2 + Math.random() * 4,
    canvasY + Math.random() * UNIT * PLAYER_SIZE,
    -20 - Math.random() * 30,       // drift left (behind player)
    (Math.random() - 0.5) * 20,
    0.15 + Math.random() * 0.1,
    1 + Math.random() * 2,
    r, g, b, 0
  );
}
```

#### Orb Hit Particles
```js
function emitOrbHit(worldX, canvasY, r, g, b) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    spawnParticle(
      worldX, canvasY,
      Math.cos(angle) * 150,
      Math.sin(angle) * 150,
      0.3,
      2 + Math.random() * 2,
      r, g, b, 0
    );
  }
}
```

#### Checkpoint Sparkle
```js
function emitCheckpoint(canvasX, canvasY) {
  for (let i = 0; i < 10; i++) {
    spawnParticle(
      canvasX + (Math.random() - 0.5) * 40,
      canvasY,
      (Math.random() - 0.5) * 40,
      -(80 + Math.random() * 60),   // upward
      0.5 + Math.random() * 0.3,
      2 + Math.random() * 2,
      0, 255, 100,                   // green sparkle
      0.3
    );
  }
}
```

### 4.5 Integration Points

| Event | Where Triggered | Emitter Called |
|-------|----------------|---------------|
| Player death | `game.js: die()` | `emitDeath(playerWorldX, playerCanvasY, playerColor)` |
| Jump | `physics.js: jump()` | `emitJump(...)` |
| Landing | `physics.js: updatePlayer()` when `grounded` transitions false→true | `emitLanding(...)` |
| Moving (alive) | `gd-renderer.js` each frame | `emitTrail(...)` |
| Orb hit | `physics.js: collide()` orb branch | `emitOrbHit(...)` |
| Checkpoint | `game.js` checkpoint block | `emitCheckpoint(...)` |

---

## 5. Screen Effects

### 5.1 Screen Shake (Improved)

Current shake uses random offset every frame — this looks jittery. Use damped sinusoidal shake for a more cinematic feel.

```js
// In state:
// shake: amplitude (pixels), shakeTime: elapsed since shake start

function getShakeOffset(shake, shakeTime) {
  if (shake < 0.5) return { x: 0, y: 0 };
  const decay = shake * Math.exp(-shakeTime * 6);
  const freq = 30; // Hz
  return {
    x: (Math.sin(shakeTime * freq) * decay) | 0,
    y: (Math.cos(shakeTime * freq * 1.3) * decay * 0.7) | 0,
  };
}
```

Apply at the very start of render via `ctx.translate(offset.x, offset.y)`.

### 5.2 Beat Pulse

The beat clock already exposes `beat()` which returns a float. The fractional part (`beat() % 1`) gives us position within the current beat: 0.0 = on the beat, approaching 1.0 = just before next beat.

```js
const beatFrac = beat() % 1; // 0.0 at beat hit, rises to 1.0
const beatPulse = Math.max(0, 1 - beatFrac * 4); // sharp spike: 1.0→0 in 0.25 beats
```

**What pulses:**
- Ground line width: `2 + beatPulse * 2` (2px normal, 4px on beat)
- Ground line brightness: `+40 + beatPulse * 30` over ground color
- Far parallax star alpha: `baseAlpha + beatPulse * 0.15`
- Orb radius: `baseRadius * (1 + beatPulse * 0.15)`

### 5.3 Flash Overlay

Already exists. Keep as-is but ensure it draws in Layer 6 (after particles).

```js
if (flash > 0) {
  ctx.fillStyle = flashColor || `rgba(255,255,255,${Math.min(0.5, flash).toFixed(2)})`;
  ctx.fillRect(0, 0, CW, CH);
}
```

### 5.4 Death Effect

Already exists (red tint + freeze frames). Add: spawn death particles before the freeze.

```js
// In die():
emitDeath(playerWorldX, playerCanvasY, playerColor[0], playerColor[1], playerColor[2]);
deathFreezeFrames = 4; // was 3, bump to 4 for more impact
flash = 0.4;
flashColor = 'rgba(255,0,0,0.35)';
shake = 14;
shakeTime = 0;
```

### 5.5 Chromatic Aberration (Optional)

Only on death, for 3-4 frames. Shift red channel left and blue channel right by 2-3px. This requires drawing the scene to an offscreen canvas, then drawing it 3 times with color filters.

**Cost:** 3 extra `drawImage` calls per frame. Only active for 3-4 frames on death, so acceptable.

```js
// Only if we decide to implement — flag as optional/low-priority
function chromaticAberration(ctx, offscreen, amount) {
  ctx.globalCompositeOperation = 'screen';
  // Red channel shifted left
  ctx.drawImage(offscreen, -amount, 0); // would need color matrix — skip for v1
  ctx.globalCompositeOperation = 'source-over';
}
```

**Verdict:** Skip for v1. The death particles + red flash + shake are sufficient impact.

---

## 6. Ground Rendering

### 6.1 Flat Ground (Fix the Slope Bug)

**Remove `SLOPE` entirely.** Ground Y is a constant.

```js
const GROUND_Y = CH - 80; // 320px from top

// DELETE these functions:
// function groundAtX(sx) { return GROUND_Y + (CW - sx) * SLOPE; }
// function toCanvasY(worldY, sx) { return groundAtX(sx) - worldY * UNIT; }

// REPLACE with:
function toCanvasY(worldY) {
  return GROUND_Y - worldY * UNIT;
}
```

### 6.2 Ground Fill

```js
function drawGround(ctx, gnd, gndLine, scrollX, beatPulse) {
  // Ground fill
  ctx.fillStyle = gndFillColor; // pre-computed rgb string from gnd[]
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

  // Ground line (flat, pulses on beat)
  const lineWidth = 2 + beatPulse * 2;
  ctx.strokeStyle = gndLineColor; // pre-computed, brightness boosted by beatPulse
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CW, GROUND_Y);
  ctx.stroke();

  // Scrolling grid on ground surface
  ctx.strokeStyle = GRID_COLOR; // pre-computed 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1;
  const gridOff = scrollX % UNIT;
  for (let x = -gridOff; x < CW; x += UNIT) {
    const ix = x | 0;
    ctx.beginPath();
    ctx.moveTo(ix, GROUND_Y);
    ctx.lineTo(ix, CH);
    ctx.stroke();
  }
  // Horizontal grid lines
  for (let y = GROUND_Y + UNIT; y < CH; y += UNIT) {
    ctx.beginPath();
    ctx.moveTo(0, y | 0);
    ctx.lineTo(CW, y | 0);
    ctx.stroke();
  }
}
```

### 6.3 Ground Gaps

If the level format supports gap sections (no ground), skip drawing ground fill and line for those X ranges.

```js
// Level format extension:
// objects can include: { type: 'gap', beat: 50, w: 4 }
// This means no ground from beat 50 to beat 54.

// In drawGround, check if current screen X range overlaps any gap.
// For v1: not implemented. Ground is always present.
// For v2: clip ground drawing to non-gap regions.
```

---

## 7. Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | What To Do Instead |
|---|---|---|
| `ctx.shadowColor`/`ctx.shadowBlur` on every object | Forces GPU blur pass per draw call. Current code uses it on spikes, pads, player, checkpoint text, win screen. | Draw a larger semi-transparent shape behind the object manually. One extra `fillRect` is 10× cheaper than `shadowBlur`. |
| `ctx.createLinearGradient()` every frame | Allocates a new gradient object (GC pressure). | Cache gradient objects. Recreate only when colors change (compare a key string). |
| Drawing off-screen objects | Wastes fill rate. With 200+ objects in a level, most are off-screen. | Cull: `if (sx < -UNIT \|\| sx > CW + UNIT) continue;` Already partially done, keep it. |
| `ctx.save()`/`ctx.restore()` in tight loops | Each save/restore pushes/pops the entire canvas state stack. | Only save/restore for the player (needs rotation transform). For objects, avoid — set properties directly. |
| `globalAlpha` per object | Requires save/restore around each object. | Bake alpha into the color string: `rgba(r,g,b,a)`. |
| String concatenation in hot path | `` `rgb(${r},${g},${b})` `` creates a new string per call. | Pre-compute all color strings once per frame into a `colors` object. Use helper: `rgbStr(r,g,b)` called once. |
| `new Array()` or `[]` in render loop | GC pressure from transient allocations. | Pre-allocate all arrays at module scope. Reuse them. The particle pool uses typed arrays for this reason. |
| `Math.sin()`/`Math.cos()` per particle | Trig is expensive at scale. | For particles: use random linear velocities, not angular. For parallax mountains: compute with step=4px, not per-pixel. |

### Color String Helpers

```js
// Called at module init, returns cached strings
function rgbStr(r, g, b) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function rgbaStr(r, g, b, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(2)})`;
}
function min255(v) { return v > 255 ? 255 : v | 0; }
```

---

## 8. Performance Budget

| Metric | Budget | Notes |
|--------|--------|-------|
| Frame time | ≤16.6ms | 60fps target |
| Particles | ≤100 active | Hard cap in pool. Death=25, trail=~12 steady-state, jump/land=4 each. Headroom for orb hits. |
| Object draw calls | ≤30 per frame | At 800px width / 40px per unit = 20 visible columns + 1 margin each side. |
| Parallax stars | 40 total | Simple `fillRect`, no arcs. |
| Mountain polyline | 2 layers × 200 vertices | `lineTo` every 4px across 800px. |
| Gradient objects | ≤2 cached | Background gradient + optional portal gradient. |
| `save()`/`restore()` | ≤2 per frame | Once for screen shake translate, once for player rotation. |
| Canvas state changes | Minimize | Batch objects by type where possible (all spikes, then all blocks). |

### Object Culling

```js
const cullLeft = scrollX - UNIT;
const cullRight = scrollX + CW + UNIT;

for (let i = 0; i < objects.length; i++) {
  const wx = objects[i].worldX;
  if (wx < cullLeft || wx > cullRight) continue;
  // draw...
}
```

Since objects are sorted by beat (and therefore by worldX), we can binary-search for the first visible object and break when we pass the right edge:

```js
// Binary search for first object with worldX >= cullLeft
let lo = 0, hi = objects.length;
while (lo < hi) {
  const mid = (lo + hi) >> 1;
  if (objects[mid].worldX < cullLeft) lo = mid + 1;
  else hi = mid;
}
// Draw from lo until worldX > cullRight
for (let i = lo; i < objects.length; i++) {
  if (objects[i].worldX > cullRight) break;
  // draw...
}
```

### Integer Coordinates

Canvas rasterization is faster when coordinates are integers (avoids sub-pixel anti-aliasing). Use `| 0` on all x/y values passed to `fillRect`, `moveTo`, `lineTo`.

---

## 9. Render Loop Structure

The new `render()` function in `gd-renderer.js`:

```js
export function render(ctx, state) {
  const { player, scrollX, objects, flash, flashColor, shake, shakeTime,
          attempts, songPct, bg, gnd, checkpoint, won,
          checkpointMsg, checkpointMsgTimer, version } = state;

  // Pre-compute color strings (once per frame)
  const colors = computeColors(bg, gnd);
  const beatFrac = state.beatFrac || 0; // beat() % 1, passed from game.js
  const beatPulse = Math.max(0, 1 - beatFrac * 4);
  const time = state.time || 0; // songTime(), for portal animation

  ctx.save();

  // Layer 6 (early): Screen shake offset
  const shakeOff = getShakeOffset(shake, shakeTime);
  ctx.translate(shakeOff.x, shakeOff.y);

  // Layer 0: Background gradient
  drawBackground(ctx, bg);

  // Layer 1: Far parallax
  drawFarParallax(ctx, scrollX, beatFrac);

  // Layer 2: Mid parallax
  drawMidParallax(ctx, scrollX, gnd);

  // Layer 3: Ground
  drawGround(ctx, colors, scrollX, beatPulse);

  // Layer 4: Objects (culled, sorted by worldX)
  drawObjects(ctx, objects, scrollX, colors, beatFrac, time);

  // Layer 5: Player
  if (!player.dead) {
    drawTrail(ctx, player, scrollX, state.playerColor);
    drawPlayerGlow(ctx, player, state.playerColor);
    drawPlayer(ctx, player, state.playerColor);
  }

  // Layer 6: Particles
  updateAndDrawParticles(ctx, state.dt, scrollX);

  // Layer 6: Flash overlay
  if (flash > 0) {
    ctx.fillStyle = flashColor || `rgba(255,255,255,${Math.min(0.5, flash).toFixed(2)})`;
    ctx.fillRect(0, 0, CW, CH);
  }
  if (player.dead) {
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.fillRect(0, 0, CW, CH);
  }

  ctx.restore(); // undo shake translate

  // Layer 7: UI (not affected by shake)
  drawUI(ctx, songPct, attempts, checkpoint, checkpointMsg, checkpointMsgTimer, won, version);
}
```

---

## 10. Migration Plan

### Phase 1: Fix Ground + Remove shadowBlur (1 session)
1. Delete `SLOPE`, `groundAtX()`. Make `toCanvasY(worldY)` flat.
2. Replace all `ctx.shadowBlur` usage with manual glow rectangles.
3. Pre-compute color strings at top of `render()`.

### Phase 2: Particle System (1 session)
1. Create `gd-particles.js` with the struct-of-arrays pool.
2. Wire `emitDeath` into `game.js: die()`.
3. Wire `emitJump`/`emitLanding` into physics events.
4. Add `emitTrail` call in render loop.

### Phase 3: Player Polish (1 session)
1. Add squash/stretch timers to player state.
2. Implement 90° rotation per jump arc.
3. Add trail ring buffer and `drawTrail()`.
4. Replace `ctx.shadowBlur` player glow with manual glow.

### Phase 4: Parallax + Beat Pulse (1 session)
1. Add `drawBackground()` with cached gradient.
2. Add `drawFarParallax()` with pre-generated star positions.
3. Add `drawMidParallax()` with sine-wave mountains.
4. Pass `beatFrac` from `game.js` to renderer, wire beat pulse into ground line and stars.

### Phase 5: Object Art Upgrade (1 session)
1. Spike inner detail line + glow triangle.
2. Block inner cross pattern.
3. Orb pulsing circle + ring.
4. Pad arrow shape.
5. Portal animated gate.
6. Object shadows.

### Phase 6: Performance Pass (1 session)
1. Binary search for object culling.
2. Audit for stray allocations in render loop.
3. Integer-snap all coordinates.
4. Profile on mobile Safari, fix any frame drops.

---

## Appendix A: State Extensions Summary

Fields to add to the game state object passed to `render()`:

```js
{
  // Existing (keep):
  player, scrollX, objects, flash, flashColor, shake, attempts,
  songPct, bg, gnd, checkpoint, won, checkpointMsg, checkpointMsgTimer, version,

  // New:
  beatFrac: beat() % 1,           // fractional beat position
  time: songTime(),                // seconds, for animations
  dt: frameDeltaSeconds,           // for particle physics
  shakeTime: secondsSinceShake,    // for improved shake
  playerColor: [0, 255, 0],       // RGB, configurable later
}
```

Fields to add to player object:

```js
{
  // Existing (keep):
  y, vy, grounded, dead, rotation, coyoteTimer, jumpBuffer,

  // New:
  squashTimer: 0,
  stretchTimer: 0,
  jumpArcStart: 0,
  jumpArcTarget: 0,
  trail: new Float64Array(24),
  trailHead: 0,
  trailLen: 0,
  wasGrounded: true,  // previous frame grounded state, for landing detection
}
```

## Appendix B: File Structure

```
js/
  gd-renderer.js    — rewrite: layer functions + render() orchestrator
  gd-particles.js   — new: struct-of-arrays particle pool + emitters
  physics.js         — modify: add squash/stretch/trail/rotation changes
  game.js            — modify: pass new state fields, wire particle emitters
```

No new dependencies. No new canvases. No WebGL. Pure Canvas 2D.
