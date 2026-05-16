// GD Import — parse Geometry Dash level strings into our JSON level format
// Format: base64 → zlib inflate → semicolon-delimited objects with comma key,value pairs

// Object ID → our type mapping
const SPIKES = new Set([8, 39, 103, 135, 140, 173, 183, 184, 185, 186, 187, 188, 189, 190, 191, 198, 199, 392, 393, 394, 395, 396, 397, 398, 399, 720, 721, 722, 723, 724, 725, 726, 727, 766, 1705, 1706, 1707, 1708, 1709, 1710, 1711, 1712, 1713, 1714, 1715, 1716, 1717, 1718, 1719, 1720]);
const BLOCKS = new Set([1, 2, 3, 4, 5, 6, 7, 40, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 74, 75, 76, 77, 78, 81, 82, 83, 90, 91, 92, 93, 94, 95, 96, 116, 117, 118, 119, 121, 122, 143, 146, 147, 160, 161, 162, 163, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 192, 194, 195, 196, 197, 204, 206, 207, 208, 209, 210, 212, 213, 215, 219, 220, 247, 248, 249, 250, 252, 253, 254, 255, 256, 257, 258, 260, 261, 263, 264, 265, 267, 268, 269, 270, 271, 272, 274, 275, 289, 291, 467, 468, 469, 470, 471, 475, 483, 484, 492, 493]);
const JUMP_PADS = { 35: 'pad_yellow', 67: 'pad_blue', 140: 'pad_pink', 1332: 'pad_yellow' };
const ORBS_MAP = { 36: 'orb_yellow', 84: 'orb_blue', 141: 'orb_pink', 1022: 'orb_yellow', 1333: 'orb_yellow' };
const GRAVITY_PORTALS = new Set([10, 11]);
const SPEED_PORTALS = new Set([200, 201, 202, 203, 1334]);
const MODE_PORTALS = new Set([12, 13, 47, 111, 660, 745, 1331]);

// Speed portal ID → our speed value (pixels per unit per second)
const SPEED_MAP = { 1334: 5, 200: 8, 201: 10, 202: 13, 203: 16 };

// GD grid: 30px per unit. Our grid: UNIT=40px. Scale factor:
const GD_GRID = 30;

// Parse a single GD object string "1,8,2,300,3,150,..."
function parseGDObject(str) {
  const parts = str.split(',');
  const obj = {};
  for (let i = 0; i < parts.length - 1; i += 2) {
    const key = parseInt(parts[i]);
    const val = parts[i + 1];
    obj[key] = isNaN(Number(val)) ? val : Number(val);
  }
  return obj;
}

// Convert GD object to our level format object
function convertObject(gdObj, pxPerBeat) {
  const id = gdObj[1];
  const x = gdObj[2] || 0;  // GD x position in grid pixels
  const y = gdObj[3] || 0;  // GD y position in grid pixels
  const beat = x / pxPerBeat;
  // GD ground is at y=0 (bottom). Our y=0 is ground. Convert:
  // GD y is from bottom, in GD pixels. Ground objects are around y=15 (half a block).
  // Normalize: GD ground level ≈ 15px (center of first row). Our y=0 is ground.
  const groundLevel = GD_GRID / 2; // 15
  const ourY = Math.max(0, Math.round((y - groundLevel) / GD_GRID));

  if (SPIKES.has(id)) {
    return { beat: Math.round(beat * 4) / 4, type: 'spike', y: ourY };
  }
  if (BLOCKS.has(id)) {
    return { beat: Math.round(beat * 4) / 4, type: 'block', h: 1, y: ourY };
  }
  if (JUMP_PADS[id]) {
    return { beat: Math.round(beat * 4) / 4, type: JUMP_PADS[id], y: ourY };
  }
  if (ORBS_MAP[id]) {
    return { beat: Math.round(beat * 4) / 4, type: ORBS_MAP[id], y: Math.max(ourY, 2) };
  }
  if (id === 10) {
    return { beat: Math.round(beat * 4) / 4, type: 'portal_gravity_flip' };
  }
  if (id === 11) {
    return { beat: Math.round(beat * 4) / 4, type: 'portal_gravity_normal' };
  }
  if (SPEED_PORTALS.has(id)) {
    return { beat: Math.round(beat * 4) / 4, type: 'portal_speed', speed: SPEED_MAP[id] || 8 };
  }
  return null; // decorative object, skip
}

// Decode a GD level string (base64+zlib or raw)
function decodeLevelString(data) {
  data = data.trim();
  // Try base64 + zlib first
  try {
    const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return pako.inflate(bytes, { to: 'string' });
  } catch (e) {
    // Maybe it's already decoded plaintext
    if (data.includes(';') && data.includes(',')) return data;
    throw new Error('Could not decode level data: ' + e.message);
  }
}

// Main import function: GD level string → our JSON level format
export function importGDLevel(encodedData, options = {}) {
  const raw = decodeLevelString(encodedData);

  // Split into header and objects. GD format: header;obj1;obj2;...
  const sections = raw.split(';');
  const header = parseGDObject(sections[0]);

  // BPM: default 140 if not in data, user can override
  const bpm = options.bpm || 140;
  // GD base scroll speed in pixels/sec at 1x: ~311.58 px/s (at 1x speed)
  const gdSpeed = 311.58;
  // Pixels per beat at this BPM
  const pxPerBeat = gdSpeed * 60 / bpm;

  const objects = [];
  const triggers = [];

  for (let i = 1; i < sections.length; i++) {
    if (!sections[i].trim()) continue;
    const gdObj = parseGDObject(sections[i]);
    if (!gdObj[1]) continue;

    const converted = convertObject(gdObj, pxPerBeat);
    if (converted) {
      if (converted.type === 'portal_speed') {
        triggers.push({ beat: converted.beat, type: 'speed', value: converted.speed });
      } else {
        objects.push(converted);
      }
    }
  }

  // Sort by beat
  objects.sort((a, b) => a.beat - b.beat);
  triggers.sort((a, b) => a.beat - b.beat);

  // Add default color triggers
  if (!triggers.some(t => t.type === 'color')) {
    triggers.unshift({ beat: 0, type: 'color', bg: [10, 0, 30], ground: [40, 0, 80] });
  }

  return {
    meta: {
      name: options.name || 'GD Import',
      author: options.author || 'imported',
      song: options.song || 'audio/stereo-madness.mp3',
      bpm,
      offset: options.offset || 0,
      speed: 8,
    },
    objects,
    triggers,
  };
}

// Also support pasting raw object strings (already decoded)
export function importRawGDObjects(objectString, options = {}) {
  return importGDLevel(objectString, options);
}
