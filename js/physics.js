// Physics — player state, gravity, jump, collision
// All positions in world units. 1 unit = 1 block = 40px.

export const UNIT = 40;          // pixels per unit
export const GRAVITY = 45;       // units/s² (tuned down from 62)
export const JUMP_VY = -14;      // units/s (tuned for floatier jump)
export const PLAYER_X = 3;       // fixed world-x position (units from left of screen)
export const PLAYER_SIZE = 0.85; // unit fraction
const COYOTE_TIME = 0.08;        // seconds you can still jump after leaving ground
const JUMP_BUFFER = 0.12;        // seconds a jump press is remembered

export function createPlayer() {
  return {
    y: 0,
    vy: 0,
    grounded: true,
    dead: false,
    rotation: 0,
    coyoteTimer: 0,
    jumpBuffer: 0,
  };
}

// Update player physics. dt in seconds.
export function updatePlayer(player, dt) {
  if (player.dead) return;

  // Coyote timer — allows jumping briefly after leaving ground
  if (player.grounded) player.coyoteTimer = COYOTE_TIME;
  else player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);

  // Jump buffer — if jump was pressed recently, execute it now
  if (player.jumpBuffer > 0) {
    player.jumpBuffer -= dt;
    if (player.coyoteTimer > 0 || player.grounded) {
      player.vy = JUMP_VY;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpBuffer = 0;
    }
  }

  player.vy += GRAVITY * dt;
  player.y -= player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }
  // Rotation
  if (!player.grounded) {
    player.rotation += 360 * dt;
  } else {
    player.rotation = Math.round(player.rotation / 90) * 90;
  }
}

export function jump(player) {
  if (player.dead) return;
  // If grounded or within coyote time, jump immediately
  if (player.grounded || player.coyoteTimer > 0) {
    player.vy = JUMP_VY;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
  } else {
    // Buffer the jump for when we land
    player.jumpBuffer = JUMP_BUFFER;
  }
}

// Resolve collisions with level objects.
export function collide(player, objects, scrollX) {
  if (player.dead) return false;
  const px = PLAYER_X * UNIT;
  const py = player.y * UNIT;
  const ps = PLAYER_SIZE * UNIT;

  for (const obj of objects) {
    const ox = obj.worldX - scrollX;
    if (ox > px + ps + 20 || ox + obj.w * UNIT < px - 20) continue;
    const oy = (obj.y || 0) * UNIT;
    const oh = (obj.h || 1) * UNIT;
    const ow = (obj.w || 1) * UNIT;

    const overlapX = px < ox + ow && px + ps > ox;
    const overlapY = py < oy + oh && py + ps > oy;

    if (!overlapX || !overlapY) continue;

    if (obj.type === 'spike' || obj.type === 'hazard') {
      player.dead = true;
      return true;
    }

    if (obj.type === 'block') {
      // Landing on top — generous: if falling and player bottom is within half a unit of block top
      const blockTop = (oy + oh) / UNIT;
      if (player.vy > 0 && player.y < blockTop + 0.5) {
        player.y = blockTop;
        player.vy = 0;
        player.grounded = true;
      } else {
        player.dead = true;
        return true;
      }
    }

    if (obj.type === 'pad') {
      player.vy = JUMP_VY * 1.4;
      player.grounded = false;
    }
  }
  return false;
}

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
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
}
