# SFX Audio Design — skibidi-things

## Architecture

All SFX use the **same `AudioContext`** from `beat-clock.js` (accessed via `getCtx()`). No new contexts, no HTML5 `<audio>` elements. Every sound is synthesized with `OscillatorNode` + `GainNode`, fire-and-forget, with nodes disconnected on `ended`.

```
beat-clock.js                sfx.js
┌──────────┐    getCtx()    ┌──────────────────────┐
│AudioContext├──────────────►│ playJump()           │
│           │               │ playDeath()          │
│ source ───┤               │ playLanding()        │
│   │       │               │ playOrb(color)       │
│   ▼       │               │ playPad(color)       │
│destination│◄──────────────┤ playCheckpoint()     │
└──────────┘  all SFX route │ playComplete()       │
              to same dest  │ playPortal()         │
                            │ playRestart()        │
                            └──────────────────────┘
```

### Anti-overlap guard

For high-frequency sounds (jump, landing), track the last play time. If called again within the sound's duration, skip it. This prevents 10 overlapping jump sounds from rapid tapping.

```js
let lastJumpTime = 0;
const JUMP_COOLDOWN = 0.06; // seconds

function playJump() {
  const now = ctx.currentTime;
  if (now - lastJumpTime < JUMP_COOLDOWN) return;
  lastJumpTime = now;
  // ... create nodes
}
```

### Node cleanup pattern

Every sound follows this pattern to prevent memory leaks:

```js
function playSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  // ... configure osc + gain envelope ...
  osc.start(t);
  osc.stop(t + duration);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
```

---

## Volume Mixing Table

| Sound          | Gain   | Rationale                              |
|----------------|--------|----------------------------------------|
| Music          | 0.5–0.7 | Star of the show                     |
| Jump           | 0.10   | Heard 100s of times, must be subtle   |
| Death          | 0.18   | Impactful moment, needs weight        |
| Landing        | 0.06   | Barely perceptible thud               |
| Orb hit        | 0.12   | Bright feedback, moderate frequency   |
| Pad bounce     | 0.13   | Springy, slightly louder than orbs    |
| Checkpoint     | 0.14   | Celebratory, every ~15 seconds        |
| Level complete | 0.22   | Triumphant, once per level            |
| Portal enter   | 0.10   | Atmospheric, not distracting          |
| Restart        | 0.04   | Nearly silent click                   |

---

## Sound Specifications

### 1. JUMP

**Trigger:** `jump()` in `physics.js` executes a jump (grounded or coyote).
**Character:** Short click-pop. Triangle wave with fast pitch sweep down. Punchy but not tonal enough to clash with music.
**Duration:** 60ms
**Cooldown:** 60ms

```
Node graph:  OscillatorNode(triangle) → GainNode → destination

Oscillator:
  type: 'triangle'
  frequency: 800Hz at t, ramp to 400Hz at t+0.03

Gain envelope:
  t+0.000: 0.10
  t+0.008: 0.10  (hold peak 8ms)
  t+0.060: 0.001 (exponentialRamp)

Stop: t + 0.06
```

**Why triangle:** Square is too buzzy for 1000 repetitions. Sine is too pure/boring. Triangle has enough harmonic content to feel "clicky" without being harsh.

---

### 2. DEATH

**Trigger:** `die()` in `game.js` (spike/block collision, fall).
**Character:** Percussive crunch. White noise burst + low sine thud, layered. Feels like impact without being a scream.
**Duration:** 250ms
**Cooldown:** none (only plays once per death)

```
Node graph (2 layers):

Layer 1 — Noise burst:
  AudioBuffer (pre-rendered white noise, 0.25s, mono)
  BufferSourceNode → GainNode → destination

  Gain envelope:
    t+0.000: 0.18
    t+0.020: 0.12  (linearRamp — fast attack)
    t+0.250: 0.001 (exponentialRamp)

Layer 2 — Low thud:
  OscillatorNode(sine) → GainNode → destination

  Oscillator:
    type: 'sine'
    frequency: 80Hz at t, ramp to 40Hz at t+0.15

  Gain envelope:
    t+0.000: 0.15
    t+0.150: 0.001 (exponentialRamp)

  Stop: t + 0.25
```

**Pre-render the noise buffer once at init:**
```js
function createNoiseBuffer(ctx, duration) {
  const sr = ctx.sampleRate;
  const len = sr * duration;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
```

---

### 3. LANDING

**Trigger:** Player transitions from `grounded === false` to `grounded === true` (detected in `updatePlayer` or collision resolution).
**Character:** Subtle low thump. Almost felt more than heard.
**Duration:** 40ms
**Cooldown:** 80ms

```
Node graph:  OscillatorNode(sine) → GainNode → destination

Oscillator:
  type: 'sine'
  frequency: 120Hz at t, ramp to 60Hz at t+0.03

Gain envelope:
  t+0.000: 0.06
  t+0.005: 0.06  (hold 5ms)
  t+0.040: 0.001 (exponentialRamp)

Stop: t + 0.04
```

