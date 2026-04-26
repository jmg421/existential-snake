// Game constants and content
export const G = 20;
export const SPEED_INITIAL = 120;
export const SPEED_MIN = 45;
export const SPEED_DECREMENT = 3;

export const stChars = ['🧒','👧','🚲','🧇','📺','💡','🎄','🔦','🏚️','🕷️','👾','🌀','🔴','⬡'];
export const emojis = ['💀','🗿','😭','🔥','💯','🧠','👁️','🫠','🤡','😈','🕷️','🔴','⬡','👾','🌀','🫨','🤯','🧇','💡','📺','🚲','🎄'];
export const floatTexts = ['GYATT','SIGMA','RIZZ','SKIBIDI','BUSSIN','GOATED','SLAY','NO CAP','FR FR','OHIO','FANUM TAX','BASED','SHEESH','LOCK IN','AURA +100','BRAINROT','DELULU','ELEVEN/10','FRIENDS DONT LIE','THE UPSIDE DOWN','RUN','VECNA RIZZ','DEMOGORGON ATE','HAWKINS OHIO','MOUTH BREATHER','SHOULD I STAY OR SHOULD I GO','RUNNING UP THAT HILL','MORNINGS ARE FOR COFFEE AND CONTEMPLATION','VROOM VROOM','SPEED DEMON','TURBO MODE','GAS GAS GAS','INITIAL D MOMENT','TOKYO DRIFT','NEED FOR SPEED','FAST AND FURIOUS','PEDAL TO THE METAL','ZOOM ZOOM','BUILT DIFFERENT','MAIN CHARACTER','PLOT ARMOR','SIDE QUEST','NPC BEHAVIOR','RESPAWN','CLUTCH','GG EZ','SKILL DIFF','TOUCH GRASS','ITS GIVING','SNATCHED','UNDERSTOOD THE ASSIGNMENT'];

export const stAsciiChars = [
  {name:'ELEVEN',art:'011',color:'#f8a'},
  {name:'DEMOGORGON',art:'🌸',color:'#f44'},
  {name:'VECNA',art:'🕷️',color:'#a00'},
  {name:'MIND FLAYER',art:'🌩️',color:'#606'},
  {name:'DUSTIN',art:'🧢',color:'#4af'},
  {name:'HOPPER',art:'🎖️',color:'#fa0'},
  {name:'WILL',art:'💡',color:'#ff0'},
  {name:'MAX',art:'🎧',color:'#f44'},
];

export const thoughts = [
  ["entering hawkins... lowkey scared ngl","first bite in the right-side up. mid.","will byers would never 💀","the demogorgon has more rizz than me"],
  ["im literally eleven rn no cap","this is giving hawkins lab energy","the mind flayer is just vecnas skibidi form","fanum taxing these eggo waffles 🧇"],
  ["bro think he a demogorgon 💀","the upside down is just ohio fr","vecna got that sigma stare ngl","hopper would be proud. or concerned."],
  ["im so goated even the mind flayer noticed","the gate is open and so is my third eye","chat is this the upside down or ohio\n(same thing)","running up that hill but make it snake 🎧"],
  ["the lights are flickering and so is my sanity","joyce would be spelling my name on the wall rn","every christmas light is a cry for help","stranger things have happened\n(literally)"],
  ["the vines are giving me the ick","im in my vecna arc fr fr","the upside down cant contain my aura","eleven could never (she could actually)"],
  ["i am the demogorgon now 🌀","the mind flayer wishes he had this length","my tail extends into the upside down","dustin would understand me 🧢"],
  ["the gate between dimensions is just\na skill issue","vecnas curse is just brainrot\nchange my mind","im not running from vecna\nvecna is running from me 🗿"],
  ["i have become the upside down\nthe upside down has become me","the demogorgon was the friends\nwe made along the way","maxs favorite song cant save me now 🎧"],
  ["i have seen all dimensions\nright-side up. upside down. and ohio.\nohio was the worst. 💀","the final gate has opened\ni am the snake that runs through all worlds\nskibidi dop dop yes yes 🚽"]
];

