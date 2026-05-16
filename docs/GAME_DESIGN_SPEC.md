# Skibidi Things — Game Design Spec v1.0
## "Make Weston stop playing GD"

**Goal:** By end of day, a kid plays this, dies 50 times, and doesn't quit.

**Files affected:** physics.js (rewrite), gd-renderer.js (rewrite), new sfx.js, new particles.js, chapter-1.json (redesign), game.js (wire everything), beat-clock.js (export getCtx)

**No new dependencies. No WebGL. No build step. Pure Canvas 2D + Web Audio API.**

---

## Table of Contents
1. Physics & Gameplay Mechanics
2. Renderer & Visual Design
3. Sound Effects & Audio
4. Level Design
5. Implementation Order
6. Anti-Patterns

---

## 1. Physics & Gameplay Mechanics

### 1.1 Core Constants

```
UNIT           = 40        pixels per world unit (1 block = 40px)
GRAVITY        = 62        units/s² (snappy GD-like arc)
JUMP_VY        = -17       units/s (strong initial jump)
PLAYER_X       = 3         fixed screen position in units
PLAYER_SIZE    = 0.85      unit fraction
GROUND_Y       = 0         FLAT. No slope. Ever.
CEILING_Y      = 10        units (for flipped gravity)
COYOTE_TIME    = 0.10      seconds after leaving surface
JUMP_BUFFER    = 0.20      seconds a tap is remembered
SPIKE_HITBOX   = 0.60      fraction of visual size (forgiving)
ORB_HITBOX     = 1.20      fraction of visual size (generous)
PAD_HITBOX_H   = 0.40      fraction of visual height (wide+flat)
```

### 1.2 Player State

```javascript
{
  y: 0,              // vertical position in world units
  vy: 0,             // vertical velocity in units/s
  grounded: true,    // touching a surface
  dead: false,
  rotation: 0,       // degrees, snaps to 90° multiples on land
  targetRotation: 0, // rotation target for current jump arc
  coyoteTimer: 0,
  jumpBuffer: 0,
  gravityDir: 1,     // 1 = normal, -1 = flipped
  overlappingOrb: null,  // ref to orb object if player is inside one
  activatedObjects: new Set(),  // beat_type keys of used orbs/pads/portals
  squash: 0,         // frames remaining for squash animation
  stretch: 0,        // frames remaining for stretch animation
  wasGrounded: false, // previous frame grounded state (for landing detection)
  trail: [],         // ring buffer of {x, y, rotation} for trail rendering
}
```

### 1.3 Orbs — THE Critical Missing Mechanic

Orbs are mid-air tap targets. Player passes through them. If player taps while overlapping, they get a velocity boost. If they don't tap, nothing happens.

**Types:**
| Orb | Velocity on tap | Behavior |
|-----|----------------|----------|
| orb_yellow | vy = JUMP_VY × gravityDir | Normal jump from mid-air |
| orb_blue | flip gravityDir, vy = JUMP_VY × NEW gravityDir | Gravity flip + jump |
| orb_pink | vy = JUMP_VY × 0.6 × gravityDir | Small hop |

**Rules:**
- Orbs are NOT solid. Player passes through them.
- Activation requires BOTH overlap AND tap (jump input).
- Each orb can only be activated once per attempt (tracked by `activatedObjects`).
- Multi-activate orbs (key 99 in GD) are a future feature — default is single-activate.
- Orb hitbox is 120% of visual size (generous — player should feel like they "got it").
- When player overlaps an orb, it glows/pulses (visual cue to tap).
- Orb activation does NOT reset coyote timer.
- Orb activation sets `grounded = false`.