---

### 4. ORB HIT

**Trigger:** Player taps while overlapping an orb object.
**Character:** Bright sparkle. Two stacked sine oscillators (fundamental + octave) with fast decay. Pitch varies by orb color.
**Duration:** 120ms
**Cooldown:** 50ms

**Pitch table:**
| Color  | Fundamental | Octave  |
|--------|-------------|---------|
| yellow | 880 Hz (A5) | 1760 Hz |
| blue   | 440 Hz (A4) | 880 Hz  |
| pink   | 1320 Hz (E6)| 2640 Hz |

```
Node graph (2 oscillators):

  OscillatorNode(sine, fundamental) → GainNode → destination
  OscillatorNode(sine, octave)      → GainNode → destination

Oscillator 1 (fundamental):
  type: 'sine'
  frequency: [per color table]

Oscillator 2 (octave):
  type: 'sine'
  frequency: fundamental × 2

Gain envelope (both share same shape):
  t+0.000: 0.12
  t+0.010: 0.12  (hold 10ms)
  t+0.120: 0.001 (exponentialRamp)

Stop: t + 0.12
```

---

### 5. PAD BOUNCE

**Trigger:** Player collides with a jump pad object.
**Character:** Springy "boing." Sine wave with fast upward frequency sweep (the opposite of jump — goes UP). Feels bouncy.
**Duration:** 150ms
**Cooldown:** 80ms

**Pitch table:**
| Color  | Start freq | End freq |
|--------|-----------|----------|
| yellow | 300 Hz    | 900 Hz   |
| blue   | 200 Hz    | 600 Hz   |
| pink   | 400 Hz    | 1200 Hz  |

```
Node graph:  OscillatorNode(sine) → GainNode → destination

Oscillator:
  type: 'sine'
  frequency: [start] at t, exponentialRamp to [end] at t+0.08

Gain envelope:
  t+0.000: 0.13
  t+0.010: 0.13  (hold 10ms)
  t+0.150: 0.001 (exponentialRamp)

Stop: t + 0.15
```

---

### 6. CHECKPOINT

**Trigger:** `pctFloor > checkpoint` in `game.js` (every 5% milestone).
**Character:** Ascending two-note chime. Two sequential sine tones a perfect fifth apart. Feels musical and celebratory without being a melody that clashes with the song.
**Duration:** 300ms total (150ms per note)
**Cooldown:** none (max once per ~15 seconds)

```
Node graph (2 sequential oscillators):

Note 1 — C6 (1047 Hz):
  OscillatorNode(sine) → GainNode → destination

  Gain envelope:
    t+0.000: 0.14
    t+0.010: 0.14
    t+0.150: 0.001 (exponentialRamp)

  Start: t, Stop: t + 0.15

Note 2 — G6 (1568 Hz):
  OscillatorNode(sine) → GainNode → destination

  Gain envelope:
    t+0.150: 0.14
    t+0.160: 0.14
    t+0.300: 0.001 (exponentialRamp)

  Start: t + 0.15, Stop: t + 0.30
```

---

### 7. LEVEL COMPLETE

**Trigger:** `songPct >= 1` in `game.js`.
**Character:** Triumphant ascending arpeggio. Four notes of a major chord (C-E-G-C) played in rapid sequence, each with a sine + triangle layer for richness.
**Duration:** 1.2 seconds
**Cooldown:** none (once per level)

```
Node graph (4 note events, each with 2 oscillators):

Notes:
  t+0.00: C5 (523 Hz)  — 300ms
  t+0.20: E5 (659 Hz)  — 300ms
  t+0.40: G5 (784 Hz)  — 300ms
  t+0.60: C6 (1047 Hz) — 600ms (held longer, final note)

Per note:
  OscillatorNode(sine, freq)     → GainNode(0.22) → destination
  OscillatorNode(triangle, freq) → GainNode(0.10) → destination

Gain envelope per note:
  noteStart+0.000: [volume]
  noteStart+0.010: [volume]
  noteStart+[dur]:  0.001 (exponentialRamp)
```

---

### 8. PORTAL ENTER

**Trigger:** Player passes through a portal object (`portal_gravity`, `portal_speed`, or mode portal).
**Character:** Whoosh/warp. Sine wave with dramatic frequency sweep down (1200→200 Hz) plus a quieter sawtooth layer for texture.
**Duration:** 200ms
**Cooldown:** 100ms

```
Node graph (2 layers):

Layer 1 — Sweep:
  OscillatorNode(sine) → GainNode → destination

  Oscillator:
    type: 'sine'
    frequency: 1200Hz at t, exponentialRamp to 200Hz at t+0.18

  Gain envelope:
    t+0.000: 0.10
    t+0.200: 0.001 (exponentialRamp)

Layer 2 — Texture:
  OscillatorNode(sawtooth) → GainNode → destination

  Oscillator:
    type: 'sawtooth'
    frequency: 600Hz at t, exponentialRamp to 100Hz at t+0.18

  Gain envelope:
    t+0.000: 0.04
    t+0.200: 0.001 (exponentialRamp)

Stop both: t + 0.20
```

