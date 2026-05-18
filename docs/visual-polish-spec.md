# SKIBIDI ASCENT — Visual Polish Spec

## Goal
Make the level look like the reference video: animated, glowing, pulsing, layered.
Gameplay stays the same — this is decoration only.

## What the reference has that we don't:
1. Large decorative arrows/spikes (scaled up, non-collidable)
2. Color pulsing on beat
3. Parallax background pillars at multiple depths
4. Objects with additive blending (glow effect)
5. Move triggers (deco sliding in from off-screen)

---

## Implementation Plan

### 1. Groups & Color Channels Setup

Assign decoration objects to groups so triggers can target them:
- **Group 1**: Background pillars (far layer)
- **Group 2**: Mid-layer glow objects
- **Group 3**: Foreground decorative arrows
- **Group 4**: Ground pulse dots

Color channels:
- **Channel 1**: Main accent (magenta `255,50,200`)
- **Channel 2**: Secondary (cyan `0,255,200`)
- **Channel 3**: Tertiary (orange `255,150,0`)
- **Channel 1000**: BG (deep purple `40,0,200`)
- **Channel 1001**: Ground (dark cyan `0,100,150`)

### 2. Pulse Triggers (ID 105)

Place at regular intervals (every 8 blocks = ~every 2 jumps):
```
Object ID: 105
Target: Color channel 1 (or group)
Pulse Mode: 0 (Color)
RGB: 255, 255, 255 (flash white)
Fade In: 0.1
Hold: 0.05
Fade Out: 0.3
```

This makes the accent color flash white on rhythm.

### 3. Large Decorative Arrows (like the reference)

Use object ID **1711** (arrow deco) or **504** (glow half):
- Scale: 3.0-5.0 (huge)
- Rotation: 180 (pointing down)
- Y position: high (y=10-12)
- Z order: -3 (behind gameplay, in front of BG)
- Color channel: 1 (magenta, will pulse)
- Blending: ON (additive glow)
- Group: 3

Place every 10-15 blocks for visual rhythm.

### 4. Move Triggers (ID 104)

Make the large arrows slide down into view:
```
Object ID: 104
Target Group: 3 (decorative arrows)
Offset Y: -90 (move down 3 blocks)
Duration: 0.5
Easing: 6 (Elastic Out) — bouncy entrance
```

Place these spawn-triggered at section starts for dramatic reveals.

### 5. Parallax Background Pillars

Current: static glow pillars at one depth.
Needed: 3 layers at different Z-orders with Follow Player Y trigger:

- **Layer 1** (Z=-7): Very large, slow-moving, dark. Scale 3.0, opacity 0.3
- **Layer 2** (Z=-5): Medium, mid-speed. Scale 2.0, opacity 0.5  
- **Layer 3** (Z=-3): Smaller, faster. Scale 1.5, opacity 0.7

Use **Follow Player Y trigger (ID 1347)** with different speed multipliers
to create parallax scrolling effect.

### 6. Additive Blending

Set property `17: 1` (blending=true) on all glow objects:
- Glow pillars (503)
- Glow circles (1011)
- Glow half-slabs (211)
- Decorative arrows

This creates the neon look where overlapping glows add up to white.

### 7. Alpha Triggers for Fade-In (ID 1007)

At level start, fade in background layers:
```
Object ID: 1007
Target Group: 1 (BG pillars)
Opacity: 0 → 1
Duration: 2.0
```

### 8. Color Triggers at Section Boundaries (ID 29)

Shift the entire color scheme at each section transition:
```
Section 1-2: Purple → Blue
Section 3-4: Blue → Cyan  
Section 5-6: Cyan → Magenta
Section 7-8: Magenta → Red
```

Properties:
- Target: Channel 1000 (BG)
- Duration: 1.0
- RGB: new color values
- Easing: 1 (Ease In Out)

---

## Object Budget

Current: 697 objects
Reference video: 143-164 ACTIVE (visible on screen), but total is likely 2000+

Target: ~1500-2000 total objects:
- ~350 gameplay (current)
- ~400 background pillars (3 layers)
- ~200 glow objects
- ~100 large decorative arrows
- ~50 pulse dots
- ~50 triggers (pulse, move, color, alpha)

---

## Implementation Order

1. Add blending to existing deco objects (quick win — instant glow)
2. Add pulse triggers every 8 blocks (rhythm feel)
3. Add large decorative arrows with move triggers
4. Add color triggers at section boundaries
5. Add parallax layers
6. Add alpha fade-in at start

---

## gmdkit Implementation Notes

```python
from gmdkit.mappings import obj_prop

# Assign group to object:
o[obj_prop.GROUPS] = "1"  # or "1.2.3" for multiple groups

# Blending (additive):
# Need to check if obj_prop has BLENDING or if it's raw key 17

# Trigger objects are placed at specific X positions (where player reaches them)
# They activate when the player passes their X coordinate

# Spawn-triggered objects (key 62=1) only activate when spawned by another trigger
# Non-spawn-triggered activate when player reaches their X position
```

## Key Risk
- gmdkit may not expose all trigger properties via obj_prop
- May need to set raw integer keys directly on objects
- Test with a minimal trigger first before building the full system