export const lessons = [
  "SCORE aura. consumed by the upside down.\nvecna sends his regards 🕷️","skill issue + ratio + fell off\n+ no aura + the demogorgon ate better","the lights flickered SCORE times\nand then went dark forever\njust like your attention span",
  "you survived SCORE meals in hawkins\nwhich is SCORE more than barb 💀\n(rip barb. gone but not forgotten.)","the mind flayer claimed another one\nSCORE points of pure delusion\nthe upside down remembers nothing",
  "SCORE aura lost between dimensions\nshould have run up that hill\nshould have played your favorite song\nbut you chose to be a snake instead 🎧"
];

export const goTitles = ["VECNA GOT YOU 🕷️","THE UPSIDE DOWN WINS","💀 DEMOGORGOND 💀","SKILL ISSUE (HAWKINS EDITION)","THE GATE CLOSED ON YOU","MOUTH BREATHER 🗿","BARBD 💀"];

// Snake skins — unlocked by high score milestones
export const skins = [
  { name: 'Default', id: 'default', unlock: 0, head: null, body: null, desc: 'just a snake' },
  { name: 'Eleven', id: 'eleven', unlock: 5, head: '🧒', body: '🔴', desc: 'unlock at 5 aura' },
  { name: 'Demogorgon', id: 'demogorgon', unlock: 15, head: '🌸', body: '🩸', desc: 'unlock at 15 aura' },
  { name: 'Vecna', id: 'vecna', unlock: 25, head: '🕷️', body: '⬡', desc: 'unlock at 25 aura' },
  { name: 'Mind Flayer', id: 'mindflayer', unlock: 40, head: '🌩️', body: '🌀', desc: 'unlock at 40 aura' },
  { name: 'Skibidi', id: 'skibidi', unlock: 60, head: '🚽', body: '💀', desc: 'unlock at 60 aura' },
  { name: 'Ohio Final Boss', id: 'ohio', unlock: 100, head: '👑', body: '🔥', desc: 'unlock at 100 aura' },
];

export function getUnlockedSkins() {
  const best = parseInt(localStorage.getItem('skibidi-highscore') || '0');
  return skins.filter(s => best >= s.unlock);
}

export function getActiveSkin() {
  const id = localStorage.getItem('skibidi-skin') || 'default';
  return skins.find(s => s.id === id) || skins[0];
}

export function setActiveSkin(id) {
  localStorage.setItem('skibidi-skin', id);
}

// NFL trivia — sprinkled into gameplay
export const nflTrivia = [
  "joe thomas never missed a snap in 10 seasons. 10,363 consecutive. this snake could never 🏈",
  "spencer fano really said 'joe thomas never missed a snap' like it was nothing 💀",
  "the longest NFL game lasted 82 minutes 40 seconds. this round feels longer ngl",
  "a football field is 360 feet. this grid is 600 pixels. basically the same thing",
  "peyton manning audibled more than he ran plays. me changing direction every 2 seconds 🗿",
  "the NFL draft has 7 rounds. the upside down has infinite dimensions. ohio has both",
  "deion sanders played an NFL game and MLB game on the same day. i cant even eat food without dying",
  "tom brady won 7 super bowls. i have SCORE aura. we are not the same",
  "the seahawks once passed on the 1 yard line. i just ran into a wall. we understand each other",
  "lamar jackson runs a 4.34 forty. this snake runs a 4.34 into the nearest wall 🏃",
  "the bills lost 4 super bowls in a row. i lost 4 games in a row. bills mafia 🤝 snake mafia",
  "fun fact: an NFL ball has 132 laces. this game has 0 laces and 0 chill",
];

// Theme
export function getTheme() { return localStorage.getItem('skibidi-theme') || 'dark'; }
export function setTheme(t) { localStorage.setItem('skibidi-theme', t); }
export function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