---

### 9. RESTART

**Trigger:** `restartLevel()` in `game.js` (after death freeze frames complete).
**Character:** Near-silent soft click. Barely there — GD itself is almost silent on restart. A tiny high-frequency blip to acknowledge the restart without being annoying on attempt #347.
**Duration:** 25ms
**Cooldown:** none

```
Node graph:  OscillatorNode(sine) → GainNode → destination

Oscillator:
  type: 'sine'
  frequency: 2000Hz (constant)

Gain envelope:
  t+0.000: 0.04
  t+0.005: 0.04
  t+0.025: 0.001 (exponentialRamp)

Stop: t + 0.025
```

---

## Module API

File: `js/sfx.js`

```js
import { getCtx } from './beat-clock.js';

let noiseBuffer = null;
let lastJumpTime = 0;
let lastLandTime = 0;
let lastOrbTime = 0;
let lastPadTime = 0;
let lastPortalTime = 0;

function ensureNoise() {
  if (noiseBuffer) return noiseBuffer;
  const ctx = getCtx();
  if (!ctx) return null;
  const sr = ctx.sampleRate;
  const len = sr * 0.25;
  noiseBuffer = ctx.createBuffer(1, len, sr);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function playJump()            { /* see spec §1 */ }
export function playDeath()           { /* see spec §2 */ }
export function playLanding()         { /* see spec §3 */ }
export function playOrb(color)        { /* see spec §4, color = 'yellow'|'blue'|'pink' */ }
export function playPad(color)        { /* see spec §5, color = 'yellow'|'blue'|'pink' */ }
export function playCheckpoint()      { /* see spec §6 */ }
export function playComplete()        { /* see spec §7 */ }
export function playPortal()          { /* see spec §8 */ }
export function playRestart()         { /* see spec §9 */ }
```

---

## Integration Points in game.js

```js
import * as sfx from './sfx.js';

// In jump() call site (onTap):
//   After jump(player) succeeds → sfx.playJump()

// In die():
//   sfx.playDeath()

// In restartLevel():
//   sfx.playRestart()

// In frame(), checkpoint detection:
//   if (pctFloor > checkpoint) → sfx.playCheckpoint()

// In frame(), level complete:
//   if (songPct >= 1 && !won) → sfx.playComplete()

// In collide() (physics.js), or detected in game.js:
//   obj.type === 'pad' → sfx.playPad(obj.color || 'yellow')
//   obj.type === 'orb' → sfx.playOrb(obj.color || 'yellow')
//   obj.type starts with 'portal' → sfx.playPortal()

// Landing detection (add to game.js frame loop):
//   Track wasGrounded. If !wasGrounded && player.grounded → sfx.playLanding()
```

### Landing detection addition to game.js

The current code doesn't track grounded transitions. Add:

```js
let wasGrounded = true;

// In frame(), after updatePlayer:
if (!wasGrounded && player.grounded) sfx.playLanding();
wasGrounded = player.grounded;
```

### Collision SFX hookup

`collide()` in `physics.js` currently handles pad bounces inline. Two options:

**Option A (preferred):** Return collision info from `collide()` instead of just `true/false`:
```js
// physics.js returns: { died: bool, pad: color|null, orb: color|null, portal: bool }
// game.js reads the result and calls the appropriate sfx function
```

**Option B (simpler):** Call sfx directly from `collide()` by passing sfx callbacks. Less clean but works without refactoring the return type.

Recommendation: **Option A** — keeps physics pure, audio in game.js.

---

## Rhythm Considerations

- **Jump (60ms):** At 143 BPM, one beat = 420ms. The jump sound occupies 14% of a beat — short enough to sit between beats without masking.
- **Death (250ms):** Percussive envelope (peak in first 20ms, then decay). Fits any tempo because the attack is the only prominent part.
- **Checkpoint (300ms):** The C→G fifth interval is consonant with most keys. At 300ms total, it spans ~71% of one beat — feels rhythmic.
- **All sounds use exponentialRamp to 0.001:** This ensures crisp cutoffs with no lingering tails that would muddy the mix.

---

## Future Considerations

- **Volume slider:** Add a master SFX volume multiplier (0.0–1.0) that scales all gain values. Store in `localStorage`.
- **Mute toggle:** Separate music mute and SFX mute.
- **Pre-rendered buffers:** If performance is an issue on low-end devices, pre-render jump/landing/orb into `AudioBuffer` at init time using `OfflineAudioContext`. Currently unnecessary — creating 2 nodes per sound is trivial for modern browsers.
- **Spatial panning:** Could pan orb/pad sounds slightly based on their screen-x position using `StereoPannerNode`. Low priority.
