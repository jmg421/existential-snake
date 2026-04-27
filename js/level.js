// Level data — obstacle/collectible spawn patterns
// Each event: { t: time in ms from level start, type, lane (0-2), [subtype] }
// Types: 'obstacle', 'collectible', 'dimension_flip'
// Obstacle subtypes: 'demogorgon', 'vine', 'tentacle'
// Collectible subtypes: 'eggo' (1pt), 'light' (3pt), 'walkie' (shield)

export const LANE_COUNT = 3;

export const levels = [
  {
    name: 'Chapter 1: Hawkins Lab',
    speed: 3,        // base scroll px/frame
    speedRamp: 0.001, // speed increase per frame
    maxSpeed: 7,
    duration: 60000,  // 60 seconds
    bg: 'lab',
    events: generateLevel1(),
  },
];

function generateLevel1() {
  const events = [];
  let t = 2000; // start after 2s warmup
  while (t < 58000) {
    // Obstacle cluster
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const types = ['demogorgon', 'vine', 'tentacle'];
    events.push({ t, type: 'obstacle', lane, subtype: types[Math.floor(Math.random() * types.length)] });

    // Sometimes double obstacle (different lane)
    if (t > 15000 && Math.random() < 0.3) {
      let lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      events.push({ t: t + 200, type: 'obstacle', lane: lane2, subtype: types[Math.floor(Math.random() * types.length)] });
    }

    // Collectible between obstacles
    if (Math.random() < 0.5) {
      const cLane = Math.floor(Math.random() * LANE_COUNT);
      const csub = Math.random() < 0.6 ? 'eggo' : Math.random() < 0.7 ? 'light' : 'walkie';
      events.push({ t: t + 400, type: 'collectible', lane: cLane, subtype: csub });
    }

    // Dimension flip every ~15s
    if (t % 15000 < 800 && t > 5000) {
      events.push({ t, type: 'dimension_flip' });
    }

    // Gap between obstacles decreases over time
    const gap = Math.max(600, 1500 - t / 60);
    t += gap + Math.random() * 400;
  }
  return events.sort((a, b) => a.t - b.t);
}

export function getLevelByIndex(i) {
  return levels[Math.min(i, levels.length - 1)];
}