**Integration with jump():**
```javascript
export function jump(player) {
  if (player.dead) return;
  
  // Priority 1: Orb activation (mid-air)
  if (player.overlappingOrb) {
    const orb = player.overlappingOrb;
    const objId = orb.beat + '_' + orb.type;
    if (!player.activatedObjects.has(objId)) {
      player.activatedObjects.add(objId);
      if (orb.type === 'orb_yellow' || orb.type === 'orb') {
        player.vy = JUMP_VY * player.gravityDir;
      } else if (orb.type === 'orb_blue') {
        player.gravityDir *= -1;
        player.vy = JUMP_VY * player.gravityDir;
      } else if (orb.type === 'orb_pink') {
        player.vy = JUMP_VY * 0.6 * player.gravityDir;
      }
      player.grounded = false;
      player.overlappingOrb = null;
      player.targetRotation = player.rotation + 90 * player.gravityDir;
      return 'orb'; // caller plays orb sound
    }
  }
  
  // Priority 2: Ground/coyote jump
  if (player.grounded || player.coyoteTimer > 0) {
    player.vy = JUMP_VY * player.gravityDir;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
    player.targetRotation = player.rotation + 90 * player.gravityDir;
    return 'jump'; // caller plays jump sound
  }
  
  // Priority 3: Buffer for later
  player.jumpBuffer = JUMP_BUFFER;
  return null; // no sound
}
```

### 1.4 Pads — Ground-Triggered Boosts

Pads activate on ANY contact (no tap needed). They launch the player.

| Pad | Velocity | Behavior |
|-----|----------|----------|
| pad_yellow (or "pad") | vy = JUMP_VY × 1.4 × gravityDir | Strong upward boost |
| pad_blue | flip gravityDir, vy = JUMP_VY × 1.2 × NEW gravityDir | Gravity flip + boost |
| pad_pink | vy = JUMP_VY × 0.8 × gravityDir | Medium hop |

**Rules:**
- Pads activate on contact, no tap needed.
- Each pad activates once per attempt (tracked by `activatedObjects`).
- Pad hitbox: full width, 40% height (wide and flat, on the ground).
- Pad activation sets `grounded = false`.

### 1.5 Gravity System

**Normal (gravityDir = 1):** Player falls down. Ground at y=0. Jump goes up (negative vy).
**Flipped (gravityDir = -1):** Player falls up. Ceiling at y=CEILING_Y. Jump goes down (positive vy).

**updatePlayer changes:**
```javascript
player.vy += GRAVITY * player.gravityDir * dt;  // gravity follows direction
player.y += player.vy * dt;  // vy is already signed correctly

// Ground check (normal gravity)
if (player.gravityDir === 1 && player.y <= GROUND_Y) {
  player.y = GROUND_Y; player.vy = 0; player.grounded = true;
}
// Ceiling check (flipped gravity)  
if (player.gravityDir === -1 && player.y >= CEILING_Y - PLAYER_SIZE) {
  player.y = CEILING_Y - PLAYER_SIZE; player.vy = 0; player.grounded = true;
}
```

**Block collision with gravity:**
- Normal: land on TOP of blocks (player.y = blockTop)
- Flipped: land on BOTTOM of blocks (player.y = blockBottom - PLAYER_SIZE)

**Gravity portals:**
- `portal_gravity_flip`: sets gravityDir = -1
- `portal_gravity_normal`: sets gravityDir = 1
- Tall hitbox (2 units high) so player can't miss them
- Activate once per attempt

### 1.6 Collision Refinement

**Remove ground slope entirely.** GROUND_Y is a flat constant in canvas space.

**Two-pass collision:**
1. **Pass 1 — Blocks:** Resolve landing/bonking. Track which block tops the player is standing on.
2. **Pass 2 — Spikes:** Check with shrunken hitbox (60% of visual). Skip spikes whose base matches a block top the player is standing on (prevents false deaths when standing on a block next to a spike-on-block).
3. **Pass 3 — Interactive:** Orbs (set overlappingOrb), pads (activate), portals (activate).

**Spike hitbox shrinkage:**
```
Visual spike: 1×1 unit
Hitbox: 0.6×0.6 unit, centered
Margin: 0.2 units on each side
```
This matches GD's forgiving spike collision. Players should feel like they "barely made it" not "that was unfair."

**Block collision resolution:**
```javascript
function collideBlock(player, blockL, blockR, blockB, blockT) {
  const pL = PLAYER_X, pR = PLAYER_X + PLAYER_SIZE;
  const pB = player.y, pT = player.y + PLAYER_SIZE;
  
  if (pR <= blockL || pL >= blockR || pT <= blockB || pB >= blockT) return null;
  
  // Overlap exists. Determine resolution.
  if (player.gravityDir === 1) {
    // Normal gravity: can land on top
    if (player.vy > 0 && pB < blockT && pB > blockT - 0.3) {
      player.y = blockTop; player.vy = 0; player.grounded = true;
      return 'land';
    }
  } else {
    // Flipped gravity: can land on bottom
    if (player.vy < 0 && pT > blockB && pT < blockB + 0.3) {
      player.y = blockB - PLAYER_SIZE; player.vy = 0; player.grounded = true;
      return 'land';
    }
  }
  return 'death'; // side or wrong-direction collision = death
}
```

