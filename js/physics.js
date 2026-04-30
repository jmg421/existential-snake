// Physics — player state, gravity, jump, collision
// All positions in world units. 1 unit = 1 block = 40px.

export const UNIT = 40;          // pixels per unit
export const GRAVITY = 62;       // units/s²
export const JUMP_VY = -18;      // units/s (negative = up)
export const PLAYER_X = 3;       // fixed world-x position (units from left of screen)
export const PLAYER_SIZE = 0.85; // unit fraction

export function createPlayer() {
  return {
    y: 0,           // units above ground (0 = on ground)
    vy: 0,          // vertical velocity
    grounded: true,
    dead: false,
    rotation: 0,    // visual rotation (degrees)
  };
}

// Update player physics. dt in seconds.
export function updatePlayer(player, dt) {
  if (player.dead) return;
  player.vy += GRAVITY * dt;
  player.y -= player.vy * dt; // y increases upward in world, vy negative = up
  // Ground
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }
  // Rotation — cube rotates 90° per jump (like GD)
  if (!player.grounded) {
    player.rotation += 360 * dt; // ~1 full rotation per second in air
  } else {
    // Snap to nearest 90°
    player.rotation = Math.round(player.rotation / 90) * 90;
  }
}

export function jump(player) {
  if (player.grounded && !player.dead) {
    player.vy = JUMP_VY;
    player.grounded = false;
  }
}

// Resolve collisions with level objects.
// scrollX = current scroll position in pixels.
// objects = array of { worldX, type, w, h, y } in world units.
// Returns true if player died.
export function collide(player, objects, scrollX) {
  if (player.dead) return false;
  const px = PLAYER_X * UNIT;                    // player screen x (pixels)
  const py = player.y * UNIT;                     // player height in pixels (from ground up)
  const ps = PLAYER_SIZE * UNIT;

  for (const obj of objects) {
    const ox = obj.worldX - scrollX;              // object screen x
    if (ox > px + ps + 20 || ox + obj.w * UNIT < px - 20) continue; // off screen
    const oy = (obj.y || 0) * UNIT;              // object base height
    const oh = (obj.h || 1) * UNIT;
    const ow = (obj.w || 1) * UNIT;

    // AABB overlap
    const overlapX = px < ox + ow && px + ps > ox;
    const overlapY = py < oy + oh && py + ps > oy;

    if (!overlapX || !overlapY) continue;

    if (obj.type === 'spike' || obj.type === 'hazard') {
      player.dead = true;
      return true;
    }

    if (obj.type === 'block') {
      // Landing on top
      const prevBottom = py + ps;
      if (player.vy > 0 && prevBottom >= oy + oh - 4) {
        player.y = (oy + oh) / UNIT;
        player.vy = 0;
        player.grounded = true;
      }
    }

    if (obj.type === 'pad') {
      player.vy = JUMP_VY * 1.4; // boost jump
      player.grounded = false;
    }
  }
  return false;
}

// Check if player fell into a gap (below ground with no block under them)
export function checkFall(player) {
  if (player.y < -1 && !player.dead) {
    player.dead = true;
    return true;
  }
  return false;
}

export function resetPlayer(player) {
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  player.dead = false;
  player.rotation = 0;
}
