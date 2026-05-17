// Game — main loop: beat clock → physics → collision → sfx → particles → render
import { initAudio, loadSong, play, stop, restart, setSyncParams, songTime, beat, duration, totalBeats, getBpm } from './beat-clock.js';
import { UNIT, PLAYER_X, PLAYER_SIZE, createPlayer, updatePlayer, jump, collide, checkFall, resetPlayer } from './physics.js';
import { render, CW, CH } from './gd-renderer.js';
import { importGDLevel } from './gd-import.js';
import { playJump, playDeath, playLand, playOrb, playPad, playCheckpoint, playComplete, playRestart } from './sfx.js';
import * as P from './particles.js';

const VERSION = 'c98e313';

let level = null;
let player = createPlayer();
let attempts = 1;
let lastFrameTime = 0;
let deathFreezeFrames = 0;
let flash = 0, flashColor = null, shake = 0;
let bg = [10, 0, 30], gnd = [40, 0, 80];
let targetBg = bg, targetGnd = gnd;
let started = false, won = false;
let checkpoint = 0, checkpointMsg = '', checkpointMsgTimer = 0;
let worldObjects = [], levelEndBeat = 0;
let trailTimer = 0;
let invincibleFrames = 0;
let speedMultiplier = 1.0;
let speedChangeOffset = 0;
let speedChangeTime = 0;

