// Web Audio API sound engine — Geometry Dash energy
let audioCtx;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

let audioUnlocked = false;

export function unlockAudio() {
  getCtx();
  if (audioUnlocked) return;
  audioUnlocked = true;
  // Warm up HTML Audio elements for mobile — must happen in user gesture
  trackPool.forEach(a => { a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {}); });
  engineAudio.play().then(() => { engineAudio.pause(); engineAudio.currentTime = 0; }).catch(() => {});
}

export function beep(freq, dur, type = 'square', vol = 0.1) {
  const ctx = getCtx();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}

// Real engine sample
const engineAudio = new Audio('audio/engine.mp3');
engineAudio.volume = 0.5;

export function playEngine() {
  engineAudio.currentTime = 0;
  engineAudio.play().catch(() => {});
}

export const sbSounds = [
  {emoji:'👹',label:'Growl',fn:()=>{[80,60,40,30].forEach((f,i)=>setTimeout(()=>{beep(f,.3,'sawtooth',.12);beep(f*1.5,.2,'square',.08)},i*60))}},
  {emoji:'🗿',label:'Bruh',fn:()=>{beep(120,.4,'sawtooth',.15);setTimeout(()=>beep(80,.5,'sawtooth',.12),150)}},
  {emoji:'💥',label:'Oof',fn:()=>{beep(400,.05,undefined,.12);beep(200,.15,undefined,.12);setTimeout(()=>beep(100,.2,'sawtooth',.1),50)}},
  {emoji:'🎺',label:'Wah Wah',fn:()=>{[300,250,200,120].forEach((f,i)=>setTimeout(()=>beep(f,.25,'triangle',.12),i*200))}},
  {emoji:'🚀',label:'Yeet',fn:()=>{for(let i=0;i<8;i++)setTimeout(()=>beep(200+i*100,.06,undefined,.1),i*30)}},
  {emoji:'⚡',label:'Synth',fn:()=>{beep(65,.6,'sawtooth',.12);beep(82,.6,'sawtooth',.12);beep(98,.4,'square',.08);setTimeout(()=>{beep(130,.4,'sawtooth',.1);beep(164,.3,'square',.08)},300)}},
  {emoji:'👻',label:'Spooky',fn:()=>{let f=800;const iv=setInterval(()=>{beep(f,.08,'sine',.1);f-=40;if(f<100)clearInterval(iv)},40)}},
  {emoji:'🎮',label:'Skill Issue',fn:()=>{[523,466,415,349,311].forEach((f,i)=>setTimeout(()=>beep(f,.15,'square',.1),i*120))}},
  {emoji:'🤡',label:'Honk',fn:()=>{beep(300,.15,'square',.12);setTimeout(()=>beep(250,.2,'square',.12),100);setTimeout(()=>beep(350,.15,'square',.12),250)}},
  {emoji:'🔴',label:'Upside Down',fn:()=>{for(let i=0;i<12;i++)setTimeout(()=>{beep(40+Math.random()*60,.15,'sawtooth',.1);beep(100+Math.random()*100,.1,'square',.08)},i*80)}},
  {emoji:'🏎️',label:'V8 Rev',fn:()=>playEngine()},
  {emoji:'💨',label:'Burnout',fn:()=>{playEngine();setTimeout(()=>{let f=500;const iv=setInterval(()=>{beep(f+Math.random()*30,.04,'sawtooth',.08);f-=5;if(f<100)clearInterval(iv)},20)},200)}},
];

export function eatSound() {
  // Mario coin — two variants
  beep(988, .08, 'square', .12);
  if (Math.random() < 0.5) {
    setTimeout(() => beep(1319, .6, 'square', .1), 80); // B5→E6
  } else {
    setTimeout(() => beep(1976, .6, 'square', .1), 80); // B5→B6
  }
}
export function dieSound() { [200,150,100,60].forEach((f,i) => setTimeout(() => beep(f,.4,'sawtooth',.15), i*120)); }

// Background tracks — real MP3s (ForeverBound)
let bgAudio = null;
let currentTrack = parseInt(localStorage.getItem('skibidi-track') || '0');
const trackFiles = [
  { name: '🎵 Stereo Madness 2', src: 'audio/stereo-madness-2.mp3' },
  { name: '🎵 Stereo Madness', src: 'audio/stereo-madness.mp3' },
  { name: '🎵 Cosmic Harmony', src: 'audio/cosmic-harmony.mp3' },
  { name: '🎵 The Other Side', src: 'audio/the-other-side.mp3' },
];

const trackPool = trackFiles.map(t => {
  const a = new Audio(t.src);
  a.loop = true;
  a.volume = 0.4;
  return a;
});

export function getTrackNames() { return trackFiles.map((t, i) => ({ name: t.name, idx: i })); }
export function getCurrentTrack() { return currentTrack; }

export function startBgTrack(trackIdx) {
  stopBgTrack();
  if (trackIdx !== undefined) { currentTrack = trackIdx; localStorage.setItem('skibidi-track', trackIdx); }
  bgAudio = trackPool[currentTrack % trackPool.length];
  bgAudio.currentTime = 0;
  bgAudio.play().catch(() => {});
}

export function stopBgTrack() {
  if (bgAudio) { bgAudio.pause(); bgAudio.currentTime = 0; bgAudio = null; }
}

export function nextTrack() {
  currentTrack = (currentTrack + 1) % trackPool.length;
  localStorage.setItem('skibidi-track', currentTrack);
  startBgTrack(currentTrack);
}
