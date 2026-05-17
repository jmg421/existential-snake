# GD Physics Reference (from camila314/gdp decompilation)

Source: https://github.com/camila314/gdp/tree/2.2/PlayerObject

## FIRST PRINCIPLE

**No object stack in the player's path should exceed 2 blocks above the player's current ground level.**

- 1 block above ground: trivially jumpable
- 2 blocks above ground: barely jumpable (peak of jump arc)
- 3+ blocks above ground: DEATH (player hits the wall)

The player's "current ground level" changes as they land on platforms. A staircase works because each step is +1 from where the player currently stands.

## Speed Modes (from PlayerObject_updateTimeMod.cpp)

| Speed Portal | m_playerSpeed | m_yStart (jump vel) | m_gravity | m_speedMultiplier |
|:-------------|:--------------|:--------------------|:----------|:------------------|
| 0.5x (ID 200) | 0.7 | 10.620032 | 0.940199 | 5.980002 |
| 1x (ID 201) | 0.9 | 11.1800318 | 0.958199024 | 5.77000189 |
| 2x (ID 202) | 1.1 | 11.420032 | 0.957199 | 5.870002 |
| 3x (ID 203) | 1.3 | 11.230032 | 0.961199 | 6.000002 |
| 4x (ID 1334) | 1.6 | 11.230032 | 0.961199 | 6.000002 |

## Cube Physics (from PlayerObject_updateJump.cpp)

### Jump
- Jump velocity: `flipMod * m_yStart * sizeMod`
  - sizeMod = 1.0 (normal), 0.8 (mini)
- Applied when: `m_isOnGround && jumpBuffered`

### Gravity (falling)
- Per-frame: `addToYVelocity(-m_gravity * dt * flipMod * float_b)`
  - float_b = 1.0 (cube), 0.6 (ball/spider/swing), 0.9 (robot)
- Max fall speed: clamped to -15 (or +15 if upside down)

### Horizontal Speed
- X movement per second = `m_playerSpeed * m_speedMultiplier * 30 * 10`
  - At 1x: 0.9 * 5.77 * 30 * 10 ≈ 155.79 units/sec... 
  - Actually: base speed = 5.77 blocks/sec at 1x? Need to verify units.

### Known Jump Distances (from community + corpus)
- 1x speed: ~3.6 blocks horizontal per jump
- 2x speed: ~4.6 blocks horizontal per jump  
- 3x speed: ~5.6 blocks horizontal per jump

### Frame Rate
- GD runs physics at 240 steps/sec internally (or 60fps with dt=1/60)
- dt in updateJump is the frame delta time

## Collision (from PlayerObject_collidedWithObjectInternal.cpp)
- Player hitbox: approximately 0.85 * block_size (30 units)
- Spike hitbox: approximately 0.6-0.7 * block_size
- Landing tolerance: player must be within ~3 units of block top to land

## Ship Physics
- Max Y velocity: ±8.0
- Gravity: 0.9582 (same as ball)
- Hold = accelerate up, release = fall

## Key Insight
- GD uses VARIABLE dt (frame time), not fixed timestep
- At 60fps: dt ≈ 0.01667
- Gravity per frame at 2x: 0.957199 * 0.01667 ≈ 0.01596 (velocity units per frame)
- Jump vel at 2x: 11.42 (velocity units)
- Frames to peak: 11.42 / 0.01596 ≈ 715 frames... that can't be right

## Units Clarification Needed
- m_yVelocity is in "units per frame" not "units per second"
- Gravity is applied as: yVel -= gravity * dt
- If dt = 1/60: yVel -= 0.9572 / 60 = 0.01595 per frame
- But max fall = 15, and jump = 11.42
- Time to peak: 11.42 / (0.9572) ≈ 11.9 frames at 60fps = 0.2s
- That gives jump height of: 11.42 * 11.9 / 2 ≈ 68 units ≈ 2.3 blocks

Wait - gravity is NOT divided by dt. Looking at the code:
  `addToYVelocity(-float_c * dt * flipMod * float_b)`
  float_c = gravity = 0.9572
  So per frame: yVel change = -0.9572 * (1/60) = -0.01595

But yStart = 11.42 seems too high relative to gravity of 0.016/frame.
Unless yVelocity is in blocks/sec and gravity is in blocks/sec^2?

## Actual Calculation (assuming velocity in blocks/sec, gravity in blocks/sec/frame)
- Jump vel: 11.42 blocks/sec upward
- Gravity: 0.9572 blocks/sec per frame (at 60fps = 57.4 blocks/sec^2)
- Time to peak: 11.42 / 57.4 = 0.199s
- Peak height: 0.5 * 11.42 * 0.199 = 1.136 blocks ✓ (matches observed ~1 block)
- Air time: 0.398s
- At 2x speed (horizontal): need to determine X speed

## X Speed
From GJBaseGameLayer or PlayLayer - the level scrolls at:
  baseSpeed * m_playerSpeed * m_speedMultiplier
  
Community-measured values:
- 0.5x: 251.16 units/sec
- 1x: 311.58 units/sec  
- 2x: 387.42 units/sec
- 3x: 468.00 units/sec
- 4x: 576.00 units/sec

At 2x, jump distance = 387.42 * 0.398 = 154.2 units = 5.14 blocks

## Summary for Level Generation
At 2x speed:
- Jump height: ~1.1 blocks (33 units)
- Jump distance: ~5.1 blocks (154 units)  
- Air time: ~0.4s
- Max fall speed: 15 velocity units