### 1.7 Gap Mechanic

Gaps are sections where ground is missing. Defined as objects:
```json
{ "beat": 16, "type": "gap", "w": 3 }
```

Gaps are NOT collision objects. They modify the ground check:
- Precompute gap worldX ranges at level load
- In updatePlayer, if player is over a gap, don't apply ground floor
- Player falls through and dies via checkFall (y < -1)
- Renderer: don't draw ground fill/line in gap regions

### 1.8 Speed System (Deferred to M2)

For v1, use constant speed from level meta. Speed portals and mid-level speed changes require precomputing a piecewise worldX function. This is important but not critical for the "fun" test — orbs and visual juice matter more.

### 1.9 Rotation

GD cubes rotate exactly 90° per jump arc, snapping to 0/90/180/270 on landing.

```javascript
// In updatePlayer:
if (!player.grounded) {
  // Lerp toward target rotation
  const diff = player.targetRotation - player.rotation;
  player.rotation += diff * Math.min(1, 8 * dt);
} else {
  // Snap to nearest 90°
  player.rotation = Math.round(player.rotation / 90) * 90;
}
```

On each jump/orb activation: `player.targetRotation = player.rotation + 90 * player.gravityDir`

---

## 2. Renderer & Visual Design

### 2.1 Canvas Setup

```
CW = 800, CH = 400
GROUND_LINE_Y = CH - 80 = 320    (canvas pixels, FLAT, no slope)
```

### 2.2 Layer System (back to front)

| Layer | Content | Scroll Speed | Notes |
|-------|---------|-------------|-------|
| 0 | Background gradient | 0x (static) | Vertical gradient from bg color to darker |
| 1 | Far parallax stars | 0.05x | 30-50 small dots, slow drift |
| 2 | Mid parallax shapes | 0.2x | 5-8 geometric mountain/triangle silhouettes |
| 3 | Ground + grid | 1.0x | Flat ground line + fill + scrolling grid |
| 4 | Level objects | 1.0x | Blocks, spikes, orbs, pads, portals |
| 5 | Player + trail | 1.0x (fixed X) | Player square + trail + squash/stretch |
| 6 | Particles | Mixed | Death burst, jump puffs, orb sparkles |
| 7 | UI overlay | 0x (fixed) | Progress bar, attempts, percentage, messages |

### 2.3 Player Rendering

