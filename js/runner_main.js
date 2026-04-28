// Runner main — wires engine, renderer, input, audio, UI
// Reuses existing input.js and ui.js — no duplication
import { createState, update, switchLane, jump, setEventHandler, CANVAS_W, CANVAS_H } from './runner.js';
import { getLevelByIndex, levels, LANE_COUNT } from './level.js';
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

// --- Runner skins ---
const runnerSkins = [
  { id: 'default', name: 'Normie', hue: 200, emoji: '🧒', unlock: 0 },
  { id: 'nosebleed', name: 'Nosebleed', hue: 330, emoji: '🩸', unlock: 1 },
  { id: 'walkie', name: 'Walkie Talkie', hue: 180, emoji: '📻', unlock: 2 },
  { id: 'kate', name: 'Running Up That Hill', hue: 15, emoji: '🎧', unlock: 3 },
  { id: 'eggo', name: 'Eggo Waffle', hue: 40, emoji: '🧇', unlock: 4 },
  { id: 'upsidedown', name: 'Upside Downer', hue: 280, emoji: '🌀', unlock: 5 },
  { id: 'skibidi', name: 'Skibidi Toilet', hue: 0, emoji: '🚽', unlock: 6 },
];

function getChaptersBeaten() { return parseInt(localStorage.getItem('runner-chapters-beaten') || '0'); }
function setChaptersBeaten(n) { const prev = getChaptersBeaten(); if (n > prev) localStorage.setItem('runner-chapters-beaten', n); }
function getRunnerSkin() { return localStorage.getItem('runner-skin') || 'mike'; }
function setRunnerSkin(id) { localStorage.setItem('runner-skin', id); }

function getActiveSkinHue() {
  const skin = runnerSkins.find(s => s.id === getRunnerSkin()) || runnerSkins[0];
  return skin.hue;
}

function setupRunnerSkinPicker() {
  const el = document.getElementById('skinpicker');
  if (!el) return;
  el.innerHTML = '';
  const beaten = getChaptersBeaten();
  const active = getRunnerSkin();
  runnerSkins.forEach(s => {
    const btn = document.createElement('div');
    btn.className = 'sb-btn' + (s.id === active ? ' skin-active' : '');
    const locked = s.unlock > beaten;
    btn.textContent = locked ? `🔒 ${s.name}` : `${s.emoji} ${s.name}`;
    btn.title = locked ? `Beat ${s.unlock} chapter${s.unlock > 1 ? 's' : ''} to unlock` : s.name;
    if (locked) { btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
    else { btn.addEventListener('click', () => { setRunnerSkin(s.id); setupRunnerSkinPicker(); }); }
    el.appendChild(btn);
  });
}

let state = createState(getLevelByIndex(0));
state.skinHue = getActiveSkinHue();
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
    case 'boss_start':
      beep(80, 0.8, 'sawtooth', 0.2); setTimeout(() => beep(60, 0.8, 'sawtooth', 0.2), 300);
      document.getElementById('thought').textContent = data === 'vecna' ? '🕷️ VECNA APPEARS 🕷️' : '🌸 DEMOGORGON APPEARS 🌸';
      popEmoji(8); popText(true);
      break;
    case 'boss_attack':
      beep(150, 0.1, 'sawtooth', 0.15);
      break;
    case 'boss_hit':
      beep(400, 0.1, 'square', 0.15); setTimeout(() => beep(500, 0.1, 'square', 0.12), 60);
      popEmoji(3);
      break;
    case 'boss_defeated':
      [523,659,784,1047].forEach((f,i) => setTimeout(() => beep(f, 0.2, 'square', 0.12), i * 100));
      document.getElementById('thought').textContent = data === 'vecna' ? '🕷️ VECNA DEFEATED 🕷️' : '🌸 DEMOGORGON DEFEATED 🌸';
      popEmoji(15); popText(false); showSTCharacter();
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
    if (s.isDaily) {
      const key = `daily-${getDaySeed()}`;
      const best = parseInt(localStorage.getItem(key) || '0');
      if (s.score > best) localStorage.setItem(key, s.score);
    }
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
    if (!hasNext) { setChaptersBeaten(levels.length); setupRunnerSkinPicker(); }
    for (let i = 0; i < 15; i++) setTimeout(() => popEmoji(3), i * 50);
    const cardTitle = hasNext ? 'LEVEL COMPLETE' : 'YOU BEAT SKIBIDI THINGS';
    showSaveButton(generateVictoryCard(s, cardTitle));
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
      state.mutators = new Set(activeMutators);
      if (state.mutators.has('speed2x')) { state.scrollSpeed *= 2; state.level = { ...state.level, maxSpeed: state.level.maxSpeed * 2 }; }
      if (state.mutators.has('lowgrav')) state.jumpDuration = 700;
      startBgTrack();
      document.getElementById('thought').textContent = 'locked in at hawkins 🔒🔴';
      document.getElementById('levelSelect').style.display = 'none';
      document.getElementById('pickers').style.display = 'none';
      document.getElementById('soundboard').style.display = 'none';
      beep(523, 0.1); beep(659, 0.1);
    },
  });
}
wireInput();