const canvas = document.getElementById('c');
canvas.width = CW; canvas.height = CH;
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const scaleX = (window.innerWidth - 20) / CW;
  const scaleY = (window.innerHeight - 100) / CH;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = (CW * scale) + 'px';
  canvas.style.height = (CH * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

async function loadLevel(url) {
  const resp = await fetch(url);
  level = await resp.json();
  setSyncParams(level.meta.bpm, level.meta.offset || 0);
  await loadSong(level.meta.song);
  const pxPerBeat = level.meta.speed * UNIT;
  worldObjects = level.objects.map(o => ({
    ...o, worldX: o.beat * pxPerBeat, w: o.w || 1, h: o.h || 1,
  }));
  const lastBeat = Math.max(...level.objects.map(o => o.beat));
  levelEndBeat = lastBeat + 8;
  if (level.triggers.length) {
    const first = level.triggers.find(t => t.type === 'color');
    if (first) { bg = [...first.bg]; gnd = [...first.ground]; targetBg = bg; targetGnd = gnd; }
  }
}

let lastTriggerIdx = 0;
function processTriggers(currentBeat) {
  if (!level) return;
  while (lastTriggerIdx < level.triggers.length && level.triggers[lastTriggerIdx].beat <= currentBeat) {
    const t = level.triggers[lastTriggerIdx];
    if (t.type === 'color') { targetBg = t.bg; targetGnd = t.ground; }
    else if (t.type === 'flash') { flash = 0.5; flashColor = null; }
    else if (t.type === 'shake') { shake = 10; }
    lastTriggerIdx++;
  }
}

function lerpColors(dt) {
  const rate = 3 * dt;
  for (let i = 0; i < 3; i++) {
    bg[i] += (targetBg[i] - bg[i]) * rate;
    gnd[i] += (targetGnd[i] - gnd[i]) * rate;
  }
}

function die() {
  if (deathFreezeFrames > 0) { console.log('die() called while already dying!'); return; }
  deathFreezeFrames = 3;
  flash = 0.4; flashColor = 'rgba(255,0,0,0.4)'; shake = 12;
  playDeath();
  P.emitDeath(PLAYER_X + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2, 0, 255, 0);
}

function restartLevel() {
  console.log('restartLevel: checkpoint', checkpoint, 'attempts', attempts);
  resetPlayer(player);
  P.clear();
  lastTriggerIdx = 0;
  // Always restart from beginning (GD normal mode behavior)
  if (level) {
    const first = level.triggers.find(t => t.type === 'color');
    if (first) { bg = [...first.bg]; gnd = [...first.ground]; targetBg = [...first.bg]; targetGnd = [...first.ground]; }
  }
  flash = 0; shake = 0;
  speedMultiplier = 1.0; speedChangeOffset = 0; speedChangeTime = 0;
  attempts++;
  invincibleFrames = 3;
  playRestart();
  restart(0);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 0.016;
  lastFrameTime = now;

  if (!started || !level) { render(ctx, buildState()); return; }

  if (deathFreezeFrames > 0) {
    deathFreezeFrames--;
    P.update(dt);
    if (deathFreezeFrames === 0) restartLevel();
    render(ctx, buildState());
    return;
  }

  const currentBeat = beat();
  const baseSpeed = level.meta.speed * UNIT * getBpm() / 60;
  const scrollX = speedChangeOffset + (songTime() - speedChangeTime) * baseSpeed * speedMultiplier;
  const songPct = Math.min(1, currentBeat / levelEndBeat);

  // Checkpoint (cosmetic — track best progress, always restart from 0)
  const pctFloor = Math.floor(songPct * 20) / 20;
  if (pctFloor > checkpoint) {
    checkpoint = pctFloor;
    checkpointMsg = `${Math.round(checkpoint * 100)}%`;
    checkpointMsgTimer = 1.2;
    flash = 0.15; flashColor = null;
    playCheckpoint();
    P.emitCheckpoint(PLAYER_X + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
  }
  if (checkpointMsgTimer > 0) checkpointMsgTimer -= dt;

  // Win
  if (songPct >= 1 && !won) { won = true; stop(); playComplete(); return; }
  if (won) return;

  // Physics
  const wasGrounded = player.grounded;
  updatePlayer(player, dt);

  // Landing detection
  if (!wasGrounded && player.grounded) {
    playLand();
    P.emitLand(PLAYER_X + PLAYER_SIZE / 2, player.y, gnd[0], gnd[1], gnd[2]);
  }

  // Collision
  if (invincibleFrames > 0) { invincibleFrames--; }
  else {
    const result = collide(player, worldObjects, scrollX);
    if (result === 'death' || checkFall(player)) {
      console.log('DEATH at beat', currentBeat.toFixed(1), 'scrollX', scrollX.toFixed(0), 'y', player.y.toFixed(2), 'vy', player.vy.toFixed(2), 'attempt', attempts, 'freezeFrames', deathFreezeFrames);
      die();
    } else if (result === 'speed_change') {
      // Accumulate offset so scroll doesn't jump
      speedChangeOffset = scrollX;
      speedChangeTime = songTime();
      speedMultiplier = player.speed / level.meta.speed;
    } else if (result && result.startsWith('pad_')) {
      const color = result.split('_')[1];
      playPad(color);
    }
  }

  // Trail particles
  if (!player.dead) {
    trailTimer += dt;
    if (trailTimer > 0.05) {
      trailTimer = 0;
      P.emitTrail(PLAYER_X, player.y + PLAYER_SIZE / 2, 0, 200, 0);
    }
  }

  // Triggers + effects
  processTriggers(currentBeat);
  lerpColors(dt);
  P.update(dt);
  if (flash > 0) flash -= dt * 4;
  if (shake > 0) shake *= 0.88;

  render(ctx, { ...buildState(), scrollX, songPct });
}

function buildState() {
  return {
    player, scrollX: started ? speedChangeOffset + (songTime() - speedChangeTime) * (level?.meta.speed || 8) * UNIT * getBpm() / 60 * speedMultiplier : 0,
    level, objects: worldObjects, triggers: level?.triggers || [],
    flash: Math.max(0, flash), flashColor,
    shake: shake > 0.5 ? shake : 0, attempts,
    songPct: started ? Math.min(1, beat() / levelEndBeat) : 0,
    bg, gnd, checkpoint, won, checkpointMsg, checkpointMsgTimer, version: VERSION,
  };
}

function onTap() {
  if (!started) {
    started = true;
    initAudio();
    play();
    return;
  }
  if (player.dead) return;
  if (player.mode === 'ship') return; // ship uses hold, not tap
  const result = jump(player);
  if (result === 'orb') {
    playOrb(player.lastOrbColor || 'yellow');
    const orbColors = { yellow: [255, 255, 0], blue: [68, 136, 255], pink: [255, 68, 255] };
    const c = orbColors[player.lastOrbColor] || orbColors.yellow;
    P.emitOrb(PLAYER_X + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2, c[0], c[1], c[2]);
  } else if (result === 'jump') {
    playJump();
    P.emitJump(PLAYER_X + PLAYER_SIZE / 2, player.y);
  }
}

function onHold() {
  if (!started) { started = true; initAudio(); play(); }
  player.holding = true;
}
function onRelease() { player.holding = false; }

canvas.addEventListener('mousedown', e => { onHold(); onTap(); });
canvas.addEventListener('mouseup', onRelease);
canvas.addEventListener('touchstart', e => { e.preventDefault(); onHold(); onTap(); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); onRelease(); }, { passive: false });
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) { onHold(); onTap(); } }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') onRelease();
});

