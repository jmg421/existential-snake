// Web Audio API sound engine — Geometry Dash energy
let audioCtx;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function unlockAudio() { getCtx(); }

export function beep(freq, dur, type = 'square', vol = 0.1) {
  const ctx = getCtx();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  o.onended = () => { o.disconnect(); g.disconnect(); };
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
  {emoji:'🏎️',label:'V8 Rev',fn:()=>{let f=60;const rev=setInterval(()=>{beep(f,.06,'sawtooth',.12);beep(f*1.01,.06,'sawtooth',.12);beep(f*2,.03,'square',.06);f+=8;if(f>300){clearInterval(rev);for(let i=0;i<6;i++)setTimeout(()=>{beep(300-i*20,.08,'sawtooth',.1);beep(300-i*20+2,.08,'sawtooth',.1)},i*50)}},25)}},
  {emoji:'💨',label:'Burnout',fn:()=>{let f=250;const burn=setInterval(()=>{beep(f+Math.random()*30,.04,'sawtooth',.1);beep(f/2,.04,'square',.06);f-=3;if(f<80)clearInterval(burn)},20)}},
];

export function eatSound() {
  // Mario coin — B5 then E6
  beep(988, .08, 'square', .12);
  setTimeout(() => beep(1319, .3, 'square', .1), 80);
}
export function dieSound() { [200,150,100,60].forEach((f,i) => setTimeout(() => beep(f,.4,'sawtooth',.15), i*120)); }

// Background tracks — Geometry Dash style
let bgInterval = null;
let bgStep = 0;
let currentTrack = 0;

const tracks = [
  // Track 0: Pumping electronic — fast bass + arpeggios
  { bpm: 280, play(step, b) {
    const bass = [65,65,82,65, 55,55,65,55];
    const arp = [262,330,392,523, 392,330,262,196];
    b(bass[step%8], .08, 'sawtooth', .06);
    if(step%2===0) b(arp[step%8], .06, 'square', .04);
    if(step%4===0) b(130, .03, 'square', .08); // kick
    if(step%4===2) b(800, .02, 'square', .05); // hat
  }},
  // Track 1: Dark synth wave
  { bpm: 220, play(step, b) {
    const bass = [55,55,73,55, 49,49,65,49];
    const mel = [440,0,523,0, 660,0,523,0];
    b(bass[step%8], .1, 'sawtooth', .05);
    if(mel[step%8]) b(mel[step%8], .08, 'triangle', .03);
    if(step%4===0) b(100, .03, 'square', .07);
    if(step%2===1) b(1200, .01, 'square', .03);
  }},
  // Track 2: Upside down — chaotic
  { bpm: 300, play(step, b) {
    b(40+Math.random()*40, .06, 'sawtooth', .05);
    if(step%3===0) b(200+Math.random()*200, .04, 'square', .04);
    if(step%4===0) b(80, .05, 'sawtooth', .07);
    if(step%8===0) b(30, .15, 'sawtooth', .06);
  }},
];

export function startBgTrack(trackIdx) {
  stopBgTrack();
  if (trackIdx !== undefined) currentTrack = trackIdx;
  const track = tracks[currentTrack % tracks.length];
  bgStep = 0;
  bgInterval = setInterval(() => {
    track.play(bgStep, beep);
    bgStep++;
  }, 60000 / track.bpm);
}

export function stopBgTrack() {
  if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
}

export function nextTrack() {
  currentTrack = (currentTrack + 1) % tracks.length;
  startBgTrack(currentTrack);
}
