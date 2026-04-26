// Web Audio API sound engine
let audioCtx;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Call this on first user interaction to unlock audio
export function unlockAudio() { getCtx(); }

export function beep(freq, dur, type = 'square') {
  const ctx = getCtx();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.07, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}

export const sbSounds = [
  {emoji:'👹',label:'Growl',fn:()=>{[80,60,40,30].forEach((f,i)=>setTimeout(()=>{beep(f,.3,'sawtooth');beep(f*1.5,.2,'square')},i*60))}},
  {emoji:'🗿',label:'Bruh',fn:()=>{beep(120,.4,'sawtooth');setTimeout(()=>beep(80,.5,'sawtooth'),150)}},
  {emoji:'💥',label:'Oof',fn:()=>{beep(400,.05);beep(200,.15);setTimeout(()=>beep(100,.2,'sawtooth'),50)}},
  {emoji:'🎺',label:'Wah Wah',fn:()=>{[300,250,200,120].forEach((f,i)=>setTimeout(()=>beep(f,.25,'triangle'),i*200))}},
  {emoji:'🚀',label:'Yeet',fn:()=>{for(let i=0;i<8;i++)setTimeout(()=>beep(200+i*100,.06),i*30)}},
  {emoji:'⚡',label:'Synth',fn:()=>{beep(65,.6,'sawtooth');beep(82,.6,'sawtooth');beep(98,.4,'square');setTimeout(()=>{beep(130,.4,'sawtooth');beep(164,.3,'square')},300)}},
  {emoji:'👻',label:'Spooky',fn:()=>{let f=800;const iv=setInterval(()=>{beep(f,.08,'sine');f-=40;if(f<100)clearInterval(iv)},40)}},
  {emoji:'🎮',label:'Skill Issue',fn:()=>{[523,466,415,349,311].forEach((f,i)=>setTimeout(()=>beep(f,.15,'square'),i*120))}},
  {emoji:'🤡',label:'Honk',fn:()=>{beep(300,.15,'square');setTimeout(()=>beep(250,.2,'square'),100);setTimeout(()=>beep(350,.15,'square'),250)}},
  {emoji:'🔴',label:'Upside Down',fn:()=>{for(let i=0;i<12;i++)setTimeout(()=>{beep(40+Math.random()*60,.15,'sawtooth');beep(100+Math.random()*100,.1,'square')},i*80)}},
  {emoji:'🏎️',label:'V8 Rev',fn:()=>{let f=60;const rev=setInterval(()=>{beep(f,.06,'sawtooth');beep(f*1.01,.06,'sawtooth');beep(f*2,.03,'square');f+=8;if(f>300){clearInterval(rev);for(let i=0;i<6;i++)setTimeout(()=>{beep(300-i*20,.08,'sawtooth');beep(300-i*20+2,.08,'sawtooth')},i*50)}},25)}},
  {emoji:'💨',label:'Burnout',fn:()=>{let f=250;const burn=setInterval(()=>{beep(f+Math.random()*30,.04,'sawtooth');beep(f/2,.04,'square');f-=3;if(f<80)clearInterval(burn)},20)}},
];

export function eatSound() { sbSounds[Math.floor(Math.random() * sbSounds.length)].fn(); }
export function dieSound() { [200,150,100,60].forEach((f,i) => setTimeout(() => beep(f,.4,'sawtooth'), i*120)); }

// Background synth track — Stranger Things inspired
let bgInterval = null;
const bgNotes = [
  // C minor arpeggios, dark and moody
  [131, 156, 196, 262], // Cm
  [117, 147, 175, 233], // Bb
  [104, 131, 156, 208], // Ab
  [117, 147, 175, 233], // Bb
];
let bgBar = 0;

export function startBgTrack() {
  if (bgInterval) return;
  bgInterval = setInterval(() => {
    const ctx = getCtx();
    const notes = bgNotes[bgBar % bgNotes.length];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.02, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.8);
        o.onended = () => { o.disconnect(); g.disconnect(); };
      }, i * 200);
    });
    bgBar++;
  }, 800);
}

export function stopBgTrack() {
  if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
}
