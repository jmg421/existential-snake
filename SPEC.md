# Skibidi Things — Geometry Dash Killer Spec

## What This Is

A browser-based rhythm platformer that competes directly with Geometry Dash. Stranger Things theme, Gen Z humor, zero dependencies, static hosting. The player taps to jump over obstacles that are synced to music. One input. Instant restart. Beat-mapped levels.

## Why GD Wins

GD is not a platformer. It's a music visualizer with a death condition. Everything that happens on screen is a timestamp on a timeline driven by the song. The player has one input (tap). Levels are 100% deterministic. This is why practice mode works, why the progress bar is meaningful, and why players memorize levels.

The things that make it addictive:
- Music sync — obstacles land on the beat
- Instant restart — zero frames between death and retry
- Practice mode — checkpoints prevent rage-quit at 87%
- Progress bar — you can see how close you were
- Visual density — every pixel is moving, every section shifts color

## Core Architecture

### Beat Clock

The game runs on `AudioContext.currentTime`, not `requestAnimationFrame` deltas.

```
songTime = audioContext.currentTime - songStartTime
beat = songTime * bpm / 60
scrollX = songTime * scrollSpeed
```

`requestAnimationFrame` is used only for rendering. Game state is never accumulated from frame deltas — it's calculated from the current song time. This means:
- Frame drops don't desync the game
- The game is always in the correct state for the current moment in the song
- Object positions are derived: `objectScreenX = objectWorldX - scrollX`

### Player Physics

Single-plane gravity + tap-to-jump. Not lanes.

```
Player state:
  x: fixed (player doesn't move horizontally — the world scrolls)
  y: float (vertical position)
  vy: float (vertical velocity)
  grounded: bool
  dead: bool
  mode: 'cube' | 'ship' | 'ball' (future)

Per frame:
  vy += gravity * dt
  y += vy * dt
  if y >= groundY: y = groundY, vy = 0, grounded = true
  on tap: if grounded, vy = jumpVelocity

Collision:
  AABB test against obstacles within screen range
  Any overlap with a hazard = instant death
  Solid blocks stop vertical movement (land on top, bonk on bottom)
```

The player's horizontal position on screen is constant. The world scrolls past. This is the GD model.

### Level Format

Levels are JSON. Obstacles are placed by beat position (not pixels, not milliseconds). The engine converts beats to world-x at runtime using `worldX = beat * pixelsPerBeat`.

```json
{
  "meta": {
    "name": "Chapter 1: Hawkins Lab",
    "author": "skibidi-things",
    "song": "stereo-madness.mp3",
    "bpm": 140,
    "offset": 0,
    "startSpeed": 8
  },
  "objects": [
    { "beat": 4, "type": "spike" },
    { "beat": 8, "type": "block", "h": 2 },
    { "beat": 8.5, "type": "spike", "y": 2 },
    { "beat": 12, "type": "block", "h": 1, "w": 4 },
    { "beat": 24, "type": "spike" },
    { "beat": 24.5, "type": "spike" },
    { "beat": 25, "type": "spike" }
  ],
  "triggers": [
    { "beat": 0, "type": "color", "bg": [10, 0, 30], "ground": [40, 0, 80] },
    { "beat": 32, "type": "color", "bg": [30, 0, 10], "ground": [80, 20, 40] },
    { "beat": 32, "type": "speed", "value": 10 },
    { "beat": 64, "type": "flash" }
  ]
}
```

Design decisions:
- `beat` is a float. `4` = beat 4. `4.5` = the "and" of beat 4. `4.25` = sixteenth note.
- `type` for objects: `spike`, `block`, `gap`, `pad` (jump pad), `orb` (tap-to-activate mid-air jump), `portal` (mode/gravity/speed change).
- `y` defaults to ground level (0). Positive = stacked up. This lets you place spikes on top of blocks.
- `w` defaults to 1 beat wide. `h` defaults to 1 unit tall.
- `triggers` are non-collidable events: color shifts, speed changes, flashes, camera shakes.
- Objects and triggers are sorted by beat. The engine maintains a pointer and advances it as songTime progresses.

### Object Types

| Type | Behavior | Default Size |
|------|----------|-------------|
| `spike` | Hazard. Instant death on contact. | 1×1 |
| `block` | Solid. Player lands on top, bonks on bottom/side. | w×h (default 1×1) |
| `gap` | Missing ground. Player falls and dies. | w beats wide |
| `pad` | Jump pad. Launches player upward on contact. | 1×1 |
| `orb` | Mid-air tap target. Tap while overlapping = jump boost. | 1×1 |
| `portal_gravity` | Flips gravity. | 1×1 |
| `portal_speed` | Changes scroll speed. | 1×1 |

### Trigger Types

