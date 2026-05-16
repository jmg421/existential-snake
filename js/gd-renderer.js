// GD renderer — 8-layer system, flat ground, parallax, particles, trail, beat pulse
import { UNIT, PLAYER_X, PLAYER_SIZE } from './physics.js';
import { beat } from './beat-clock.js';
import * as P from './particles.js';

export const CW = 1200, CH = 600;
const GLY = CH - 80; // ground line Y — FLAT, no slope

function toY(worldY) { return GLY - worldY * UNIT; }

// Pre-generate parallax elements (once)
const stars = Array.from({length: 40}, () => ({
  x: Math.random() * CW * 4, y: Math.random() * (GLY - 40) + 20,
  s: Math.random() * 2 + 0.5, br: Math.random() * 0.3 + 0.1,
}));
const mountains = Array.from({length: 7}, (_, i) => ({
  x: i * CW * 0.7, w: 100 + Math.random() * 200, h: 40 + Math.random() * 80,
}));

// Trail ring buffer
const TRAIL_LEN = 12;
const trail = Array.from({length: TRAIL_LEN}, () => ({y: 0, rot: 0}));
let trailIdx = 0, trailFrame = 0;

const ORB_COLORS = { yellow: '#ff0', blue: '#48f', pink: '#f4f', orb: '#ff0' };
const PAD_COLORS = { pad: '#ff0', pad_yellow: '#ff0', pad_blue: '#48f', pad_pink: '#f4f' };

