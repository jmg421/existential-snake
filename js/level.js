// Level data — 6 chapters, gentle difficulty curve
export const LANE_COUNT = 3;

export const levels = [
  { name: 'Chapter 1: Hawkins Lab',       speed: 2,   speedRamp: 0.0003, maxSpeed: 3,   duration: 40000, bg: [20,18,45],    events: null },
  { name: 'Chapter 2: The Wheeler House', speed: 2.3, speedRamp: 0.0004, maxSpeed: 3.5, duration: 45000, bg: [12,35,20],    events: null },
  { name: 'Chapter 3: The Upside Down',   speed: 2.6, speedRamp: 0.0005, maxSpeed: 4,   duration: 50000, bg: [40,10,50],    events: null },
  { name: 'Chapter 4: Starcourt Mall',    speed: 3,   speedRamp: 0.0006, maxSpeed: 5,   duration: 55000, bg: [15,20,45],    events: null },
  { name: 'Chapter 5: The Mind Flayer',   speed: 3.3, speedRamp: 0.0007, maxSpeed: 5.5, duration: 60000, bg: [40,12,18],    events: null },
  { name: 'Chapter 6: Vecna\'s Lair',     speed: 3.6, speedRamp: 0.0008, maxSpeed: 6,   duration: 65000, bg: [50,8,8],      events: null },
];

// Generate events for each level
levels.forEach((lvl, i) => { lvl.events = generateLevel(i + 1); });

function generateLevel(chapter) {
  const events = [];
  const duration = levels[chapter - 1].duration - 2000;
  let t = 3000;

  // Gentle ramp: each chapter ~15% harder than previous
  const doubleChance =  [0, 0, 0.1, 0.15, 0.2, 0.3][chapter - 1];
  const tripleChance =  [0, 0, 0, 0, 0.05, 0.1][chapter - 1];
  const collectChance = [0.75, 0.7, 0.65, 0.6, 0.55, 0.5][chapter - 1];
  const heartChance =   [0.15, 0.12, 0.1, 0.08, 0.06, 0.05][chapter - 1];
  const minGap =        [1400, 1300, 1200, 1100, 1000, 900][chapter - 1];
  const maxGap =        [2400, 2200, 2000, 1800, 1600, 1400][chapter - 1];
  const flipInterval =  [0, 0, 20000, 18000, 15000, 12000][chapter - 1];

  const obstacleTypes = ['demogorgon', 'vine', 'tentacle'];

  while (t < duration) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    events.push({ t, type: 'obstacle', lane, subtype: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)] });

    let usedLanes = [lane];

    if (Math.random() < doubleChance) {
      // Pick a lane that's NOT the first obstacle's lane
      const available = [0, 1, 2].filter(l => l !== lane);
      const lane2 = available[Math.floor(Math.random() * available.length)];
      events.push({ t: t + 150, type: 'obstacle', lane: lane2, subtype: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)] });
      usedLanes.push(lane2);
    } else if (Math.random() < tripleChance) {
      // Only if we didn't already double — block 2 lanes, leave 1 safe
      const safe = Math.floor(Math.random() * LANE_COUNT);
      for (let i = 0; i < LANE_COUNT; i++) {
        if (i !== safe) events.push({ t: t + 100, type: 'obstacle', lane: i, subtype: 'tentacle' });
      }
    }

    if (Math.random() < collectChance) {
      const cLane = Math.floor(Math.random() * LANE_COUNT);
      let csub;
      if (Math.random() < heartChance) csub = 'heart';
      else if (Math.random() < 0.12) csub = 'walkie';
      else if (Math.random() < 0.3) csub = 'light';
      else csub = 'eggo';
      events.push({ t: t + 400, type: 'collectible', lane: cLane, subtype: csub });
    }

    if (flipInterval > 0 && t > 5000 && t % flipInterval < minGap) {
      events.push({ t, type: 'dimension_flip' });
    }

    t += minGap + Math.random() * (maxGap - minGap);
  }

  return events.sort((a, b) => a.t - b.t);
}

export function getLevelByIndex(i) {
  return levels[Math.min(i, levels.length - 1)];
}
