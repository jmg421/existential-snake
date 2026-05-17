// Physics — player state, gravity, jump, collision
// All positions in world units. 1 unit = 1 block = 40px.
// FLAT GROUND. No slope. Ever.

export const UNIT = 40;
export const GRAVITY = 62;
export const JUMP_VY = -17;
export const PLAYER_X = 3;
export const PLAYER_SIZE = 0.85;
const COYOTE_TIME = 0.10;
const JUMP_BUFFER = 0.20;
const SPIKE_HITBOX = 0.60;
const ORB_HITBOX = 1.20;

export function createPlayer() {
  return {
    y: 0, vy: 0, grounded: true, dead: false,
    rotation: 0, targetRotation: 0,
    coyoteTimer: 0, jumpBuffer: 0,
    gravityDir: 1,
    overlappingOrb: null,
    activatedObjects: new Set(),
    squash: 0, stretch: 0,
    wasGrounded: true,
    scaleX: 1, scaleY: 1,
    lastOrbColor: null,
    mode: 'cube', // 'cube' or 'ship'
    holding: false, // is input held (for ship mode)
    speed: 0, // 0 = use level default
    _lastSpeed: 0,
  };
}

export function updatePlayer(player, dt) {
  if (player.dead) return;
  player.wasGrounded = player.grounded;

  if (player.mode === 'ship') {
    // Ship mode: hold = fly up, release = fall
    const SHIP_GRAVITY = 25;
    const SHIP_FLY = -30;
    const SHIP_MAX_VY = 15;
    if (player.holding) {
      player.vy += SHIP_FLY * dt;
    } else {
      player.vy += SHIP_GRAVITY * dt;
    }
    player.vy = Math.max(-SHIP_MAX_VY, Math.min(SHIP_MAX_VY, player.vy));
    player.y -= player.vy * dt;
    // Ceiling
    if (player.y > 9 - PLAYER_SIZE) { player.y = 9 - PLAYER_SIZE; player.vy = 0; }
    // Floor
    if (player.y < 0) { player.y = 0; player.vy = 0; }
    player.grounded = false;
    // Ship rotation follows velocity
    player.rotation = player.vy * -3;
    player.targetRotation = player.rotation;
    player.scaleX += (1 - player.scaleX) * 0.25;
    player.scaleY += (1 - player.scaleY) * 0.25;
    return;
  }

  // Cube mode (original)
  if (player.grounded) player.coyoteTimer = COYOTE_TIME;
  else player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);

  // Jump buffer
  if (player.jumpBuffer > 0) {
    player.jumpBuffer -= dt;
    if (player.coyoteTimer > 0 || player.grounded) {
      player.vy = JUMP_VY * player.gravityDir;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpBuffer = 0;
      player.targetRotation += 90 * player.gravityDir;
      player.stretch = 3;
    }
  }

  // Gravity: vy positive = downward, y positive = up
  // gravityDir=1: gravity pulls down (vy increases), jump sets vy negative (upward)
  player.vy += GRAVITY * dt;
  player.y -= player.vy * dt;

  // Ground (normal gravity)
  if (player.gravityDir === 1 && player.y <= 0) {
    player.y = 0; player.vy = 0; player.grounded = true;
  }
  // Ceiling (flipped gravity)
  if (player.gravityDir === -1 && player.y >= 10 - PLAYER_SIZE) {
    player.y = 10 - PLAYER_SIZE; player.vy = 0; player.grounded = true;
  }

  // Rotation — lerp toward target, snap on land
  if (!player.grounded) {
    const diff = player.targetRotation - player.rotation;
    player.rotation += diff * Math.min(1, 8 * dt);
  } else {
    player.rotation = Math.round(player.rotation / 90) * 90;
    player.targetRotation = player.rotation;
  }

  // Squash/stretch decay
  const lerpRate = 0.25;
  player.scaleX += (1 - player.scaleX) * lerpRate;
  player.scaleY += (1 - player.scaleY) * lerpRate;
  if (player.stretch > 0) { player.scaleX = 0.8; player.scaleY = 1.2; player.stretch--; }
  if (player.squash > 0) { player.scaleX = 1.2; player.scaleY = 0.8; player.squash--; }

  // Landing detection
  if (!player.wasGrounded && player.grounded) player.squash = 3;
}

