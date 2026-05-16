// SFX — synthesized sound effects using Web Audio API
// Reuses beat-clock's AudioContext. All sounds are fire-and-forget.

import { getCtx } from './beat-clock.js';

let noiseBuffer = null;
let lastJump = 0, lastLand = 0;

function ctx() { return getCtx(); }

function ensureNoise() {
  if (noiseBuffer) return;
  const c = ctx(); if (!c) return;
  const len = c.sampleRate * 0.15;
  noiseBuffer = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function osc(type, freq, dur, gain, freqEnd) {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + dur + 0.01);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}

export function playJump() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  if (now - lastJump < 0.06) return;
  lastJump = now;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.value = 800;
  o.frequency.exponentialRampToValueAtTime(400, now + 0.06);
  g.gain.setValueAtTime(0.10, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(now + 0.07);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}

export function playDeath() {
  const c = ctx(); if (!c) return;
  ensureNoise();
  // Noise burst
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = noiseBuffer;
  g.gain.setValueAtTime(0.15, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  s.connect(g); g.connect(c.destination);
  s.start(); s.stop(c.currentTime + 0.15);
  s.onended = () => { s.disconnect(); g.disconnect(); };
  // Low thud
  osc('sine', 80, 0.2, 0.12, 40);
}

export function playLand() {
  const c = ctx(); if (!c) return;
  if (c.currentTime - lastLand < 0.08) return;
  lastLand = c.currentTime;
  osc('sine', 120, 0.04, 0.06, 60);
}

export function playOrb(color) {
  const freq = color === 'blue' ? 440 : color === 'pink' ? 1320 : 880;
  osc('sine', freq, 0.1, 0.10);
  osc('sine', freq * 2, 0.08, 0.05);
}

export function playPad(color) {
  const base = color === 'blue' ? 150 : color === 'pink' ? 300 : 200;
  osc('sine', base, 0.15, 0.13, base * 3);
}

export function playCheckpoint() {
  const c = ctx(); if (!c) return;
  osc('sine', 1047, 0.15, 0.12);
  setTimeout(() => osc('sine', 1568, 0.15, 0.12), 100);
}

export function playComplete() {
  const c = ctx(); if (!c) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => setTimeout(() => {
    osc('sine', f, 0.25, 0.18);
    osc('triangle', f, 0.25, 0.06);
  }, i * 200));
}

export function playPortal() { osc('sine', 1200, 0.2, 0.10, 200); }
export function playRestart() { osc('sine', 2000, 0.025, 0.04); }