| Type | Effect |
|------|--------|
| `color` | Lerp background/ground colors to new values over ~0.5s |
| `speed` | Change scroll speed (pixels per second) |
| `flash` | White screen flash (1 frame) |
| `shake` | Screen shake for N beats |
| `pulse` | Background elements scale up on this beat |

### Renderer

Single `<canvas>`, drawn back-to-front each frame:

1. **Background** — solid color (from current color trigger), subtle gradient
2. **Far parallax** — slow-moving shapes/particles (stars, upside-down particles). Scroll at 0.1× speed.
3. **Mid parallax** — geometric shapes, mountains, Stranger Things silhouettes. Scroll at 0.3× speed.
4. **Ground + obstacles** — the actual level geometry. Scroll at 1.0× speed. Ground is a filled rect. Obstacles drawn by type.
5. **Player** — fixed x position, animated y. Squash/stretch on jump/land. Rotation on cube mode (GD cubes rotate 90° per jump).
6. **Particles + effects** — jump particles, death explosion, collect sparkles, trail behind player.
7. **UI overlay** — progress bar (top), attempt counter, percentage display. No score — GD doesn't have score, it has completion percentage.

Visual juice (applied globally):
- Background color lerps between sections
- Ground line pulses on every beat (scale up slightly, fade back)
- Player trail (last N positions drawn with decreasing opacity)
- Screen shake on death, on beat drops
- White flash on beat drops / section transitions
- Chromatic aberration on death

### Death & Restart

**Zero UI between death and retry.**

```
on death:
  1. freeze 3 frames (50ms)
  2. death particle explosion from player position
  3. screen flash (red, 1 frame)
  4. increment attempt counter
  5. reset player to start
  6. restart song from beat 0
  7. total time from death to playing again: <200ms
```

No game-over screen. No text. No buttons. The attempt counter in the corner is the only acknowledgment. This is the single most important UX decision — it's what makes GD players do 1000 attempts without quitting.

The existing game-over screen with lessons/quotes moves to a "session summary" that appears when the player pauses or exits, not on death.

### Practice Mode

Same level, but:
- Player places checkpoints by tapping a "checkpoint" button
- On death, respawn at last checkpoint instead of start
- Progress bar shows checkpoint positions
- No attempt counter (practice doesn't count)
- Visual indicator: checkpoint flag on the ground

### Music & BPM Detection

The existing audio files:
- `stereo-madness.mp3` — the literal GD level 1 song name (ForeBound)
- `stereo-madness-2.mp3`
- `cosmic-harmony.mp3`
- `the-other-side.mp3`

For v1, levels are hand-mapped to these songs. BPM is manually set in the level JSON.

Future: auto-BPM detection using Web Audio API's `AnalyserNode` + onset detection. But that's v3 territory.

### File Structure

```
js/
  beat-clock.js     — AudioContext timing, beat calculation, song control
  physics.js        — player gravity, jump, collision resolution
  level.js          — level loader, object/trigger processing by beat
  renderer.js       — 7-layer canvas renderer with parallax
  particles.js      — particle system (reuse existing, extend)
  input.js          — tap/click/space = jump (reuse existing, simplify)
  game.js           — main loop: read beat clock → update physics → check collisions → render
  ui.js             — progress bar, attempt counter, practice mode UI
  config.js         — skins, themes, settings (reuse existing)
  audio.js          — Web Audio API setup, song loading (reuse existing, extend)

levels/
  chapter-1.json
  chapter-2.json
  ...
```

### What We Keep

- Stranger Things theme, Gen Z humor, skins, soundboard
- PWA manifest, service worker, icons
- GitHub Pages hosting
- The existing snake game (untouched — it's a separate game on the hub)
- Audio files
- CSS for the hub page (index.html)
- Light/dark mode

### What Changes

- `runner.html` becomes the new rhythm platformer
- `js/runner.js`, `js/runner_main.js`, `js/runner_renderer.js`, `js/level.js` get rewritten
- 3-lane runner → single-plane gravity+jump
- Random level generation → beat-mapped JSON levels
- Game-over screen on death → instant restart
- Frame-based timing → beat clock

### Milestones

**M1: Engine** — Beat clock, player physics, single level with spikes and blocks, instant restart. No visual polish. Prove the core loop works.

**M2: Juice** — All 7 renderer layers, parallax, color triggers, screen shake, flash, squash/stretch, death particles, player trail. Make it look like GD.

**M3: Levels** — 6 chapters mapped to the 4 existing songs. Difficulty curve. Practice mode with checkpoints.

**M4: Polish** — Skins, attempt counter persistence, session summary, share card, daily challenge (procedural level from date seed + BPM).

**M5: Editor** — In-browser level editor. Place objects on a timeline. Preview with music. Export JSON. Share via URL.

### Success Criteria

A kid plays it, dies 50 times on the same section, and doesn't quit. That's the test. Everything else is secondary.