// GD Level Browser + Import
const importBtn = document.getElementById('importBtn');
const importModal = document.getElementById('importModal');
const gdImport = document.getElementById('gdImport');
const gdCancel = document.getElementById('gdCancel');
const gdStatus = document.getElementById('gdStatus');
const gdResults = document.getElementById('gdResults');
const gdSearchBtn = document.getElementById('gdSearchBtn');

const GD_API = 'https://www.boomlings.com/database/';
const PROXY = 'https://corsproxy.io/?url=';
const DIFF_NAMES = { 0: '?', 10: 'Easy', 20: 'Normal', 30: 'Hard', 40: 'Harder', 50: 'Insane' };
const DEMON_NAMES = { 3: 'Easy Demon', 4: 'Medium Demon', 0: 'Hard Demon', 5: 'Insane Demon', 6: 'Extreme Demon' };

importBtn?.addEventListener('click', () => { importModal.style.display = 'flex'; });
gdCancel?.addEventListener('click', () => { importModal.style.display = 'none'; gdStatus.textContent = ''; });

async function gdPost(endpoint, params) {
  const body = new URLSearchParams({ secret: 'Wmfd2893gb7', ...params });
  const url = PROXY + encodeURIComponent(GD_API + endpoint);
  console.log('[GD API]', endpoint, params);
  console.log('[GD API] URL:', url);
  const resp = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  console.log('[GD API] Status:', resp.status, resp.statusText);
  const text = await resp.text();
  console.log('[GD API] Response:', text.substring(0, 300) + (text.length > 300 ? '...' : ''));
  return text;
}

function parseLevelList(text) {
  const parts = text.split('#');
  if (!parts[0] || parts[0] === '-1') return [];
  return parts[0].split('|').map(lstr => {
    const m = {};
    const kv = lstr.split(':');
    for (let i = 0; i < kv.length - 1; i += 2) m[kv[i]] = kv[i + 1];
    const diff = m[17] === '1' ? (DEMON_NAMES[parseInt(m[43])] || 'Demon') :
      (parseInt(m[8]) === 0 ? 'N/A' : DIFF_NAMES[parseInt(m[9])] || '?');
    return { id: m[1], name: m[2], downloads: parseInt(m[10]) || 0, likes: parseInt(m[14]) || 0, diff, stars: m[18] || '0', length: ['Tiny','Short','Medium','Long','XL'][parseInt(m[15])] || '?' };
  });
}