// --- Restart / Advance ---
function advanceLevel(carryScore, carryLives) {
  stopBgTrack();
  const btn = document.getElementById('saveCardBtn'); if (btn) btn.style.display = 'none';
  document.getElementById('pickers').style.display = '';
  document.getElementById('soundboard').style.display = '';
  currentLevel++;
  setChaptersBeaten(currentLevel);
  setupRunnerSkinPicker();
  state = createState(getLevelByIndex(currentLevel));
  state.score = carryScore;
  state.lives = carryLives;
  state.skinHue = getActiveSkinHue();
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
  const btn = document.getElementById('saveCardBtn'); if (btn) btn.style.display = 'none';
  document.getElementById('pickers').style.display = '';
  document.getElementById('soundboard').style.display = '';
  currentLevel = 0;
  state = createState(getLevelByIndex(0));
  state.skinHue = getActiveSkinHue();
  lastTime = 0; paused = false;
  prevAlive = true; prevComplete = false;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('thought').textContent = 'pick a chapter or swipe to start 🔴';
  canvas.style.filter = ''; canvas.style.transform = '';
  setupLevelSelect();
  wireInput();
}

function restartCurrentLevel() {
  stopBgTrack();
  const btn = document.getElementById('saveCardBtn'); if (btn) btn.style.display = 'none';
  document.getElementById('pickers').style.display = '';
  document.getElementById('soundboard').style.display = '';
  state = createState(getLevelByIndex(currentLevel));
  state.skinHue = getActiveSkinHue();
  lastTime = 0; paused = false;
  prevAlive = true; prevComplete = false;
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('thought').textContent = `retry ${levels[currentLevel].name}... let's go 🔴`;
  canvas.style.filter = ''; canvas.style.transform = '';
  wireInput();
}

window.restartGame = restartCurrentLevel;

// --- Mutators (unlock after beating all chapters) ---
const mutators = [
  { id: 'bighead', name: '🤯 Big Head', desc: 'Player is huge' },
  { id: 'lowgrav', name: '🌙 Low Gravity', desc: 'Floaty jumps' },
  { id: 'speed2x', name: '⚡ 2x Speed', desc: 'Everything faster' },
  { id: 'rainbow', name: '🌈 Rainbow Trail', desc: 'Leave a trail' },
];
let activeMutators = new Set();

function setupMutatorPicker() {
  let el = document.getElementById('mutatorPicker');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mutatorPicker';
    el.style.cssText = 'text-align:center;margin:6px 0';
    const pickers = document.getElementById('pickers');
    if (pickers) pickers.appendChild(el);
  }
  el.innerHTML = '';
  if (getChaptersBeaten() < levels.length) {
    el.innerHTML = '<div style="font-size:11px;color:#555">🔒 beat all 6 chapters to unlock mutators</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:12px;color:#888;margin-bottom:4px">mutators</div>';
  mutators.forEach(m => {
    const btn = document.createElement('div');
    btn.className = 'sb-btn' + (activeMutators.has(m.id) ? ' skin-active' : '');
    btn.textContent = m.name;
    btn.title = m.desc;
    btn.style.fontSize = '12px'; btn.style.padding = '4px 8px';
    btn.addEventListener('click', () => {
      if (activeMutators.has(m.id)) activeMutators.delete(m.id); else activeMutators.add(m.id);
      setupMutatorPicker();
    });
    el.appendChild(btn);
  });
}