export function render(ctx, state) {
  const { player, scrollX, objects, flash, attempts, songPct } = state;
  const bg = state.bg || [10, 0, 30];
  const gnd = state.gnd || [40, 0, 80];
  const currentBeat = beat() || 0;
  const beatPhase = currentBeat % 1;
  const pulse = beatPhase < 0.1 ? 1 - beatPhase / 0.1 : 0;

  ctx.save();

  // Shake (damped sinusoidal)
  if (state.shake > 0.5) {
    const s = state.shake;
    ctx.translate(Math.sin(s * 15) * s * 1.5 | 0, Math.cos(s * 12) * s | 0);
  }

  // L0: Background gradient
  ctx.fillStyle = `rgb(${bg[0]|0},${bg[1]|0},${bg[2]|0})`;
  ctx.fillRect(0, 0, CW, CH);
  // Darker bottom
  ctx.fillStyle = `rgba(0,0,0,0.3)`;
  ctx.fillRect(0, GLY * 0.6 | 0, CW, CH - GLY * 0.6 | 0);

  // L1: Far parallax stars
  for (const s of stars) {
    const sx = ((s.x - scrollX * 0.05) % (CW * 4) + CW * 4) % (CW * 4) - CW * 0.5;
    if (sx < -5 || sx > CW + 5) continue;
    const br = s.br + pulse * 0.15;
    ctx.fillStyle = `rgba(255,255,255,${br.toFixed(2)})`;
    ctx.fillRect(sx | 0, s.y | 0, s.s | 0, s.s | 0);
  }

  // L2: Mid parallax mountains
  ctx.fillStyle = `rgba(${Math.min(255, bg[0] + 15)},${Math.min(255, bg[1] + 15)},${Math.min(255, bg[2] + 15)},0.25)`;
  for (const m of mountains) {
    const mx = ((m.x - scrollX * 0.2) % (CW * 4) + CW * 4) % (CW * 4) - CW * 0.5;
    if (mx > CW + 300 || mx + m.w < -300) continue;
    ctx.beginPath();
    ctx.moveTo(mx | 0, GLY);
    ctx.lineTo(mx + m.w / 2 | 0, GLY - m.h | 0);
    ctx.lineTo(mx + m.w | 0, GLY);
    ctx.closePath();
    ctx.fill();
  }

  // L3: Ground
  const gr = gnd[0] | 0, gg = gnd[1] | 0, gb = gnd[2] | 0;
  ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
  ctx.fillRect(0, GLY, CW, CH - GLY);

  // Ground line with beat pulse
  const lw = 2 + pulse * 3;
  const lr = Math.min(255, gr + 40 + pulse * 40) | 0;
  const lg2 = Math.min(255, gg + 40 + pulse * 40) | 0;
  const lb = Math.min(255, gb + 40 + pulse * 40) | 0;
  ctx.strokeStyle = `rgb(${lr},${lg2},${lb})`;
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(0, GLY); ctx.lineTo(CW, GLY); ctx.stroke();

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  const gridOff = scrollX % UNIT;
  for (let gx = -gridOff; gx < CW; gx += UNIT) {
    ctx.beginPath(); ctx.moveTo(gx | 0, GLY); ctx.lineTo(gx | 0, CH); ctx.stroke();
  }

  // L4: Objects
  for (const obj of objects) {
    const sx = obj.worldX - scrollX;
    if (sx < -UNIT * 2 || sx > CW + UNIT * 2) continue;
    const oy = obj.y || 0, oh = obj.h || 1, ow = obj.w || 1;

    if (obj.type === 'spike' || obj.type === 'hazard') {
      const bx = sx | 0, by = toY(oy) | 0;
      // Glow
      ctx.fillStyle = 'rgba(255,60,60,0.15)';
      ctx.beginPath();
      ctx.moveTo(bx - 3, by + 2); ctx.lineTo(bx + UNIT / 2, by - UNIT - 3); ctx.lineTo(bx + UNIT + 3, by + 2);
      ctx.closePath(); ctx.fill();
      // Main
      ctx.fillStyle = '#f44';
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx + UNIT / 2, by - UNIT); ctx.lineTo(bx + UNIT, by);
      ctx.closePath(); ctx.fill();
      // Inner detail
      ctx.strokeStyle = 'rgba(255,150,150,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 8, by - 2); ctx.lineTo(bx + UNIT / 2, by - UNIT + 10); ctx.lineTo(bx + UNIT - 8, by - 2);
      ctx.stroke();

    } else if (obj.type === 'block') {
      const bx = sx | 0, by = toY(oy + oh) | 0;
      const bw = ow * UNIT | 0, bh = oh * UNIT | 0;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(bx + 2, by + 2, bw, bh);
      // Fill
      ctx.fillStyle = `rgb(${Math.min(255, gr + 30)},${Math.min(255, gg + 30)},${Math.min(255, gb + 30)})`;
      ctx.fillRect(bx, by, bw, bh);
      // Border
      ctx.strokeStyle = `rgb(${Math.min(255, gr + 60)},${Math.min(255, gg + 60)},${Math.min(255, gb + 60)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      // Cross detail
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by + bh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + bw, by); ctx.lineTo(bx, by + bh); ctx.stroke();

    } else if (obj.type === 'orb' || obj.type === 'orb_yellow' || obj.type === 'orb_blue' || obj.type === 'orb_pink') {
      const orbY = obj.y || 3;
      const cx = (sx + UNIT / 2) | 0, cy = toY(orbY + 0.5) | 0;
      const baseR = 14 + Math.sin(currentBeat * Math.PI * 2) * 2;
      const col = ORB_COLORS[obj.type] || '#ff0';
      const isActive = player.overlappingOrb === obj;
      // Glow
      ctx.fillStyle = isActive ? col : `${col}33`;
      ctx.beginPath(); ctx.arc(cx, cy, baseR + 6, 0, Math.PI * 2); ctx.fill();
      // Ring
      ctx.strokeStyle = col;
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.stroke();
      // Inner
      ctx.fillStyle = `${col}99`;
      ctx.beginPath(); ctx.arc(cx, cy, baseR - 4, 0, Math.PI * 2); ctx.fill();

    } else if (PAD_COLORS[obj.type]) {
      const bx = sx | 0, by = toY(oy) | 0;
      const col = PAD_COLORS[obj.type];
      // Glow lines
      ctx.strokeStyle = `${col}44`;
      ctx.lineWidth = 1;
      for (let li = 0; li < 3; li++) {
        const lx = bx + 8 + li * 12;
        ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx, by - 8 - li * 3); ctx.stroke();
      }
      // Chevron
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(bx + 2, by); ctx.lineTo(bx + UNIT / 2, by - 12);
      ctx.lineTo(bx + UNIT - 2, by); ctx.closePath(); ctx.fill();

    } else if (obj.type === 'portal_gravity_flip' || obj.type === 'portal_gravity_normal') {
      const bx = sx | 0, by = toY(2.5) | 0;
      const col = obj.type === 'portal_gravity_flip' ? '#48f' : '#ff0';
      ctx.fillStyle = `${col}22`;
      ctx.fillRect(bx + 10, by, 20, UNIT * 2.5 | 0);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 10, by, 20, UNIT * 2.5 | 0);

    } else if (obj.type === 'portal_ship' || obj.type === 'portal_cube') {
      const bx = sx | 0, by = toY(4) | 0;
      const col = obj.type === 'portal_ship' ? '#f0f' : '#0ff';
      ctx.fillStyle = `${col}22`;
      ctx.fillRect(bx + 8, by, 24, UNIT * 4 | 0);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 8, by, 24, UNIT * 4 | 0);
      ctx.fillStyle = col;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(obj.type === 'portal_ship' ? '▷' : '□', bx + 20, by + UNIT * 2);
    }
  }

  // L5: Player + trail
  if (!player.dead) {
    const px = PLAYER_X * UNIT | 0;
    const ps = PLAYER_SIZE * UNIT | 0;
    const py = toY(player.y + PLAYER_SIZE) | 0;

    // Record trail
    if (++trailFrame % 2 === 0) {
      trail[trailIdx] = { y: player.y, rot: player.rotation };
      trailIdx = (trailIdx + 1) % TRAIL_LEN;
    }

    // Draw trail
    for (let t = 0; t < TRAIL_LEN; t++) {
      const idx = (trailIdx + t) % TRAIL_LEN;
      const age = (TRAIL_LEN - t) / TRAIL_LEN;
      const ty = toY(trail[idx].y + PLAYER_SIZE) | 0;
      const ts = ps * (0.3 + age * 0.5) | 0;
      const tx = px - (TRAIL_LEN - t) * 6;
      ctx.fillStyle = `rgba(0,255,0,${(age * 0.2).toFixed(2)})`;
      ctx.save();
      ctx.translate(tx + ts / 2, ty + ps / 2);
      ctx.rotate(trail[idx].rot * Math.PI / 180);
      ctx.fillRect(-ts / 2, -ts / 2, ts, ts);
      ctx.restore();
    }

    // Player glow
    ctx.fillStyle = 'rgba(0,255,0,0.12)';
    ctx.fillRect(px - 4, py - 4, ps + 8, ps + 8);

    // Player body with squash/stretch
    ctx.save();
    ctx.translate(px + ps / 2, py + ps / 2);
    ctx.rotate(player.rotation * Math.PI / 180);
    ctx.scale(player.scaleX || 1, player.scaleY || 1);
    ctx.fillStyle = '#0f0';
    if (player.mode === 'ship') {
      // Ship shape: a pointed triangle/arrow
      ctx.beginPath();
      ctx.moveTo(ps / 2, 0);
      ctx.lineTo(-ps / 2, -ps / 2);
      ctx.lineTo(-ps / 4, 0);
      ctx.lineTo(-ps / 2, ps / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0a0';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillRect(-ps / 2, -ps / 2, ps, ps);
      // Face
      ctx.fillStyle = '#000';
      ctx.fillRect(-ps / 2 + ps * 0.55 | 0, -ps / 2 + ps * 0.2 | 0, ps * 0.12 | 0, ps * 0.2 | 0);
      ctx.fillRect(-ps / 2 + ps * 0.75 | 0, -ps / 2 + ps * 0.2 | 0, ps * 0.12 | 0, ps * 0.2 | 0);
    }
    ctx.restore();

    // Ground shadow
    if (!player.grounded) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(px + ps / 2, GLY, ps / 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // L6: Particles
  P.draw(ctx, scrollX, UNIT, GLY);

  // L7: UI
  // Flash
  if (flash > 0) {
    ctx.fillStyle = state.flashColor || `rgba(255,255,255,${Math.min(0.5, flash).toFixed(2)})`;
    ctx.fillRect(0, 0, CW, CH);
  }
  if (player.dead) {
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.fillRect(0, 0, CW, CH);
  }

  // Progress bar
  const barX = 20, barW = CW - 40;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(barX, 12, barW, 6);
  if (state.checkpoint > 0) {
    ctx.fillStyle = 'rgba(255,255,0,0.4)';
    ctx.fillRect(barX, 12, barW * state.checkpoint | 0, 6);
  }
  ctx.fillStyle = '#0f0';
  ctx.fillRect(barX, 12, barW * songPct | 0, 6);

  // Text
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Attempt ${attempts}`, CW - 20, 36);
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(songPct * 100)}%`, 20, 36);

  // Checkpoint message
  if (state.checkpointMsgTimer > 0) {
    const a = Math.min(1, state.checkpointMsgTimer / 0.4);
    const sc = 1 + (1 - a) * 0.3;
    ctx.globalAlpha = a;
    ctx.font = `bold ${36 * sc | 0}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f0';
    ctx.fillText(state.checkpointMsg, CW / 2, CH / 2);
    ctx.globalAlpha = 1;
  }

  // Win
  if (state.won) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#0f0'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE', CW / 2, CH / 2 - 30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace';
    ctx.fillText(`${attempts} attempts`, CW / 2, CH / 2 + 20);
    ctx.fillStyle = '#888'; ctx.font = '14px monospace';
    ctx.fillText('the upside down fears you now', CW / 2, CH / 2 + 55);
  }

  // Version
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(state.version || '', CW - 6, CH - 6);

  ctx.restore();
}
