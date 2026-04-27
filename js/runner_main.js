// Runner main — wires engine, renderer, input, audio, UI
import { createState, update, switchLane, jump, CANVAS_W, CANVAS_H } from './runner.js';
import { getLevelByIndex } from './level.js';
import { renderRunner } from './runner_renderer.js';
import { eatSound, dieSound, beep, unlockAudio, startBgTrack, stopBgTrack, nextTrack, playEngine } from './audio.js';
import { addParticles } from './particles.js';
import { setupLights, flickerLights, popEmoji, popText, showSTCharacter, setupSoundboard, setupSkinPicker, setupTheme, setupTrackPicker } from './ui.js';

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
let lastTime = 0;
let paused = false;

// --- Game loop ---
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) return;
  const dt = lastTime ? Math.min(now - lastTime, 50) : 16; // cap dt at 50ms
  lastTime = now;

  if (state.started && state.alive && !state.complete) {
    update(state, dt);

    // Audio triggers on state changes
    checkTriggers(state, dt);
  }

  renderRunner(ctx, state);
}

// --- State change triggers ---
let prevAlive = true, prevComplete = false, prevUpsideDown = false, prevScore = 0, prevLives = 3;

function checkTriggers(s) {
  if (!s.alive && prevAlive) {
    dieSound();
    stopBgTrack();
    popEmoji(10);
    showGameOverUI(s);
    canvas.style.filter = 'hue-rotate(180deg) saturate(3) brightness(0.5)';
  }
  if (s.lives < prevLives && s.alive) {
    beep(200, 0.15, 'sawtooth', 0.15); setTimeout(() => beep(150, 0.2, 'sawtooth', 0.12), 100);
    popEmoji(2);
  }
  if (s.complete && !prevComplete) {
    stopBgTrack();
    beep(523, 0.15); setTimeout(() => beep(659, 0.15), 100); setTimeout(() => beep(784, 0.3), 200);
    showLevelCompleteUI(s);
  }
  if (s.upsideDown !== prevUpsideDown) {
    if (s.upsideDown) {
      beep(80, 0.5, 'sawtooth'); setTimeout(() => beep(60, 0.5, 'sawtooth'), 200);
      canvas.style.filter = 'saturate(0.5) brightness(0.7)';
      popEmoji(4); popText(true); showSTCharacter();
    } else {
      beep(523, 0.15); setTimeout(() => beep(659, 0.15), 100);
      canvas.style.filter = '';
    }
  }
  if (s.score > prevScore) {
    eatSound();
    const head = { x: 100 / 20, y: s.playerY / 20 }; // approximate grid coords for particles
    addParticles(head.x, head.y, 10 + s.combo * 3, s.upsideDown);
    popEmoji(Math.min(s.combo, 4));
    if (s.combo >= 3) popText(s.upsideDown);
    if (s.score % 5 === 0) showSTCharacter();
    if (s.score % 10 === 0) playEngine();
  }
  prevAlive = s.alive;
  prevComplete = s.complete;
  prevUpsideDown = s.upsideDown;
  prevScore = s.score;
  prevLives = s.lives;
}

// --- UI overlays ---
function showGameOverUI(s) {
  const el = document.getElementById('gameover');
  el.style.display = 'block';
  const prev = parseInt(localStorage.getItem('runner-highscore') || '0');
  const isNew = s.score > prev;
  if (isNew) localStorage.setItem('runner-highscore', s.score);
  document.getElementById('goTitle').textContent = isNew ? '🏆 NEW HIGH SCORE 🏆' : '💀 VECNA GOT YOU 💀';
  document.getElementById('lesson').textContent = `aura: ${s.score}${isNew ? ` (NEW! prev: ${prev})` : ` | best: ${prev}`}`;
  for (let i = 0; i < 10; i++) setTimeout(() => popEmoji(2), i * 70);
}

function showLevelCompleteUI(s) {
  const el = document.getElementById('gameover');
  el.style.display = 'block';
  const stars = s.score >= 30 ? 3 : s.score >= 15 ? 2 : 1;
  const prev = parseInt(localStorage.getItem('runner-highscore') || '0');
  if (s.score > prev) localStorage.setItem('runner-highscore', s.score);
  document.getElementById('goTitle').textContent = '⭐'.repeat(stars) + ' LEVEL COMPLETE ' + '⭐'.repeat(stars);
  document.getElementById('lesson').textContent = `aura: ${s.score} | ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  for (let i = 0; i < 15; i++) setTimeout(() => popEmoji(3), i * 50);
  for (let i = 0; i < 5; i++) setTimeout(() => popText(false), i * 150);
}

// --- Input ---
function handleInput(action) {
  unlockAudio();
  if (!state.started) {
    state.started = true;
    startBgTrack();
    document.getElementById('thought').textContent = 'locked in at hawkins 🔒🔴';
    beep(523, 0.1); beep(659, 0.1);
    return;
  }
  if (!state.alive || state.complete) return;
  if (action === 'up') switchLane(state, -1);
  else if (action === 'down') switchLane(state, 1);
  else if (action === 'jump') jump(state);
}

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p') { togglePause(); return; }
  const map = { ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', ' ': 'jump', ArrowLeft: 'jump', ArrowRight: 'jump' };
  if (map[e.key]) { e.preventDefault(); handleInput(map[e.key]); }
});

// Touch/swipe
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', e => {
  if (e.target.closest('.sb-btn,#shareBtn,#themeToggle')) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (e.target.closest('.sb-btn,#shareBtn,#themeToggle')) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { handleInput('jump'); return; } // tap = jump
  if (Math.abs(dy) > Math.abs(dx)) handleInput(dy < 0 ? 'up' : 'down');
  else handleInput('jump'); // horizontal swipe = jump
}, { passive: true });

// D-pad
document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
  const map = { up: 'up', down: 'down', left: 'jump', right: 'jump' };
  const handler = e => { e.preventDefault(); handleInput(map[btn.dataset.dir] || 'jump'); };
  btn.addEventListener('touchstart', handler, { passive: false });
  btn.addEventListener('mousedown', handler);
});

// Pause
function togglePause() {
  if (!state.started || !state.alive) return;
  paused = !paused;
  document.getElementById('pauseOverlay').style.display = paused ? 'flex' : 'none';
  if (paused) stopBgTrack(); else startBgTrack();
}
window.togglePause = togglePause;
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('pauseBtn-top')?.addEventListener('click', togglePause);

// Restart
window.restartGame = function() {
  stopBgTrack();
  state = createState(getLevelByIndex(0));
  lastTime = 0;
  paused = false;
  prevAlive = true; prevComplete = false; prevUpsideDown = false; prevScore = 0; prevLives = 3;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('thought').textContent = 'swipe up/down to switch lanes. tap to jump. 🔴';
  canvas.style.filter = '';
  canvas.style.transform = '';
};

// --- Init ---
setupLights();
setupSoundboard();
setupSkinPicker();
setupTrackPicker();
setupTheme();
setInterval(() => flickerLights(state.upsideDown), 200);

const savedHigh = localStorage.getItem('runner-highscore');
if (savedHigh && parseInt(savedHigh) > 0) {
  document.getElementById('thought').textContent = `best aura: ${savedHigh} — swipe up/down, tap to jump 🔴`;
} else {
  document.getElementById('thought').textContent = 'swipe up/down to switch lanes. tap to jump. 🔴';
}

requestAnimationFrame(frame);
