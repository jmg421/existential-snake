// UI — DOM manipulation, popups, lights, soundboard buttons
import { emojis, floatTexts, stAsciiChars, goTitles, lessons, thoughts, skins, getUnlockedSkins, getActiveSkin, setActiveSkin } from './config.js';
import { sbSounds } from './audio.js';

// Christmas lights
let lightEls = [];
let lightPattern = 0;

export function setupLights() {
  const container = document.getElementById('lights');
  const colors = ['#f00','#0f0','#ff0','#00f','#f0f','#0ff','#f80'];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div'); el.className = 'xmasLight';
    el.style.left = Math.random() * 95 + '%'; el.style.top = Math.random() * 95 + '%';
    el.style.background = colors[i % colors.length];
    el.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
    container.appendChild(el); lightEls.push(el);
  }
}

export function flickerLights(upsideDown) {
  lightPattern++;
  lightEls.forEach((el, i) => {
    const on = Math.sin(lightPattern * .3 + i * 1.7) > 0.2 || (upsideDown && Math.random() > .5);
    el.style.opacity = on ? (upsideDown ? .4 : .2) : '0';
  });
}

export function popEmoji(n = 1) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div'); el.className = 'pop';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 80 + 5 + '%'; el.style.top = Math.random() * 60 + 10 + '%';
    el.style.fontSize = (50 + Math.random() * 60) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1200);
  }
}

export function popText(upsideDown) {
  const el = document.createElement('div'); el.className = 'floatText';
  el.textContent = floatTexts[Math.floor(Math.random() * floatTexts.length)];
  const h = upsideDown ? 0 : Math.random() * 360;
  el.style.color = `hsl(${h},100%,70%)`; el.style.textShadow = `0 0 20px hsl(${h},100%,50%)`;
  el.style.left = Math.random() * 70 + 10 + '%'; el.style.top = Math.random() * 50 + 20 + '%';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1500);
}

export function showSTCharacter() {
  const ch = stAsciiChars[Math.floor(Math.random() * stAsciiChars.length)];
  const el = document.createElement('div'); el.className = 'stChar';
  el.innerHTML = `<div style="text-align:center"><div style="font-size:100px">${ch.art}</div><div style="font-family:Creepster,cursive;font-size:20px;color:${ch.color};text-shadow:0 0 15px ${ch.color};margin-top:5px">${ch.name}</div></div>`;
  el.style.left = Math.random() * 60 + 15 + '%'; el.style.top = Math.random() * 40 + 15 + '%';
  document.body.appendChild(el); setTimeout(() => el.remove(), 3000);
}

export function updateScore(score, upsideDown) {
  const fires = '🔥'.repeat(Math.min(Math.floor(score / 5), 5));
  document.getElementById('score').textContent = 'aura: ' + score + ' ' + fires + (score > 20 ? ' 👑' : '') + (score > 30 ? ' VECNA FEARS ME' : '') + ' | dimension: ' + (upsideDown ? 'upside down 🕷️' : 'right-side up 🔴');
}

export function updateCombo(combo, upsideDown, hue) {
  const el = document.getElementById('combo');
  el.textContent = (combo > 1 ? combo + 'x COMBO ' : '') + (combo >= 3 ? '🔥' : '') + (combo >= 5 ? '🔥🔥' : '') + (combo >= 8 ? '💀💀💀' : '') + (combo >= 10 ? '🕷️VECNA MODE' : '');
  el.className = combo > 1 ? 'show' : '';
  el.style.color = upsideDown ? '#f44' : `hsl(${(hue + combo * 30) % 360},100%,70%)`;
}

export function think(score) {
  const tier = Math.min(Math.floor(score), thoughts.length - 1);
  const pool = thoughts[tier];
  document.getElementById('thought').textContent = pool[Math.floor(Math.random() * pool.length)];
}

export function showGameOver(score, prevHigh, isNewHigh) {
  document.getElementById('gameover').style.display = 'block';
  document.getElementById('goTitle').textContent = isNewHigh ? '🏆 NEW HIGH SCORE 🏆' : goTitles[Math.floor(Math.random() * goTitles.length)];
  const lesson = lessons[Math.floor(Math.random() * lessons.length)].replace(/SCORE/g, score);
  const highLine = isNewHigh ? `\n\n🔥 ${score} AURA 🔥\nprevious best: ${prevHigh}` : `\naura: ${score} | best: ${prevHigh}`;
  document.getElementById('lesson').textContent = lesson + highLine;
  for (let i = 0; i < 20; i++) setTimeout(() => popEmoji(2), i * 70);
  for (let i = 0; i < 8; i++) setTimeout(() => popText(false), i * 150);
  for (let i = 0; i < 4; i++) setTimeout(() => showSTCharacter(), i * 400);
  document.getElementById('vecna').style.opacity = '0.15';
  let f = 0;
  const ff = setInterval(() => { lightEls.forEach(el => { el.style.opacity = Math.random() > .3 ? '0.6' : '0'; }); if (++f > 30) clearInterval(ff); }, 80);
  if (isNewHigh) { for (let i = 0; i < 30; i++) setTimeout(() => popEmoji(3), i * 50); }
}

export function setupSoundboard() {
  const sbEl = document.getElementById('soundboard');
  sbSounds.forEach(s => {
    const btn = document.createElement('div');
    btn.className = 'sb-btn';
    btn.textContent = s.emoji + ' ' + s.label;
    btn.addEventListener('click', e => { e.preventDefault(); s.fn(); popEmoji(1); });
    btn.addEventListener('touchstart', e => { e.preventDefault(); s.fn(); popEmoji(1); }, { passive: false });
    sbEl.appendChild(btn);
  });
}

export function setupSkinPicker() {
  const el = document.getElementById('skinpicker');
  if (!el) return;
  const unlocked = getUnlockedSkins();
  const active = getActiveSkin();
  el.innerHTML = '';
  skins.forEach(s => {
    const btn = document.createElement('div');
    btn.className = 'sb-btn' + (s.id === active.id ? ' skin-active' : '');
    const isLocked = !unlocked.find(u => u.id === s.id);
    btn.textContent = isLocked ? `🔒 ${s.name}` : `${s.head || '🐍'} ${s.name}`;
    btn.title = s.desc;
    if (isLocked) {
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.addEventListener('click', () => { setActiveSkin(s.id); setupSkinPicker(); });
    }
    el.appendChild(btn);
  });
}
