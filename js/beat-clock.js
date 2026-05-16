// Beat clock — AudioContext-based timing for rhythm game
// Song time is the single source of truth. Never use frame deltas for game state.

let ctx = null;
let source = null;
let buffer = null;
let pendingArrayBuffer = null;
let startTime = 0;
let playing = false;
let bpm = 140;
let offset = 0;

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export async function loadSong(url) {
  // Fetch raw bytes but DON'T create AudioContext yet (no user gesture)
  const resp = await fetch(url);
  pendingArrayBuffer = await resp.arrayBuffer();
}

async function ensureDecoded() {
  if (buffer) return;
  if (!pendingArrayBuffer) return;
  initAudio();
  buffer = await ctx.decodeAudioData(pendingArrayBuffer);
  pendingArrayBuffer = null;
}

export async function play(fromSeconds) {
  await ensureDecoded();
  if (!buffer || !ctx) return;
  stop();
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const from = fromSeconds || 0;
  source.start(0, from);
  startTime = ctx.currentTime - from - offset;
  playing = true;
}

export function stop() {
  if (source) { try { source.stop(); } catch(e) {} source = null; }
  playing = false;
}

export function restart(fromSeconds) {
  if (!buffer || !ctx) return;
  stop();
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const from = fromSeconds || 0;
  source.start(0, from);
  startTime = ctx.currentTime - from - offset;
  playing = true;
}

export function setSyncParams(b, o) { bpm = b; offset = o || 0; }

export function songTime() {
  if (!playing || !ctx) return 0;
  return ctx.currentTime - startTime;
}

export function beat() { return songTime() * bpm / 60; }

export function totalBeats() {
  if (!buffer) return 400; // fallback estimate
  return buffer.duration * bpm / 60;
}

export function duration() { return buffer ? buffer.duration : 170; } // fallback ~2.8min

export function isPlaying() { return playing; }
export function getBpm() { return bpm; }
export function getCtx() { return ctx; }