gdSearchBtn?.addEventListener('click', async () => {
  const query = document.getElementById('gdSearch').value.trim();
  const type = document.getElementById('gdType').value;
  gdStatus.textContent = 'Searching...';
  gdResults.innerHTML = '';
  try {
    const text = await gdPost('getGJLevels21.php', { str: query, type, page: 0 });
    const levels = parseLevelList(text);
    if (!levels.length) { gdStatus.textContent = 'No levels found'; return; }
    gdStatus.textContent = `Found ${levels.length} levels`;
    for (const lv of levels) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#111;border:1px solid #333;padding:8px 12px;border-radius:4px;cursor:pointer;gap:8px';
      row.innerHTML = `<div style="flex:1;min-width:0"><div style="color:#0f0;font:bold 13px monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lv.name}</div><div style="color:#888;font:11px monospace">${lv.diff} ⭐${lv.stars} | ${lv.length} | ❤️${lv.likes.toLocaleString()} | ⬇${lv.downloads.toLocaleString()}</div></div><button style="background:#0f0;color:#000;border:none;padding:4px 12px;cursor:pointer;font:bold 11px monospace;border-radius:3px;white-space:nowrap" data-id="${lv.id}">PLAY</button>`;
      row.querySelector('button').addEventListener('click', () => loadGDLevel(lv.id, lv.name));
      gdResults.appendChild(row);
    }
  } catch (e) { gdStatus.textContent = 'Error: ' + e.message; }
});

document.getElementById('gdSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') gdSearchBtn.click(); });

async function loadGDLevel(id, name) {
  console.log('[GD] Loading level', id, name);
  gdStatus.textContent = `Downloading level ${id}...`;
  try {
    const text = await gdPost('downloadGJLevel22.php', { levelID: id });
    if (text === '-1') { console.log('[GD] Level not found'); gdStatus.textContent = 'Level not found'; throw new Error('Level not found'); }
    const kv = text.split(':');
    const m = {};
    for (let i = 0; i < kv.length - 1; i += 2) m[kv[i]] = kv[i + 1];
    const levelStr = m[4];
    console.log('[GD] Level keys:', Object.keys(m).join(','));
    console.log('[GD] Level string length:', levelStr?.length || 0);
    if (!levelStr) { gdStatus.textContent = 'No level data in response'; throw new Error('No level data'); }
    gdStatus.textContent = 'Parsing...';
    const bpm = parseInt(document.getElementById('gdBpm').value) || 140;
    const imported = importGDLevel(levelStr, { bpm, name: name || 'GD Import' });
    console.log('[GD] Imported:', imported.objects.length, 'objects,', imported.triggers.length, 'triggers');
    console.log('[GD] Object types:', [...new Set(imported.objects.map(o => o.type))].join(', '));
    gdStatus.textContent = `${imported.objects.length} objects. Loading...`;
    await loadLevelData(imported);
    importModal.style.display = 'none'; gdStatus.textContent = '';
  } catch (e) { console.error('[GD] Error:', e); gdStatus.textContent = 'Error: ' + e.message; }
}

// Paste import (fallback)
gdImport?.addEventListener('click', async () => {
  const data = document.getElementById('gdData').value.trim();
  const bpm = parseInt(document.getElementById('gdBpm').value) || 140;
  if (!data) { gdStatus.textContent = 'Paste level data first'; return; }
  try {
    gdStatus.textContent = 'Parsing...';
    const imported = importGDLevel(data, { bpm });
    gdStatus.textContent = `${imported.objects.length} objects. Loading...`;
    await loadLevelData(imported);
    importModal.style.display = 'none'; gdStatus.textContent = '';
  } catch (e) { gdStatus.textContent = 'Error: ' + e.message; }
});

async function loadLevelData(data) {
  level = data;
  setSyncParams(level.meta.bpm, level.meta.offset || 0);
  await loadSong(level.meta.song);
  const pxPerBeat = level.meta.speed * UNIT;
  worldObjects = level.objects.map(o => ({ ...o, worldX: o.beat * pxPerBeat, w: o.w || 1, h: o.h || 1 }));
  levelEndBeat = Math.max(...level.objects.map(o => o.beat)) + 8;
  lastTriggerIdx = 0;
  if (level.triggers?.length) {
    const first = level.triggers.find(t => t.type === 'color');
    if (first) { bg = [...first.bg]; gnd = [...first.ground]; targetBg = bg; targetGnd = gnd; }
  }
  resetPlayer(player); P.clear();
  started = false; won = false; attempts = 1; checkpoint = 0;
}

(async () => {
  await loadLevel('levels/void-reaper.json');
  requestAnimationFrame(frame);
})();
