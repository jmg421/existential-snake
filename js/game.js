// Game — main loop: beat clock → physics → collision → render → instant restart
import { initAudio, loadSong, play, stop, restart as restartSong, setSyncParams, songTime, beat, duration, totalBeats, isPlaying, getBpm } from './beat-clock.js';
import { UNIT, PLAYER_X, createPlayer, updatePlayer, jump, collide, checkFall, resetPlayer } from './physics.js';
import { render, CW, CH } from './gd-renderer.js';

let level = null;
let player = createPlayer();
let attempts = 1;
let lastFrameTime = 0;
let deathFreezeFrames = 0;
let flash = 0;
let flashColor = null;
let shake = 0;
let bg = [10, 0, 30];
let gnd = [40, 0, 80];
let targetBg = bg;
let targetGnd = gnd;
let started = false;
let checkpoint = 0;      // best 5% increment reached (0.0, 0.05, 0.10, ...)
let won = false;
let checkpointMsg = '';
let checkpointMsgTimer = 0;
// Precomputed world-x positions for all objects
let worldObjects = [];
let levelEndBeat = 0;

const canvas = document.getElementById('c');
canvas.width = CW;
canvas.height = CH;
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const scale = Math.min(1, (window.innerWidth - 20) / CW);
  canvas.style.width = (CW * scale) + 'px';
  canvas.style.height = (CH * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Load level
async function loadLevel(url) {
  const resp = await fetch(url);
  level = await resp.json();
  setSyncParams(level.meta.bpm, level.meta.offset || 0);
  await loadSong(level.meta.song);
  // Precompute world-x for each object
  const pxPerBeat = level.meta.speed * UNIT;
  worldObjects = level.objects.map(o => ({
    ...o,
    worldX: o.beat * pxPerBeat,
    w: o.w || 1,
    h: o.h || 1,
  }));
  // Level ends 8 beats after last obstacle
  const lastBeat = Math.max(...level.objects.map(o => o.beat));
  levelEndBeat = lastBeat + 8;
  // Set initial colors
  if (level.triggers.length) {
    const first = level.triggers.find(t => t.type === 'color');
    if (first) { bg = [...first.bg]; gnd = [...first.ground]; targetBg = bg; targetGnd = gnd; }
  }
}

// Process triggers for current beat
let lastTriggerIdx = 0;
function processTriggers(currentBeat) {
  if (!level) return;
  while (lastTriggerIdx < level.triggers.length && level.triggers[lastTriggerIdx].beat <= currentBeat) {
    const t = level.triggers[lastTriggerIdx];
    if (t.type === 'color') {
      targetBg = t.bg;
      targetGnd = t.ground;
    } else if (t.type === 'flash') {
      flash = 0.5;
      flashColor = null;
    } else if (t.type === 'shake') {
      shake = 10;
    }
    lastTriggerIdx++;
  }
}

// Lerp colors toward targets
function lerpColors(dt) {
  const rate = 3 * dt;
  for (let i = 0; i < 3; i++) {
    bg[i] += (targetBg[i] - bg[i]) * rate;
    gnd[i] += (targetGnd[i] - gnd[i]) * rate;
  }
}

// Instant restart
function die() {
  deathFreezeFrames = 3;
  flash = 0.4;
  flashColor = 'rgba(255,0,0,0.4)';
  shake = 12;
}

function restartLevel() {
  resetPlayer(player);
  // Find the right trigger index for checkpoint position
  const checkpointTime = checkpoint * duration();
  const checkpointBeat = checkpoint * totalBeats();
  lastTriggerIdx = 0;
  if (level) {
    // Advance trigger index past checkpoint, applying color triggers
    for (let i = 0; i < level.triggers.length; i++) {
      if (level.triggers[i].beat <= checkpointBeat) {
        const t = level.triggers[i];
        if (t.type === 'color') { bg = [...t.bg]; gnd = [...t.ground]; targetBg = [...t.bg]; targetGnd = [...t.ground]; }
        lastTriggerIdx = i + 1;
      }
    }
  }
  flash = 0;
  shake = 0;
  attempts++;
  restartSong(checkpointTime);
}

// Main frame
function frame(now) {
  requestAnimationFrame(frame);

  const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 0.016;
  lastFrameTime = now;

  if (!started || !level) {
    render(ctx, buildState());
    return;
  }

  // Death freeze
  if (deathFreezeFrames > 0) {
    deathFreezeFrames--;
    if (deathFreezeFrames === 0) restartLevel();
    render(ctx, buildState());
    return;
  }

  // Song time drives everything
  const st = songTime();
  const currentBeat = beat();
  const pxPerBeat = level.meta.speed * UNIT;
  const scrollX = st * level.meta.speed * UNIT * getBpm() / 60;
  const songPct = Math.min(1, beat() / levelEndBeat);

  // Track checkpoint at every 5%
  const pctFloor = Math.floor(songPct * 20) / 20;
  if (pctFloor > checkpoint) {
    checkpoint = pctFloor;
    checkpointMsg = `${Math.round(checkpoint * 100)}%`;
    checkpointMsgTimer = 1.2;
    flash = 0.15;
    flashColor = null;
  }

  // Checkpoint message decay
  if (checkpointMsgTimer > 0) checkpointMsgTimer -= dt;

  // Level complete
  if (songPct >= 1 && !won) {
    won = true;
    stop();
    return;
  }
  if (won) return;

  // Physics
  updatePlayer(player, dt);

  // Collision
  const died = collide(player, worldObjects, scrollX) || checkFall(player);
  if (died) { die(); }

  // Triggers
  processTriggers(currentBeat);
  lerpColors(dt);

  // Decay
  if (flash > 0) flash -= dt * 4;
  if (shake > 0) shake *= 0.88;

  render(ctx, { ...buildState(), scrollX, songPct });
}

function buildState() {
  return {
    player,
    scrollX: started ? songTime() * (level?.meta.speed || 8) * UNIT * getBpm() / 60 : 0,
    level,
    objects: worldObjects,
    triggers: level?.triggers || [],
    flash: Math.max(0, flash),
    flashColor,
    shake: shake > 0.5 ? shake : 0,
    attempts,
    songPct: started ? Math.min(1, beat() / levelEndBeat) : 0,
    bg, gnd, checkpoint, won, checkpointMsg, checkpointMsgTimer,
  };
}

// Input — tap/click/space = jump
function onTap() {
  initAudio();
  if (!started) {
    started = true;
    play();
  }
  if (player.dead) return;
  jump(player);
}

canvas.addEventListener('click', onTap);
canvas.addEventListener('touchstart', e => { e.preventDefault(); onTap(); }, { passive: false });
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onTap(); }
});

// Init
(async () => {
  await loadLevel('levels/chapter-1.json');
  requestAnimationFrame(frame);
})();