// Returns 'jump', 'orb', or null
export function jump(player) {
  if (player.dead) return null;

  // Orb activation
  if (player.overlappingOrb) {
    const orb = player.overlappingOrb;
    const objId = orb.beat + '_' + orb.type;
    if (!player.activatedObjects.has(objId)) {
      player.activatedObjects.add(objId);
      const t = orb.type;
      if (t === 'orb_yellow' || t === 'orb') {
        player.vy = JUMP_VY * player.gravityDir;
      } else if (t === 'orb_blue') {
        player.gravityDir *= -1;
        player.vy = JUMP_VY * player.gravityDir;
      } else if (t === 'orb_pink') {
        player.vy = JUMP_VY * 0.6 * player.gravityDir;
      }
      player.grounded = false;
      player.overlappingOrb = null;
      player.targetRotation = player.rotation + 90 * player.gravityDir;
      player.stretch = 3;
      player.lastOrbColor = t.split('_')[1] || 'yellow';
      return 'orb';
    }
  }

  // Ground/coyote jump
  if (player.grounded || player.coyoteTimer > 0) {
    player.vy = JUMP_VY * player.gravityDir;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
    player.targetRotation = player.rotation + 90 * player.gravityDir;
    player.stretch = 3;
    return 'jump';
  }

  player.jumpBuffer = JUMP_BUFFER;
  return null;
}