// --- Victory Card ---
function generateVictoryCard(s, title) {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 340;
  const ctx = c.getContext('2d');
  const bg = s.level.bg || [10, 8, 20];
  // Background
  ctx.fillStyle = `rgb(${bg[0] + 10},${bg[1] + 5},${bg[2] + 15})`;
  ctx.fillRect(0, 0, 600, 340);
  // Border
  ctx.strokeStyle = '#c44'; ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 592, 332);
  // Title
  ctx.fillStyle = '#f4a'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.fillText(title, 300, 50);
  // Chapter
  ctx.fillStyle = '#888'; ctx.font = '16px monospace';
  ctx.fillText(s.level.name, 300, 80);
  // Score
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 40px monospace';
  ctx.fillText(`AURA: ${s.score}`, 300, 140);
  // Stars
  const stars = s.score >= 20 ? 3 : s.score >= 10 ? 2 : 1;
  ctx.font = '36px sans-serif';
  ctx.fillText('⭐'.repeat(stars) + '☆'.repeat(3 - stars), 300, 190);
  // Stats
  ctx.fillStyle = '#aaa'; ctx.font = '14px monospace';
  ctx.fillText(`lives remaining: ${'❤️'.repeat(s.lives)}`, 300, 230);
  const skin = runnerSkins.find(sk => sk.id === getRunnerSkin()) || runnerSkins[0];
  ctx.fillText(`character: ${skin.emoji} ${skin.name}`, 300, 255);
  // Branding
  ctx.fillStyle = '#666'; ctx.font = '12px monospace';
  ctx.fillText('skibidi things — the upside down has wifi now', 300, 310);
  ctx.fillText('jmg421.github.io/skibidi-things', 300, 328);
  return c;
}

function showSaveButton(cardCanvas) {
  let btn = document.getElementById('saveCardBtn');
  if (!btn) {
    btn = document.createElement('div');
    btn.id = 'saveCardBtn';
    btn.className = 'sb-btn';
    btn.style.cssText = 'position:fixed;bottom:50px;right:12px;z-index:200;font-size:14px';
    document.body.appendChild(btn);
  }
  btn.textContent = '📸 Save Victory Card';
  btn.style.display = 'block';
  btn.onclick = () => {
    const link = document.createElement('a');
    link.download = `skibidi-things-${Date.now()}.png`;
    link.href = cardCanvas.toDataURL('image/png');
    link.click();
    btn.textContent = '✅ Saved!';
    setTimeout(() => { btn.style.display = 'none'; }, 2000);
  };
}

// --- Daily Challenge ---
function getDaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function generateDailyLevel() {
  const seed = getDaySeed();
  const rand = seededRandom(seed);
  const events = [];
  let t = 3000;
  const duration = 55000;
  const obstacleTypes = ['demogorgon', 'vine', 'tentacle'];
  while (t < duration) {
    const lane = Math.floor(rand() * LANE_COUNT);
    events.push({ t, type: 'obstacle', lane, subtype: obstacleTypes[Math.floor(rand() * obstacleTypes.length)] });
    if (rand() < 0.15) {
      const lane2 = [0, 1, 2].filter(l => l !== lane)[Math.floor(rand() * 2)];
      events.push({ t: t + 150, type: 'obstacle', lane: lane2, subtype: obstacleTypes[Math.floor(rand() * obstacleTypes.length)] });
    }
    if (rand() < 0.65) {
      const cLane = Math.floor(rand() * LANE_COUNT);
      const r = rand();
      const csub = r < 0.08 ? 'heart' : r < 0.18 ? 'walkie' : r < 0.35 ? 'light' : 'eggo';
      events.push({ t: t + 400, type: 'collectible', lane: cLane, subtype: csub });
    }
    t += 1100 + rand() * 900;
  }
  return {
    name: `Daily Challenge #${getDaySeed() % 10000}`,
    speed: 2.8, speedRamp: 0.0006, maxSpeed: 5, duration: 55000,
    bg: [10 + (seed % 10), 5 + (seed % 8), 15 + (seed % 12)],
    events: events.sort((a, b) => a.t - b.t),
  };
}

