// Runner main — wires engine, renderer, input, audio, UI
// Reuses existing input.js and ui.js — no duplication
import { createState, update, switchLane, jump, setEventHandler, CANVAS_W, CANVAS_H } from './runner.js';
import { getLevelByIndex, levels } from './level.js';
import { renderRunner } from './runner_renderer.js';
import { eatSound, dieSound, beep, unlockAudio, startBgTrack, stopBgTrack, playEngine } from './audio.js';
import { addParticles } from './particles.js';
import { initInput } from './input.js';
import { setupLights, flickerLights, popEmoji, popText, showSTCharacter, showGameOver, setupSoundboard, setupSkinPicker, setupTheme, setupTrackPicker } from './ui.js';

const canvas = document.getElementById('c');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const scale = Math.min(1, (window.innerWidth - 20) / CANVAS_W);
  canvas.style.width = (CANVAS_W * scale) + 'px';
  canvas.style.height = (CANVAS_H * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let state = createState(getLevelByIndex(0));
let currentLevel = 0;
let lastTime = 0;
let paused = false;

// --- Sound events from engine ---
setEventHandler((type, data) => {
  switch (type) {
    case 'hit':
      beep(300, 0.2, 'sawtooth', 0.25);
      setTimeout(() => beep(200, 0.25, 'sawtooth', 0.2), 80);
      setTimeout(() => beep(100, 0.3, 'sawtooth', 0.15), 160);
      popEmoji(2);
      break;
    case 'death':
      dieSound(); stopBgTrack(); popEmoji(10);
      break;
    case 'collect':
      eatSound();
      if (data === 'heart') { beep(523, 0.1, 'sine', 0.12); setTimeout(() => beep(784, 0.15, 'sine', 0.12), 80); }
      addParticles(5, Math.floor(state.playerY / 20), 10, state.upsideDown);
      popEmoji(Math.min(state.combo, 4));
      if (state.combo >= 3) popText(state.upsideDown);
      if (state.score % 5 === 0) showSTCharacter();
      if (state.score % 10 === 0) playEngine();
      break;
    case 'shield':
      beep(300, 0.1, 'triangle', 0.12);
      break;
    case 'dodge':
      beep(500, 0.1, 'square', 0.1);
      break;
    case 'dimension_flip':
      if (data) { beep(80, 0.5, 'sawtooth'); setTimeout(() => beep(60, 0.5, 'sawtooth'), 200); popEmoji(4); popText(true); showSTCharacter(); }
      else { beep(523, 0.15); setTimeout(() => beep(659, 0.15), 100); }
      break;
  }
});

// --- Game loop ---
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) return;
  const dt = lastTime ? Math.min(now - lastTime, 50) : 16;
  lastTime = now;
  if (state.started && state.alive && !state.complete) {
    update(state, dt);
  }
  if (state.started) checkTriggers(state);
  renderRunner(ctx, state);
}

// --- State change triggers ---
let prevAlive = true, prevComplete = false;

function checkTriggers(s) {
  if (!s.alive && prevAlive) {
    const prev = parseInt(localStorage.getItem('runner-highscore') || '0');
    const isNew = s.score > prev;
    if (isNew) localStorage.setItem('runner-highscore', s.score);
    showGameOver(s.score, prev, isNew);
    // Restart from current level, not level 1
    window.restartGame = () => restartCurrentLevel();
  }
  if (s.complete && !prevComplete) {
    stopBgTrack();
    beep(523, 0.15); setTimeout(() => beep(659, 0.15), 100); setTimeout(() => beep(784, 0.3), 200);
    const stars = s.score >= 20 ? 3 : s.score >= 10 ? 2 : 1;
    const prev = parseInt(localStorage.getItem('runner-highscore') || '0');
    if (s.score > prev) localStorage.setItem('runner-highscore', s.score);
    const el = document.getElementById('gameover');
    el.style.display = 'block';
    const hasNext = currentLevel < levels.length - 1;
    document.getElementById('lesson').textContent = hasNext
      ? `aura: ${s.score} | ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`
      : `FINAL AURA: ${s.score} | ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}\n\nyou survived all of hawkins.\nthe upside down fears you now.`;
    document.getElementById('goTitle').textContent = hasNext
      ? '⭐'.repeat(stars) + ' LEVEL COMPLETE ' + '⭐'.repeat(stars)
      : '🏆 YOU BEAT SKIBIDI THINGS 🏆';
    document.getElementById('gameover').querySelector('span').textContent = hasNext ? '[ next chapter ]' : '[ run it back ]';
    window.restartGame = hasNext ? () => advanceLevel(s.score, s.lives) : () => fullRestart();
    for (let i = 0; i < 15; i++) setTimeout(() => popEmoji(3), i * 50);
  }
  prevAlive = s.alive;
  prevComplete = s.complete;
}

// --- Pause ---
function togglePause() {
  if (!state.started || !state.alive) return;
  paused = !paused;
  document.getElementById('pauseOverlay').style.display = paused ? 'flex' : 'none';
  if (paused) stopBgTrack(); else startBgTrack();
}
window.togglePause = togglePause;

// --- Input via shared input.js ---
function wireInput() {
  initInput({
    onDirection(d) {
      unlockAudio();
      if (d.y === -1) { switchLane(state, -1); beep(440, 0.04, 'sine', 0.08); }
      else if (d.y === 1) { switchLane(state, 1); beep(330, 0.04, 'sine', 0.08); }
      else if (d.x !== 0) jump(state);
    },
    onPause() { togglePause(); },
    onStart() {
      state.started = true;
      startBgTrack();
      document.getElementById('thought').textContent = 'locked in at hawkins 🔒🔴';
      beep(523, 0.1); beep(659, 0.1);
    },
  });
}
wireInput();

// --- Restart / Advance ---
function advanceLevel(carryScore, carryLives) {
  stopBgTrack();
  currentLevel++;
  state = createState(getLevelByIndex(currentLevel));
  state.score = carryScore;
  state.lives = carryLives;
  lastTime = 0; paused = false;
  prevAlive = true; prevComplete = false;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('thought').textContent = `chapter ${currentLevel + 1}... here we go 🔴`;
  canvas.style.filter = ''; canvas.style.transform = '';
  window.restartGame = fullRestart;
  wireInput();
}

function fullRestart() {
  stopBgTrack();
  currentLevel = 0;
  state = createState(getLevelByIndex(0));
  lastTime = 0; paused = false;
  prevAlive = true; prevComplete = false;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('thought').textContent = 'swipe up/down to switch lanes. tap to jump. 🔴';
  canvas.style.filter = ''; canvas.style.transform = '';
  wireInput();
}

function restartCurrentLevel() {
  stopBgTrack();
  state = createState(getLevelByIndex(currentLevel));
  lastTime = 0; paused = false;
  prevAlive = true; prevComplete = false;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('thought').textContent = `retry ${levels[currentLevel].name}... let's go 🔴`;
  canvas.style.filter = ''; canvas.style.transform = '';
  wireInput();
}

window.restartGame = restartCurrentLevel;

// --- Init (shared UI setup) ---
setupLights();
setupSoundboard();
setupSkinPicker();
setupTrackPicker();
setupTheme();
setInterval(() => flickerLights(state.upsideDown), 200);

const savedHigh = localStorage.getItem('runner-highscore');
document.getElementById('thought').textContent = savedHigh && parseInt(savedHigh) > 0
  ? `best aura: ${savedHigh} — swipe up/down, tap to jump 🔴`
  : 'swipe up/down to switch lanes. tap to jump. 🔴';

requestAnimationFrame(frame);
