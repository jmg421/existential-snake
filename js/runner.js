// Runner engine — game state, loop, collision, lane switching
import { LANE_COUNT } from './level.js';

const CANVAS_W = 600, CANVAS_H = 400;
const LANE_H = CANVAS_H / (LANE_COUNT + 1); // divide canvas into sections
const PLAYER_X = 100;
const PLAYER_W = 36, PLAYER_H = 36;
const OBJ_W = 36, OBJ_H = 36;
const LANE_SWITCH_SPEED = 12; // px per frame for smooth lane transition

export function laneY(lane) {
  return LANE_H * (lane + 1) - PLAYER_H / 2;
}

const DEBUG = location.search.includes('debug');
function log(...args) { if (DEBUG) console.log(`[runner ${(performance.now()/1000).toFixed(1)}s]`, ...args); }

export function createState(level) {
  log('createState', level.name, `speed=${level.speed} duration=${level.duration}ms events=${level.events.length}`);
  return {
    // Player
    lane: 1,
    targetLane: 1,
    playerY: laneY(1),
    jumping: false,
    jumpT: 0,
    shield: false,
    shieldTimer: 0,
    alive: true,
    started: false,
    lives: 3,
    maxLives: 5,
    invincible: false,
    invincibleTimer: 0,

    // World
    scrollSpeed: level.speed,
    scrollX: 0,
    elapsed: 0,
    upsideDown: false,

    // Objects on screen: { x, y, lane, type, subtype, w, h, active }
    objects: [],
    eventIdx: 0,

    // Score
    score: 0,
    combo: 0,
    comboTimer: 0,
    screenShake: 0,
    hue: 0,

    // Level ref
    level,
    duration: level.duration,
    complete: false,
  };
}

export function update(state, dt) {
  if (!state.alive || !state.started || state.complete) return;

  state.elapsed += dt;
  state.hue = (state.hue + 0.5) % 360;

  // Speed ramp
  state.scrollSpeed = Math.min(state.level.maxSpeed, state.level.speed + state.elapsed * state.level.speedRamp);

  // Lane position — snap to target
  state.playerY = laneY(state.targetLane);
  state.lane = state.targetLane;

  // Jump arc
  if (state.jumping) {
    state.jumpT += dt;
    if (state.jumpT > 400) { state.jumping = false; state.jumpT = 0; }
  }

  // Invincibility timer
  if (state.invincible) {
    state.invincibleTimer -= dt;
    if (state.invincibleTimer <= 0) state.invincible = false;
  }

  // Shield timer
  if (state.shield) {
    state.shieldTimer -= dt;
    if (state.shieldTimer <= 0) state.shield = false;
  }

  // Spawn events from level data
  const events = state.level.events;
  while (state.eventIdx < events.length && events[state.eventIdx].t <= state.elapsed) {
    const ev = events[state.eventIdx];
    if (ev.type === 'obstacle' || ev.type === 'collectible') {
      state.objects.push({
        x: CANVAS_W + 50,
        y: laneY(ev.lane),
        lane: ev.lane,
        type: ev.type,
        subtype: ev.subtype,
        w: OBJ_W,
        h: OBJ_H,
        active: true,
      });
      log(`spawn ${ev.type}:${ev.subtype} lane=${ev.lane} t=${ev.t}`);
    } else if (ev.type === 'dimension_flip') {
      state.upsideDown = !state.upsideDown;
      state.screenShake = 15;
      log(`dimension flip → ${state.upsideDown ? 'UPSIDE DOWN' : 'RIGHT-SIDE UP'}`);
    }
    state.eventIdx++;
  }

  // Move objects
  for (const obj of state.objects) {
    if (!obj.active) continue;
    obj.x -= state.scrollSpeed;
  }

  // Remove off-screen
  state.objects = state.objects.filter(o => o.x > -60);

  // Collision with player
  const jumpOffset = state.jumping ? -Math.sin(state.jumpT / 400 * Math.PI) * 50 : 0;
  const px = PLAYER_X, py = state.playerY + jumpOffset;

  for (const obj of state.objects) {
    if (!obj.active) continue;
    // AABB
    if (px < obj.x + obj.w && px + PLAYER_W > obj.x &&
        py < obj.y + obj.h && py + PLAYER_H > obj.y) {
      if (obj.type === 'obstacle') {
        if (state.jumping || state.shield || state.invincible) {
          obj.active = false;
          if (state.shield) { state.shield = false; log('shield absorbed hit'); }
          if (state.jumping) { state.score += 2; log('jumped over obstacle +2'); }
          state.screenShake = 8;
        } else {
          obj.active = false;
          state.lives--;
          state.invincible = true;
          state.invincibleTimer = 2000;
          state.screenShake = 15;
          log(`HIT by ${obj.subtype} lane=${obj.lane} lives=${state.lives}`);
          if (state.lives <= 0) {
            state.alive = false;
            state.screenShake = 20;
            log('DEAD — no lives remaining');
          }
        }
      } else if (obj.type === 'collectible') {
        obj.active = false;
        if (obj.subtype === 'heart') {
          if (state.lives < state.maxLives) { state.lives++; log(`heart pickup lives=${state.lives}`); }
        } else {
          const pts = obj.subtype === 'eggo' ? 1 : obj.subtype === 'light' ? 3 : 0;
          state.score += pts;
          log(`collect ${obj.subtype} +${pts} score=${state.score}`);
          if (obj.subtype === 'walkie') { state.shield = true; state.shieldTimer = 5000; log('shield activated 5s'); }
        }
        state.combo++;
        state.comboTimer = 2000;
        state.screenShake = 6 + state.combo;
      }
    }
  }

  // Combo decay
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // Screen shake decay
  if (state.screenShake > 0) state.screenShake *= 0.9;

  // Level complete
  if (state.elapsed >= state.duration) {
    state.complete = true;
    log(`LEVEL COMPLETE score=${state.score} lives=${state.lives}`);
  }
}

export function switchLane(state, dir) {
  const next = state.targetLane + dir;
  if (next >= 0 && next < LANE_COUNT) { state.targetLane = next; log(`switchLane → ${next}`); }
}

export function jump(state) {
  if (!state.jumping) { state.jumping = true; state.jumpT = 0; log('jump'); }
}

export { CANVAS_W, CANVAS_H, LANE_H, PLAYER_X, PLAYER_W, PLAYER_H, OBJ_W, OBJ_H };