// Two-pass collision: blocks first, then spikes, then interactive
export function collide(player, objects, scrollX) {
  if (player.dead) return null;

  player.overlappingOrb = null;
  const pL = PLAYER_X, pR = PLAYER_X + PLAYER_SIZE;
  const pB = player.y, pT = player.y + PLAYER_SIZE;
  const landedTops = [];

  for (const obj of objects) {
    if (obj.type !== 'block') continue;
    const ox = (obj.worldX - scrollX) / UNIT;
    const ow = obj.w || 1, oh = obj.h || 1;
    if (ox > pR + 0.5 || ox + ow < pL - 0.5) continue;
    const oB = obj.y || 0, oT = oB + oh;
    if (pR <= ox || pL >= ox + ow || pT <= oB || pB >= oT) continue;

    if (player.gravityDir === 1) {
      if (player.vy > 0 && pB < oT && pB > oT - 0.3) {
        player.y = oT; player.vy = 0; player.grounded = true;
        landedTops.push(oT);
        continue;
      }
    } else {
      if (player.vy < 0 && pT > oB && pT < oB + 0.3) {
        player.y = oB - PLAYER_SIZE; player.vy = 0; player.grounded = true;
        continue;
      }
    }
    player.dead = true;
    return 'death';
  }

  // Pass 2: Spikes (shrunken hitbox)
  for (const obj of objects) {
    if (obj.type !== 'spike' && obj.type !== 'hazard') continue;
    const ox = (obj.worldX - scrollX) / UNIT;
    if (ox > pR + 0.5 || ox + 1 < pL - 0.5) continue;
    const m = (1 - SPIKE_HITBOX) / 2;
    const sL = ox + m, sR = ox + 1 - m;
    const sB = (obj.y || 0) + m, sT = (obj.y || 0) + 1 - m;
    // Skip if standing on a block at spike base
    if (player.grounded && landedTops.some(bt => Math.abs(bt - (obj.y || 0)) < 0.01)) continue;
    if (pR > sL && pL < sR && pT > sB && pB < sT) {
      player.dead = true;
      return 'death';
    }
  }

  // Pass 3: Interactive (orbs, pads, portals)
  let padResult = null;
  for (const obj of objects) {
    const ox = (obj.worldX - scrollX) / UNIT;
    if (ox > pR + 1.5 || ox + 1.5 < pL - 1.5) continue;
    const objId = obj.beat + '_' + obj.type;

    // Orbs
    if (obj.type === 'orb' || obj.type === 'orb_yellow' || obj.type === 'orb_blue' || obj.type === 'orb_pink') {
      const cx = ox + 0.5, cy = (obj.y || 3) + 0.5;
      const half = ORB_HITBOX / 2;
      if (pR > cx - half && pL < cx + half && pT > cy - half && pB < cy + half) {
        if (!player.activatedObjects.has(objId)) {
          player.overlappingOrb = obj;
        }
      }
    }

    // Pads
    const isPad = obj.type === 'pad' || obj.type === 'pad_yellow' || obj.type === 'pad_blue' || obj.type === 'pad_pink';
    if (isPad) {
      const oB2 = obj.y || 0, oT2 = oB2 + 0.4;
      if (pR > ox && pL < ox + 1 && pT > oB2 && pB < oT2) {
        if (!player.activatedObjects.has(objId)) {
          player.activatedObjects.add(objId);
          const t = obj.type === 'pad' ? 'pad_yellow' : obj.type;
          if (t === 'pad_yellow') { player.vy = JUMP_VY * 1.3; }
          else if (t === 'pad_blue') { player.gravityDir *= -1; player.vy = JUMP_VY * 1.1; }
          else if (t === 'pad_pink') { player.vy = JUMP_VY * 0.7; }
          player.grounded = false;
          player.targetRotation = player.rotation + 90 * player.gravityDir;
          player.stretch = 3;
          padResult = t.split('_')[1] || 'yellow';
        }
      }
    }

    // Gravity portals
    if (obj.type === 'portal_gravity_flip' || obj.type === 'portal_gravity_normal') {
      if (pR > ox && pL < ox + 1 && pT > -1 && pB < 12) {
        if (!player.activatedObjects.has(objId)) {
          player.activatedObjects.add(objId);
          player.gravityDir = obj.type === 'portal_gravity_flip' ? -1 : 1;
        }
      }
    }

    // Mode portals (ship/cube)
    if (obj.type === 'portal_ship' || obj.type === 'portal_cube') {
      if (pR > ox && pL < ox + 1 && pT > -1 && pB < 12) {
        if (!player.activatedObjects.has(objId)) {
          player.activatedObjects.add(objId);
          player.mode = obj.type === 'portal_ship' ? 'ship' : 'cube';
          if (player.mode === 'ship') { player.grounded = false; }
        }
      }
    }

    // Speed portals
    if (obj.type === 'portal_speed') {
      if (pR > ox && pL < ox + 1 && pT > -1 && pB < 12) {
        if (!player.activatedObjects.has(objId)) {
          player.activatedObjects.add(objId);
          player.speed = obj.speed || 13;
        }
      }
    }
  }

  if (player.speed && player.speed !== player._lastSpeed) {
    player._lastSpeed = player.speed;
    return 'speed_change';
  }
  return padResult ? 'pad_' + padResult : null;
}

export function checkFall(player) {
  if (!player.dead && (player.y < -2 || player.y > 12)) {
    player.dead = true;
    return true;
  }
  return false;
}

export function resetPlayer(player) {
  player.y = 0; player.vy = 0; player.grounded = true; player.dead = false;
  player.rotation = 0; player.targetRotation = 0;
  player.coyoteTimer = 0; player.jumpBuffer = 0;
  player.gravityDir = 1;
  player.overlappingOrb = null;
  player.activatedObjects = new Set();
  player.squash = 0; player.stretch = 0;
  player.scaleX = 1; player.scaleY = 1;
  player.wasGrounded = true;
  player.lastOrbColor = null;
  player.mode = 'cube';
  player.holding = false;
  player.speed = 0;
  player._lastSpeed = 0;
}
