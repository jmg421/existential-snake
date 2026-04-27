// Level data — obstacle/collectible spawn patterns
// Each event: { t: time in ms, type, lane (0-2), [subtype] }

export const LANE_COUNT = 3;

export const levels = [
  {
    name: 'Chapter 1: Hawkins Lab',
    desc: 'Slow speed, single obstacles, lots of collectibles',
    speed: 2,
    speedRamp: 0.0005,
    maxSpeed: 4,
    duration: 45000,
    events: generateLevel(1),
  },
  {
    name: 'Chapter 2: The Upside Down',
    desc: 'Faster, double obstacles, dimension flips',
    speed: 3,
    speedRamp: 0.001,
    maxSpeed: 6,
    duration: 50000,
    events: generateLevel(2),
  },
  {
    name: 'Chapter 3: Vecna\'s Lair',
    desc: 'Fast, triple obstacles, fewer collectibles',
    speed: 4,
    speedRamp: 0.0015,
    maxSpeed: 8,
    duration: 60000,
    events: generateLevel(3),
  },
];

function generateLevel(chapter) {
  const events = [];
  const duration = chapter === 1 ? 43000 : chapter === 2 ? 48000 : 58000;
  let t = 3000; // 3s warmup

  // Chapter-specific settings
  const doubleChance = chapter === 1 ? 0 : chapter === 2 ? 0.25 : 0.4;
  const tripleChance = chapter === 3 ? 0.15 : 0;
  const collectChance = chapter === 1 ? 0.7 : chapter === 2 ? 0.5 : 0.35;
  const heartChance = chapter === 1 ? 0.12 : chapter === 2 ? 0.08 : 0.05;
  const minGap = chapter === 1 ? 1200 : chapter === 2 ? 900 : 700;
  const maxGap = chapter === 1 ? 2200 : chapter === 2 ? 1600 : 1200;
  const flipInterval = chapter === 1 ? 0 : chapter === 2 ? 18000 : 12000;

  const obstacleTypes = ['demogorgon', 'vine', 'tentacle'];

  while (t < duration) {
    // Obstacle
    const lane = Math.floor(Math.random() * LANE_COUNT);
    events.push({ t, type: 'obstacle', lane, subtype: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)] });

    // Double obstacle (different lane)
    if (Math.random() < doubleChance) {
      const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      events.push({ t: t + 150, type: 'obstacle', lane: lane2, subtype: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)] });
    }

    // Triple obstacle (only chapter 3)
    if (Math.random() < tripleChance) {
      // Block 2 lanes, leave 1 safe
      const safe = Math.floor(Math.random() * LANE_COUNT);
      for (let i = 0; i < LANE_COUNT; i++) {
        if (i !== safe) events.push({ t: t + 100, type: 'obstacle', lane: i, subtype: 'tentacle' });
      }
    }

    // Collectible
    if (Math.random() < collectChance) {
      const cLane = Math.floor(Math.random() * LANE_COUNT);
      let csub;
      if (Math.random() < heartChance) csub = 'heart';
      else if (Math.random() < 0.15) csub = 'walkie';
      else if (Math.random() < 0.3) csub = 'light';
      else csub = 'eggo';
      events.push({ t: t + 400, type: 'collectible', lane: cLane, subtype: csub });
    }

    // Dimension flip
    if (flipInterval > 0 && t > 5000 && t % flipInterval < minGap) {
      events.push({ t, type: 'dimension_flip' });
    }

    // Gap between obstacles
    t += minGap + Math.random() * (maxGap - minGap);
  }

  return events.sort((a, b) => a.t - b.t);
}

export function getLevelByIndex(i) {
  return levels[Math.min(i, levels.length - 1)];
}