function setupDailyButton() {
  const el = document.getElementById('dailyBtn');
  if (!el) return;
  const todayKey = `daily-${getDaySeed()}`;
  const bestToday = localStorage.getItem(todayKey);
  const btn = document.createElement('div');
  btn.className = 'sb-btn';
  btn.style.fontSize = '13px';
  btn.textContent = bestToday ? `🗓️ Daily Challenge (best: ${bestToday})` : '🗓️ Daily Challenge';
  btn.addEventListener('click', () => {
    const daily = generateDailyLevel();
    currentLevel = -1; // special marker
    state = createState(daily);
    state.skinHue = getActiveSkinHue();
    state.isDaily = true;
    prevAlive = true; prevComplete = false;
    document.getElementById('levelSelect').style.display = 'none';
    document.getElementById('gameover').style.display = 'none';
    document.getElementById('thought').textContent = `${daily.name}... same for everyone today 🗓️`;
    wireInput();
  });
  el.innerHTML = '';
  el.appendChild(btn);
}

// --- Level Select ---
function setupLevelSelect() {
  const container = document.getElementById('levelBtns');
  const selectDiv = document.getElementById('levelSelect');
  if (!container || !selectDiv) return;
  container.innerHTML = '';
  const beaten = getChaptersBeaten();
  levels.forEach((lvl, i) => {
    const unlocked = i === 0 || i <= beaten;
    const btn = document.createElement('div');
    btn.className = 'sb-btn';
    btn.textContent = unlocked ? `${i + 1}. ${lvl.name.split(': ')[1] || lvl.name}` : `🔒 Ch.${i + 1}`;
    btn.style.fontSize = '12px';
    btn.style.padding = '6px 10px';
    if (!unlocked) { btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
    else {
      btn.addEventListener('click', () => {
        currentLevel = i;
        state = createState(getLevelByIndex(i));
        state.skinHue = getActiveSkinHue();
        prevAlive = true; prevComplete = false;
        selectDiv.style.display = 'none';
        document.getElementById('gameover').style.display = 'none';
        document.getElementById('thought').textContent = `${lvl.name}... swipe to start 🔴`;
        wireInput();
      });
    }
    container.appendChild(btn);
  });
  selectDiv.style.display = 'block';
  setupDailyButton();
}

// --- Init (shared UI setup) ---
setupLights();
setupSoundboard();
setupRunnerSkinPicker();
setupMutatorPicker();
setupTrackPicker();
setupTheme();
setupLevelSelect();
setInterval(() => flickerLights(state.upsideDown), 200);

const savedHigh = localStorage.getItem('runner-highscore');
document.getElementById('thought').textContent = savedHigh && parseInt(savedHigh) > 0
  ? `best aura: ${savedHigh} — pick a chapter or swipe to start 🔴`
  : 'swipe up/down to switch lanes. tap to jump. 🔴';

// --- Easter Eggs ---
const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;
document.addEventListener('keydown', e => {
  if (e.key === konamiCode[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === konamiCode.length) {
      konamiIdx = 0;
      setChaptersBeaten(levels.length);
      setupRunnerSkinPicker();
      setupMutatorPicker();
      setupLevelSelect();
      document.getElementById('thought').textContent = '🚽 SKIBIDI CHEAT ACTIVATED — all chapters unlocked 🚽';
      beep(523, 0.1); beep(659, 0.1); setTimeout(() => beep(784, 0.1), 100);
      popEmoji(15); popText(false);
    }
  } else { konamiIdx = 0; }
});

// Type "011" during gameplay to skip level
let secretBuf = '';
document.addEventListener('keydown', e => {
  if (e.key.length === 1) secretBuf = (secretBuf + e.key).slice(-3);
  if (secretBuf === '011' && state.started && state.alive && !state.complete) {
    state.complete = true;
    secretBuf = '';
    document.getElementById('thought').textContent = '👧 eleven says: friends don\'t lie. but they do skip levels.';
  }
});

requestAnimationFrame(frame);
