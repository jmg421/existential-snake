// Runner engine — game state, loop, collision, lane switching
import { LANE_COUNT } from './level.js';

let onEvent = null;

export function setEventHandler(fn) { onEvent = fn; }

function emit(type, data) { if (onEvent) onEvent(type, data); }

const CANVAS_W = 800, CANVAS_H = 400;
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
    const jDur = state.jumpDuration || 400;
    if (state.jumpT > jDur) { state.jumping = false; state.jumpT = 0; }
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
      emit('dimension_flip', state.upsideDown);
      log(`dimension flip → ${state.upsideDown ? 'UPSIDE DOWN' : 'RIGHT-SIDE UP'}`);
    } else if (ev.type === 'boss') {
      state.boss = {
        subtype: ev.subtype,
        hp: ev.subtype === 'vecna' ? 5 : 3,
        maxHp: ev.subtype === 'vecna' ? 5 : 3,
        x: CANVAS_W - 80,
        attackTimer: 0,
        attackInterval: ev.subtype === 'vecna' ? 1200 : 1800,
        defeated: false,
      };
      state.scrollSpeed = 0; // stop scrolling during boss
      emit('boss_start', ev.subtype);
      log(`BOSS: ${ev.subtype} hp=${state.boss.hp}`);
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
          if (state.shield) { state.shield = false; log('shield absorbed hit'); emit('shield'); }
          if (state.jumping) { state.score += 2; log('jumped over obstacle +2'); emit('dodge'); }
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
            emit('death');
          } else {
            emit('hit');
          }
        }
      } else if (obj.type === 'collectible') {
        obj.active = false;
        emit('collect', obj.subtype);
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
  if (state.screenShake > 0) { state.screenShake *= 0.85; if (state.screenShake < 0.5) state.screenShake = 0; }

  // Boss update
  if (state.boss && !state.boss.defeated) {
    state.boss.attackTimer += dt;
    if (state.boss.attackTimer >= state.boss.attackInterval) {
      state.boss.attackTimer = 0;
      // Fire projectile at a random lane
      const lane = Math.floor(Math.random() * LANE_COUNT);
      state.objects.push({
        x: state.boss.x,
        y: laneY(lane),
        lane, type: 'obstacle', subtype: 'boss_attack',
        w: OBJ_W, h: OBJ_H, active: true,
        vx: -6, // moves left faster than normal
      });
      // Sometimes fire two lanes
      if (state.boss.hp <= state.boss.maxHp / 2) {
        const lane2 = [0,1,2].filter(l => l !== lane)[Math.floor(Math.random() * 2)];
        state.objects.push({
          x: state.boss.x,
          y: laneY(lane2),
          lane: lane2, type: 'obstacle', subtype: 'boss_attack',
          w: OBJ_W, h: OBJ_H, active: true,
          vx: -5,
        });
      }
      emit('boss_attack');
    }
    // Player damages boss by jumping near it
    if (state.jumping && state.jumpT > 100 && state.jumpT < 300) {
      if (!state.boss._hitThisJump) {
        state.boss.hp--;
        state.boss._hitThisJump = true;
        state.screenShake = 12;
        state.score += 5;
        emit('boss_hit', state.boss.hp);
        log(`BOSS HIT hp=${state.boss.hp}`);
        if (state.boss.hp <= 0) {
          state.boss.defeated = true;
          state.score += 20;
          state.screenShake = 20;
          emit('boss_defeated', state.boss.subtype);
          log('BOSS DEFEATED');
        }
      }
    }
    if (!state.jumping) state.boss._hitThisJump = false;
  }

  // Move objects (boss projectiles have custom vx)
  for (const obj of state.objects) {
    if (!obj.active) continue;
    if (obj.vx !== undefined) obj.x += obj.vx;
  }

  // Level complete — requires boss defeated if boss exists
  if (state.elapsed >= state.duration) {
    if (state.boss && !state.boss.defeated) {
      // Don't complete until boss is dead — extend duration
      state.duration += dt;
    } else {
      state.complete = true;
      log(`LEVEL COMPLETE score=${state.score} lives=${state.lives}`);
    }
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