**Base shape:** Colored square (default green #0f0) with simple face.

**Rotation:** Lerp toward targetRotation (90° per jump). Snap on land.

**Squash/Stretch:**
```
On jump start: scaleX = 0.8, scaleY = 1.2 for 3 frames, then lerp back to 1.0
On landing:    scaleX = 1.2, scaleY = 0.8 for 3 frames, then lerp back to 1.0
Lerp rate: 0.3 per frame toward 1.0
```

**Trail:** Ring buffer of last 12 positions. Each drawn as a smaller, more transparent copy of the player square.
```javascript
// Data structure (pre-allocated, no GC pressure)
const TRAIL_LEN = 12;
player.trail = new Array(TRAIL_LEN).fill(null).map(() => ({x: 0, y: 0, rot: 0}));
player.trailIdx = 0;

// Every 2 frames, record position:
if (frameCount % 2 === 0) {
  player.trail[player.trailIdx] = { x: PLAYER_X, y: player.y, rot: player.rotation };
  player.trailIdx = (player.trailIdx + 1) % TRAIL_LEN;
}

// Render: iterate from oldest to newest, opacity 0.05 → 0.3, size 0.4 → 0.8
```

**Glow:** Draw a slightly larger, semi-transparent rectangle behind the player. NOT ctx.shadowBlur (too expensive).
```javascript
ctx.fillStyle = 'rgba(0,255,0,0.15)';
ctx.fillRect(px - 4, py - 4, ps + 8, ps + 8);
```

### 2.4 Object Rendering

**Spikes:**
```
- Base triangle (red #f44)
- Inner detail: smaller triangle outline inside, 2px inset
- Subtle glow: draw a second larger triangle at 0.1 opacity behind
- NO ctx.shadowBlur
```

**Blocks:**
```
- Fill: ground color + 30 brightness
- Border: ground color + 60 brightness, 2px
- Inner cross: two diagonal lines at 0.1 opacity (gives texture)
- Drop shadow: dark rectangle offset 2px down, 0.15 opacity
```

**Orbs:**
```
- Outer ring: 2px stroke, orb color
- Inner fill: orb color at 0.6 opacity
- Pulse: radius oscillates ±2px on beat (use beat() % 1)
- When player overlaps: ring expands, opacity increases to 1.0
- Colors: yellow=#ff0, blue=#44f, pink=#f4f
- Size: 0.8 units diameter, centered at object position
```

**Pads:**
```
- Flat chevron/arrow shape on ground
- Color-coded: yellow=#ff0, blue=#44f, pink=#f4f
- Height: 0.3 units, width: 1 unit
- Subtle upward glow lines (2-3 short lines above pad)
```

**Portals:**
```
- Tall rectangle (0.5 wide × 2.5 tall)
- Animated vertical lines inside (3 lines, scrolling upward)
- Color: gravity flip = blue, gravity normal = yellow
- Semi-transparent fill with bright border
```

### 2.5 Particle System

**Architecture:** Struct-of-arrays pool. Pre-allocated. Zero allocation in hot path.

```javascript
const MAX_PARTICLES = 100;
const particles = {
  x:      new Float32Array(MAX_PARTICLES),
  y:      new Float32Array(MAX_PARTICLES),
  vx:     new Float32Array(MAX_PARTICLES),
  vy:     new Float32Array(MAX_PARTICLES),
  life:   new Float32Array(MAX_PARTICLES),  // remaining life in seconds
  maxLife:new Float32Array(MAX_PARTICLES),
  size:   new Float32Array(MAX_PARTICLES),
  r:      new Uint8Array(MAX_PARTICLES),
  g:      new Uint8Array(MAX_PARTICLES),
  b:      new Uint8Array(MAX_PARTICLES),
  gravity:new Float32Array(MAX_PARTICLES),  // per-particle gravity
  active: 0,  // count of active particles
};
```

**Emitter presets:**

| Event | Count | Velocity | Life | Size | Gravity | Color |
|-------|-------|----------|------|------|---------|-------|
| Death | 20 | random ±8 u/s | 0.5s | 3-8px | 30 | player color |
| Jump | 4 | random ±2, vy=-3 | 0.3s | 2-4px | 20 | white |
| Landing | 4 | random ±3, vy=-1 | 0.2s | 2-3px | 10 | ground color |
| Trail | 1/frame | vx=-1, vy=random±0.5 | 0.4s | 2-3px | 0 | player color 50% |
| Orb hit | 8 | radial burst ±6 | 0.3s | 3-5px | 0 | orb color |
| Checkpoint | 10 | random ±2, vy=-6 | 0.6s | 2-4px | 15 | gold #ff0 |

**Update loop:**
```javascript
function updateParticles(dt) {
  for (let i = particles.active - 1; i >= 0; i--) {
    particles.life[i] -= dt;
    if (particles.life[i] <= 0) {
      // Swap with last active, decrement count
      swapParticle(i, particles.active - 1);
      particles.active--;
      continue;
    }
    particles.vy[i] += particles.gravity[i] * dt;
    particles.x[i] += particles.vx[i] * dt;
    particles.y[i] += particles.vy[i] * dt;
  }
}
```

**Render:** Simple filled rectangles. Opacity = life/maxLife. Size shrinks with life.

### 2.6 Ground Rendering

**DELETE THE SLOPE.** Ground is a flat horizontal line.

```javascript
const GROUND_LINE_Y = CH - 80;  // 320px from top

// Ground fill
ctx.fillStyle = groundColorStr;
ctx.fillRect(0, GROUND_LINE_Y, CW, CH - GROUND_LINE_Y);

// Ground line (pulses on beat)
const beatPhase = beat() % 1;
const pulse = beatPhase < 0.1 ? 1 - beatPhase / 0.1 : 0;  // sharp attack, fast decay
ctx.strokeStyle = groundLineColorStr;
ctx.lineWidth = 2 + pulse * 2;  // 2px normal, 4px on beat
ctx.beginPath();
ctx.moveTo(0, GROUND_LINE_Y);
ctx.lineTo(CW, GROUND_LINE_Y);
ctx.stroke();

// Scrolling grid
ctx.strokeStyle = 'rgba(255,255,255,0.05)';
ctx.lineWidth = 1;
const gridOff = scrollX % UNIT;
for (let x = -gridOff; x < CW; x += UNIT) {
  ctx.beginPath(); ctx.moveTo(x|0, GROUND_LINE_Y); ctx.lineTo(x|0, CH); ctx.stroke();
}
```

**Gap rendering:** Skip ground fill and line for gap regions. Draw subtle red glow at gap edges.

### 2.7 Parallax Background

**Far stars (Layer 1):**
```javascript
// Pre-generate 40 stars at init
const stars = Array.from({length: 40}, () => ({
  x: Math.random() * CW * 3,  // wider than screen for scrolling
  y: Math.random() * (GROUND_LINE_Y - 40) + 20,
  size: Math.random() * 2 + 0.5,
  brightness: Math.random() * 0.3 + 0.1,
}));

// Render with parallax
for (const s of stars) {
  const sx = ((s.x - scrollX * 0.05) % (CW * 3) + CW * 3) % (CW * 3) - CW;
  if (sx < -5 || sx > CW + 5) continue;
  ctx.fillStyle = `rgba(255,255,255,${s.brightness})`;
  ctx.fillRect(sx|0, s.y|0, s.size|0, s.size|0);
}
```

**Mid silhouettes (Layer 2):**
```javascript
// Pre-generate 6 triangular mountains
const mountains = Array.from({length: 6}, (_, i) => ({
  x: i * CW * 0.6,
  w: 100 + Math.random() * 200,
  h: 40 + Math.random() * 80,
}));

// Render with parallax
ctx.fillStyle = `rgba(${bg[0]+15},${bg[1]+15},${bg[2]+15},0.3)`;
for (const m of mountains) {
  const mx = ((m.x - scrollX * 0.2) % (CW * 3) + CW * 3) % (CW * 3) - CW * 0.5;
  ctx.beginPath();
  ctx.moveTo(mx, GROUND_LINE_Y);
  ctx.lineTo(mx + m.w / 2, GROUND_LINE_Y - m.h);
  ctx.lineTo(mx + m.w, GROUND_LINE_Y);
  ctx.closePath();
  ctx.fill();
}
```

### 2.8 Screen Effects

**Flash:** Already exists. Keep as-is.

**Shake:** Improve from random to damped:
```javascript
if (state.shake > 0.5) {
  const sx = Math.sin(state.shake * 15) * state.shake * 1.5;
  const sy = Math.cos(state.shake * 12) * state.shake;
  ctx.translate(sx|0, sy|0);
}
```

**Beat pulse:** Ground line width + star brightness increase on beat. Already shown above.

### 2.9 Performance Rules

- **NO ctx.shadowBlur anywhere.** Manual glow rectangles only.
- **NO gradient creation in render loop.** Cache gradient objects.
- **NO string concatenation in hot path.** Pre-compute `rgb(...)` strings before render.
- **Object culling:** Skip objects where `screenX < -UNIT*2 || screenX > CW + UNIT*2`.
- **Integer coordinates:** Use `x|0` for all fillRect/moveTo calls.
- **Max 2 ctx.save()/restore() per frame** (one for shake, one for player rotation).
- **Particle limit:** Hard cap at 100. New particles replace oldest when full.
- **Target:** 60fps on 2020 phone browser.

---

## 3. Sound Effects & Audio

### 3.1 Architecture

- **Reuse the beat-clock AudioContext.** Export `getCtx()` from beat-clock.js.
- **New file: js/sfx.js** — exports fire-and-forget functions.
- **All synthesis via OscillatorNode + GainNode.** No external audio files for SFX.
- **Disconnect all nodes on `ended` event** to prevent memory leaks.
- **Anti-overlap:** Cooldown timers for high-frequency sounds (jump, landing).

### 3.2 Sound Specifications

#### Jump — `playJump()`
```
Trigger: every jump (ground or orb)
Oscillator: triangle, 800Hz → 400Hz sweep over 60ms
Gain: 0.10, exponentialRamp to 0.001 at +60ms
Cooldown: 60ms (prevent overlap on rapid taps)
Feel: short, punchy, satisfying, not annoying after 1000 plays
```

#### Death — `playDeath()`
```
Trigger: spike/block collision
Component 1: White noise burst, 150ms, gain 0.15 → 0.001
Component 2: Sine, 80Hz → 40Hz sweep, 200ms, gain 0.12
Combined gain: 0.18
Feel: brief impact, percussive, fits any tempo
Note: Pre-render noise buffer at init (createBuffer, fill with Math.random()*2-1)
```

#### Landing — `playLand()`
```
Trigger: player.wasGrounded === false && player.grounded === true
Oscillator: sine, 120Hz → 60Hz sweep over 40ms
Gain: 0.06, exponentialRamp to 0.001 at +40ms
Cooldown: 80ms
Feel: subtle thud, barely noticeable, subconscious feedback
```

#### Orb Hit — `playOrb(color)`
```
Trigger: orb activation (tap while overlapping)
Oscillator 1: sine at fundamental freq, 100ms
Oscillator 2: sine at 2× fundamental (octave), 80ms, gain 0.5×
Gain: 0.12, exponentialRamp to 0.001 at +120ms
Frequencies by color:
  yellow: 880Hz
  blue:   440Hz  
  pink:   1320Hz
Feel: bright, sparkly, different per color
```

#### Pad Bounce — `playPad(color)`
```
Trigger: pad contact
Oscillator: sine, freq sweep upward over 150ms (boing effect)
  yellow: 200Hz → 600Hz
  blue:   150Hz → 500Hz
  pink:   300Hz → 800Hz
Gain: 0.13, exponentialRamp to 0.001 at +150ms
Feel: springy, satisfying bounce
```

#### Checkpoint — `playCheckpoint()`
```
Trigger: reaching new 5% milestone
Note 1: sine 1047Hz (C6), 150ms, gain 0.12
Note 2: sine 1568Hz (G6), 150ms, gain 0.12, starts at +100ms
Feel: ascending perfect fifth, celebratory, feels like part of the music
Total duration: 250ms
```

#### Level Complete — `playComplete()`
```
Trigger: reaching 100%
Arpeggio: C5→E5→G5→C6, each 200ms, sine+triangle layered
Gain: 0.22 per note, staggered starts
Total duration: ~1s
Feel: triumphant major chord, unmistakable victory
```

#### Portal Enter — `playPortal()`
```
Trigger: passing through any portal
Oscillator: sine 1200Hz → 200Hz sweep over 200ms
Texture: sawtooth at 0.03 gain, same sweep
Gain: 0.10
Feel: whoosh/warp
```

#### Restart — `playRestart()`
```
Trigger: instant restart after death
Oscillator: sine 2000Hz, 25ms
Gain: 0.04
Feel: near-silent click. GD is almost silent on restart. The ABSENCE of sound is the design.
```

### 3.3 Volume Mixing

```
Music:          0.5 - 0.7  (the star of the show)
Jump:           0.10       (frequent, must be quiet)
Death:          0.18       (impactful but not jarring)
Landing:        0.06       (subconscious)
Orb/Pad:        0.12-0.13  (feedback, not dominant)
Checkpoint:     0.12       (celebratory but brief)
Level complete: 0.22       (the big moment)
Portal:         0.10       (ambient)
Restart:        0.04       (barely there)
```

### 3.4 Integration Points in game.js

```javascript
// In onTap():
const result = jump(player);
if (result === 'orb') playOrb(player.lastOrbColor);
else if (result === 'jump') playJump();

// In frame(), after collision:
if (died) { playDeath(); die(); }

// In frame(), landing detection:
if (!player.wasGrounded && player.grounded) playLand();
player.wasGrounded = player.grounded;

// In frame(), checkpoint:
if (pctFloor > checkpoint) { playCheckpoint(); ... }

// In frame(), level complete:
if (songPct >= 1 && !won) { playComplete(); ... }

// In restartLevel():
playRestart();
```

---

## 4. Level Design — Chapter 1: "Hawkins Lab"

### 4.1 Design Philosophy

The level must teach mechanics progressively, sync to music structure, and have 2-3 chokepoints that create the "one more try" loop.

**Music:** stereo-madness.mp3 at 143 BPM, ~2.6 minutes.

### 4.2 Section Map

```
Beats 0-16:    INTRO — Empty. Player runs. Gets comfortable. Builds anticipation.
Beats 16-32:   LEARN JUMP — Single spikes, 4 beats apart. Trivial.
Beats 32-48:   LEARN TIMING — Spike pairs, 2 beats apart. Still easy.
Beats 48-64:   LEARN BLOCKS — Blocks with spikes on top. Jump onto block, jump over spike.
Beats 64-72:   BUILD-UP — Double spikes (half-beat spacing). Density increases.
Beats 72-136:  DROP 1 — On-beat patterns. Staircases. Block+spike combos. (~30% chokepoint at beat 110)
Beats 136-152: BREAKDOWN — Breather. Single obstacles. Catch your breath.
Beats 152-200: VERSE 2 — Introduce pads. Pad launches over tall blocks. (~60% chokepoint at beat 185)
Beats 200-208: BUILD-UP 2 — Triple spikes + ascending staircase.
Beats 208-272: DROP 2 — Pad chains, tall blocks, dense spike patterns.
Beats 272-288: BRIDGE — Staircase ascending and descending. New visual palette.
Beats 288-352: FINAL — Everything combined. Highest density. (~85% chokepoint at beat 330)
Beats 352-370: OUTRO — Easy victory lap. Player feels like a god.
```

### 4.3 Teaching Principle

Every mechanic is introduced in a SAFE context before being used in a DEADLY one:
1. First spike: beat 16, alone, 4 beats of empty space before and after
2. First block: beat 48, alone, easy to land on
3. First spike-on-block: beat 52, after player has practiced blocks
4. First pad: beat 152, launches over a single spike (can't fail)
5. First hard pad section: beat 185, pad over a tall tower (the chokepoint)

### 4.4 Color Palette Progression

| Beat | Background | Ground | Mood |
|------|-----------|--------|------|
| 0 | [10,0,30] dark purple | [40,0,80] purple | Stranger Things intro |
| 72 | [30,0,10] dark red | [80,20,40] crimson | Drop energy |
| 136 | [5,15,30] dark blue | [20,50,80] ocean | Calm breakdown |
| 208 | [25,5,30] neon purple | [60,15,70] violet | Second drop |
| 288 | [30,5,5] deep red | [80,20,20] blood | Final intensity |
| 352 | [10,5,25] dark indigo | [40,20,70] royal | Victory |

Flashes on every section transition. Shakes on build-ups.

### 4.5 Object Density Targets

| Section | Beats | Objects | Density (obj/beat) |
|---------|-------|---------|-------------------|
| Intro | 16 | 0 | 0.00 |
| Learn | 32 | 8-10 | 0.28 |
| Build-up | 8 | 6-8 | 0.88 |
| Drop 1 | 64 | 60-70 | 1.00 |
| Breakdown | 16 | 5-6 | 0.34 |
| Verse 2 | 48 | 30-35 | 0.67 |
| Drop 2 | 64 | 65-75 | 1.09 |
| Bridge | 16 | 12-15 | 0.84 |
| Final | 64 | 70-80 | 1.17 |
| Outro | 18 | 4-5 | 0.25 |

Total: ~260-300 objects across 370 beats.

### 4.6 The level JSON will be generated during implementation, following this exact structure.

---

## 5. Implementation Order

Priority is ruthlessly ordered by impact on the "fun" test.

| # | Task | Time | Impact | Why |
|---|------|------|--------|-----|
| 1 | Remove ground slope, flatten ground | 15min | HIGH | Fixes collision feel, everything else builds on this |
| 2 | Add sfx.js with jump + death sounds | 30min | HIGHEST | Sound is 50% of addiction. Two sounds transform the feel. |
| 3 | Add death particles | 30min | HIGH | Death feels impactful instead of just a red flash |
| 4 | Add player trail | 20min | HIGH | Makes movement feel fast and cool |
| 5 | Add squash/stretch to player | 20min | MEDIUM | Subtle but makes jumps feel alive |
| 6 | Add parallax stars + mountains | 20min | MEDIUM | Background goes from flat color to living world |
| 7 | Add orbs to physics + renderer | 60min | HIGHEST | THE missing mechanic. Without orbs, levels are boring. |
| 8 | Add pad variants (blue, pink) | 20min | MEDIUM | More variety in level design |
| 9 | Add beat pulse to ground line | 10min | MEDIUM | Connects visuals to music |
| 10 | Redesign chapter-1.json | 60min | HIGHEST | The level IS the game. Bad level = bad game. |
| 11 | Add remaining SFX (orb, pad, checkpoint, complete) | 30min | HIGH | Complete the audio feedback loop |
| 12 | Add jump/landing particles | 15min | MEDIUM | Polish |
| 13 | Add orb glow when overlapping | 15min | MEDIUM | Critical UX for orb mechanic |
| 14 | Test full loop | 30min | — | Start → play → die → restart → checkpoint → complete |

**Total estimated: ~6 hours of focused implementation.**

Critical path: 1 → 2 → 7 → 10 → 3 → 4 → 11 → 14

---

## 6. Anti-Patterns

### Physics Anti-Patterns
- ❌ Don't accumulate horizontal position from frame deltas (use songTime × speed)
- ❌ Don't use pixel-based collision (use world units, convert at render time)
- ❌ Don't make spike hitboxes match visuals (60% hitbox = forgiving)
- ❌ Don't allow double-jump without an orb
- ❌ Don't reset coyote timer on orb activation
- ❌ Don't process collision on dead player
- ❌ Don't use the ground slope (FLAT GROUND ONLY)

### Renderer Anti-Patterns
- ❌ Don't use ctx.shadowBlur (kills performance on mobile)
- ❌ Don't create gradient objects in render loop (cache them)
- ❌ Don't concatenate strings for colors in hot path (pre-compute)
- ❌ Don't draw off-screen objects (cull at ±2 UNIT margin)
- ❌ Don't allocate arrays/objects in render loop (pre-allocate everything)
- ❌ Don't use more than 2 save()/restore() per frame
- ❌ Don't use globalAlpha for individual objects (set fillStyle with alpha instead)

### Audio Anti-Patterns
- ❌ Don't create a new AudioContext for SFX (reuse beat-clock's context)
- ❌ Don't use HTML5 Audio elements for SFX (latency too high)
- ❌ Don't play sounds during death freeze frames (only death sound)
- ❌ Don't let SFX pile up (cooldown timers for frequent sounds)
- ❌ Don't use long release times (crisp, short sounds only)
- ❌ Don't forget to disconnect nodes after sound completes (memory leak)

### Level Design Anti-Patterns
- ❌ Don't place obstacles off-beat (every obstacle on a beat or half-beat)
- ❌ Don't have empty sections > 4 beats after the intro
- ❌ Don't make the first 30 seconds hard (players quit)
- ❌ Don't repeat the exact same pattern more than twice consecutively
- ❌ Don't place orbs where player can't see them coming (≥2 beats of visibility)
- ❌ Don't have impossible sections (every obstacle beatable on first sight-read by skilled player)
- ❌ Don't forget the teaching principle (safe intro → deadly use)

### Game Loop Anti-Patterns
- ❌ Don't show UI between death and retry (instant restart, <200ms)
- ❌ Don't reset the attempt counter on page reload (persist in localStorage)
- ❌ Don't play a restart animation (just reset and go)
- ❌ Don't pause the music on death (restart it immediately)

---

## Appendix: File Map After Implementation

```
js/
  beat-clock.js     — add: export getCtx()
  physics.js        — REWRITE: flat ground, orbs, pads, gravity, refined collision
  gd-renderer.js    — REWRITE: 8 layers, flat ground, orb/pad/portal rendering, parallax
  particles.js      — NEW: struct-of-arrays particle pool, emitter presets
  sfx.js            — NEW: 9 synthesized sound effects
  game.js           — UPDATE: wire SFX, particles, new physics returns, landing detection
  gd-import.js      — UPDATE: map GD orb/pad/portal IDs to new types
  config.js         — no change
  audio.js          — no change (soundboard, separate from gameplay SFX)
  input.js          — no change
  level.js          — no change
  ui.js             — no change

levels/
  chapter-1.json    — REDESIGN: 370 beats, 260-300 objects, proper difficulty curve

docs/
  GAME_DESIGN_SPEC.md  — this document
  gd-format-reference.md — GD level format reference (already created)
```
