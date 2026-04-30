// Beat clock — AudioContext-based timing for rhythm game
// Song time is the single source of truth. Never use frame deltas for game state.

let ctx = null;
let source = null;
let buffer = null;
let startTime = 0;
let playing = false;
let bpm = 140;
let offset = 0; // seconds offset for sync tuning

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export async function loadSong(url) {
  initAudio();
  const resp = await fetch(url);
  const data = await resp.arrayBuffer();
  buffer = await ctx.decodeAudioData(data);
  return buffer.duration;
}

export function play() {
  if (!buffer || !ctx) return;
  stop();
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  startTime = ctx.currentTime - offset;
  playing = true;
}

export function stop() {
  if (source) { try { source.stop(); } catch(e) {} source = null; }
  playing = false;
}

export function restart() {
  stop();
  play();
}

export function setSyncParams(b, o) {
  bpm = b;
  offset = o || 0;
}

// Current song time in seconds (0 = song start)
export function songTime() {
  if (!playing || !ctx) return 0;
  return ctx.currentTime - startTime;
}

// Current beat number (float)
export function beat() {
  return songTime() * bpm / 60;
}

// Song duration in beats
export function totalBeats() {
  if (!buffer) return 0;
  return buffer.duration * bpm / 60;
}

// Song duration in seconds
export function duration() {
  return buffer ? buffer.duration : 0;
}

export function isPlaying() { return playing; }
export function getBpm() { return bpm; }
export function getCtx() { return ctx; }
