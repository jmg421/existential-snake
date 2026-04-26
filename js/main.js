// Main — game loop, state, wiring
import { G, SPEED_INITIAL, SPEED_MIN, SPEED_DECREMENT } from './config.js';
import { eatSound, dieSound, beep, unlockAudio, startBgTrack, stopBgTrack } from './audio.js';
import { addParticles } from './particles.js';
import { initInput } from './input.js';
import { render } from './renderer.js';
import { setupLights, flickerLights, popEmoji, popText, showSTCharacter, updateScore, updateCombo, think, showGameOver, setupSoundboard } from './ui.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const maxW = 600, maxH = 400;
  const scale = Math.min(1, (window.innerWidth - 20) / maxW);
  canvas.style.width = (maxW * scale) + 'px';
  canvas.style.height = (maxH * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const W = canvas.width / G, H = canvas.height / G;

const state = {
  snake: [{x: 15, y: 10}],
  dir: {x: 0, y: 0},
  food: null,
  score: 0,
  alive: true,
  started: false,
  hue: 0,
  screenShake: 0,
  combo: 0,
  comboTimer: 0,
  speedMs: SPEED_INITIAL,
  upsideDown: false,
  demogorgonFood: false,
  canvas, W, H
};

let tick;

function spawn() {
  do {
    state.food = {x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H)};
  } while (state.snake.some(s => s.x === state.food.x && s.y === state.food.y));
  state.demogorgonFood = Math.random() < .3 && state.score > 3;
}

function flipDimension() {
  state.upsideDown = !state.upsideDown;
  state.screenShake = 15;
  if (state.upsideDown) {
    beep(80, .5, 'sawtooth'); setTimeout(() => beep(60, .5, 'sawtooth'), 200);
    canvas.style.filter = 'saturate(0.5) brightness(0.7)';
    document.getElementById('dimension').textContent = '⬡ THE UPSIDE DOWN ⬡';
    document.getElementById('dimension').style.color = '#f44';
    document.getElementById('vecna').style.opacity = '0.06';
    document.body.style.background = '#0a0000';
    popEmoji(4); popText(true); showSTCharacter();
  } else {
    beep(523, .15); setTimeout(() => beep(659, .15), 100);
    canvas.style.filter = '';
    document.getElementById('dimension').textContent = 'THE RIGHT-SIDE UP';
    document.getElementById('dimension').style.color = '#c44';
    document.getElementById('vecna').style.opacity = '0';
    document.body.style.background = '#0a0a0a';
    showSTCharacter();
  }
  updateScore(state.score, state.upsideDown);
}

function die() {
  state.alive = false;
  clearInterval(tick);
  stopBgTrack();
  dieSound();
  // High score
  const prev = parseInt(localStorage.getItem('skibidi-highscore') || '0');
  const isNew = state.score > prev;
  if (isNew) localStorage.setItem('skibidi-highscore', state.score);
  showGameOver(state.score, prev, isNew);
  canvas.style.filter = 'hue-rotate(180deg) saturate(3) brightness(0.5)';
}

function step() {
  const head = {x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y};
  if (head.x < 0 || head.x >= W || head.y < 0 || head.y >= H || state.snake.some(s => s.x === head.x && s.y === head.y)) return die();
  state.snake.unshift(head);

  if (head.x === state.food.x && head.y === state.food.y) {
    state.score++;
    eatSound();
    state.combo++; state.comboTimer = 3;
    updateCombo(state.combo, state.upsideDown, state.hue);
    updateScore(state.score, state.upsideDown);
    spawn(); think(state.score);
    state.screenShake = 8 + state.combo * 2;
    popEmoji(Math.min(state.combo, 6));
    if (state.combo >= 3) popText(state.upsideDown);
    addParticles(head.x, head.y, 15 + state.combo * 5, state.upsideDown);
    if (state.demogorgonFood) { popEmoji(5); popText(state.upsideDown); state.screenShake = 20; addParticles(head.x, head.y, 40, state.upsideDown); showSTCharacter(); }
    if (state.score % 5 === 0) showSTCharacter();
    if (state.score % 7 === 0) flipDimension();
    if (state.score % 3 === 0) {
      state.speedMs = Math.max(SPEED_MIN, state.speedMs - SPEED_DECREMENT);
      clearInterval(tick); tick = setInterval(loop, state.speedMs);
    }
  } else {
    state.snake.pop();
    state.comboTimer -= .12;
    if (state.comboTimer <= 0) { state.combo = 0; document.getElementById('combo').className = ''; }
  }
}

function loop() {
  if (state.alive) { step(); state.hue = (state.hue + .7) % 360; if (state.screenShake > 0) state.screenShake *= .85; render(ctx, state); }
}

function renderFrame() {
  if (state.alive && state.started) { state.hue = (state.hue + .7) % 360; render(ctx, state); }
  requestAnimationFrame(renderFrame);
}

// Init
spawn();
setupLights();
setupSoundboard();
const savedHigh = localStorage.getItem('skibidi-highscore');
if (savedHigh && parseInt(savedHigh) > 0) {
  document.getElementById('thought').textContent = `best aura: ${savedHigh} — can you beat it? 🔴`;
}
setInterval(() => flickerLights(state.upsideDown), 200);
setInterval(() => {
  if (!state.alive || !state.started) return;
  if (state.upsideDown && Math.random() < .15) {
    canvas.style.filter = 'saturate(0.3) brightness(0.4)';
    setTimeout(() => { if (state.upsideDown) canvas.style.filter = 'saturate(0.5) brightness(0.7)'; }, 80);
  }
}, 300);

initInput({
  onDirection(d) {
    unlockAudio();
    if (d.x + state.dir.x === 0 && d.y + state.dir.y === 0) return;
    state.dir = d;
  },
  onStart() {
    state.started = true;
    tick = setInterval(loop, state.speedMs);
    document.getElementById('thought').textContent = 'locked in at hawkins 🔒🔴';
    beep(523, .1); beep(659, .1); showSTCharacter();
    startBgTrack();
  }
});

requestAnimationFrame(renderFrame);

// Restart without reloading — keeps AudioContext alive
window.restartGame = function() {
  clearInterval(tick);
  stopBgTrack();
  state.snake = [{x: 15, y: 10}];
  state.dir = {x: 0, y: 0};
  state.score = 0;
  state.alive = true;
  state.started = false;
  state.hue = 0;
  state.screenShake = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.speedMs = SPEED_INITIAL;
  state.upsideDown = false;
  state.demogorgonFood = false;
  spawn();
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('vecna').style.opacity = '0';
  document.getElementById('dimension').textContent = 'THE RIGHT-SIDE UP';
  document.getElementById('dimension').style.color = '#c44';
  document.getElementById('thought').textContent = 'swipe or arrow key to enter hawkins 🔴';
  document.getElementById('score').textContent = 'aura: 0 | dimension: right-side up';
  document.getElementById('combo').className = '';
  canvas.style.filter = '';
  canvas.style.transform = '';
  document.body.style.background = '#0a0000';
  initInput({
    onDirection(d) {
      unlockAudio();
      if (d.x + state.dir.x === 0 && d.y + state.dir.y === 0) return;
      state.dir = d;
    },
    onStart() {
      state.started = true;
      tick = setInterval(loop, state.speedMs);
      document.getElementById('thought').textContent = 'locked in at hawkins 🔒🔴';
      beep(523, .1); beep(659, .1); showSTCharacter();
      startBgTrack();
    }
  });
};
