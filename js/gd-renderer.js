// GD renderer — minimal M1: ground, obstacles, player, progress bar
import { UNIT, PLAYER_X, PLAYER_SIZE } from './physics.js';

const CW = 800, CH = 400;
const GROUND_Y = CH - 80; // ground line in canvas pixels

// Convert world-y (units above ground) to canvas-y
function toCanvasY(worldY) { return GROUND_Y - worldY * UNIT; }

export function render(ctx, state) {
  const { player, scrollX, level, objects, triggers, flash, attempts, songPct } = state;
  const cw = CW, ch = CH;

  // Current colors
  const bg = state.bg || [10, 0, 30];
  const gnd = state.gnd || [40, 0, 80];

  ctx.save();

  // Screen shake
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake * 2, (Math.random() - 0.5) * state.shake * 2);
  }

  // Background
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
  ctx.fillRect(0, 0, cw, ch);

  // Ground
  ctx.fillStyle = `rgb(${gnd[0]},${gnd[1]},${gnd[2]})`;
  ctx.fillRect(0, GROUND_Y, cw, ch - GROUND_Y);
  ctx.strokeStyle = `rgb(${Math.min(255, gnd[0] + 40)},${Math.min(255, gnd[1] + 40)},${Math.min(255, gnd[2] + 40)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(cw, GROUND_Y); ctx.stroke();

  // Grid lines on ground (scrolling)
  ctx.strokeStyle = `rgba(255,255,255,0.05)`;
  ctx.lineWidth = 1;
  const gridOff = scrollX % UNIT;
  for (let x = -gridOff; x < cw; x += UNIT) {
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, ch); ctx.stroke();
  }

  // Objects
  for (const obj of objects) {
    const sx = obj.worldX - scrollX;
    if (sx < -UNIT * 2 || sx > cw + UNIT * 2) continue;
    const oy = (obj.y || 0);
    const oh = (obj.h || 1);
    const ow = (obj.w || 1);

    if (obj.type === 'spike') {
      const bx = sx, by = toCanvasY(oy);
      ctx.fillStyle = '#f44';
      ctx.shadowColor = '#f00'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + UNIT / 2, by - UNIT);
      ctx.lineTo(bx + UNIT, by);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (obj.type === 'block') {
      const bx = sx, by = toCanvasY(oy + oh);
      ctx.fillStyle = `rgb(${gnd[0] + 30},${gnd[1] + 30},${gnd[2] + 30})`;
      ctx.fillRect(bx, by, ow * UNIT, oh * UNIT);
      ctx.strokeStyle = `rgb(${Math.min(255, gnd[0] + 60)},${Math.min(255, gnd[1] + 60)},${Math.min(255, gnd[2] + 60)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, ow * UNIT, oh * UNIT);
    } else if (obj.type === 'pad') {
      const bx = sx, by = toCanvasY(oy);
      ctx.fillStyle = '#ff0';
      ctx.shadowColor = '#ff0'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(bx + 4, by);
      ctx.lineTo(bx + UNIT / 2, by - UNIT * 0.6);
      ctx.lineTo(bx + UNIT - 4, by);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Player
  if (!player.dead) {
    const px = PLAYER_X * UNIT;
    const py = toCanvasY(player.y + PLAYER_SIZE);
    const ps = PLAYER_SIZE * UNIT;

    ctx.save();
    ctx.translate(px + ps / 2, py + ps / 2);
    ctx.rotate(player.rotation * Math.PI / 180);
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0'; ctx.shadowBlur = 15;
    ctx.fillRect(-ps / 2, -ps / 2, ps, ps);
    ctx.shadowBlur = 0;
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(-ps / 2 + ps * 0.55, -ps / 2 + ps * 0.2, ps * 0.12, ps * 0.2);
    ctx.fillRect(-ps / 2 + ps * 0.75, -ps / 2 + ps * 0.2, ps * 0.12, ps * 0.2);
    ctx.restore();

    // Jump shadow
    if (!player.grounded) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(px + ps / 2, GROUND_Y, ps / 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Flash overlay
  if (flash > 0) {
    ctx.fillStyle = state.flashColor || `rgba(255,255,255,${Math.min(0.5, flash)})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  // Death flash
  if (player.dead) {
    ctx.fillStyle = `rgba(255,0,0,0.3)`;
    ctx.fillRect(0, 0, cw, ch);
  }

  // Progress bar
  const barX = 20, barW = cw - 40;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(barX, 12, barW, 6);
  // Checkpoint marker
  if (state.checkpoint > 0) {
    ctx.fillStyle = 'rgba(255,255,0,0.4)';
    ctx.fillRect(barX, 12, barW * state.checkpoint, 6);
  }
  ctx.fillStyle = '#0f0';
  ctx.fillRect(barX, 12, barW * songPct, 6);

  // Attempt counter
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`Attempt ${attempts}`, cw - 20, 36);

  // Percentage
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(songPct * 100)}%`, 20, 36);

  // Checkpoint flash message
  if (state.checkpointMsgTimer > 0) {
    const a = Math.min(1, state.checkpointMsgTimer / 0.4);
    const scale = 1 + (1 - a) * 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `bold ${Math.floor(36 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0'; ctx.shadowBlur = 20;
    ctx.fillText(state.checkpointMsg, cw / 2, ch / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Win screen
  if (state.won) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#0f0'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center';
    ctx.shadowColor = '#0f0'; ctx.shadowBlur = 20;
    ctx.fillText('LEVEL COMPLETE', cw / 2, ch / 2 - 30);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace';
    ctx.fillText(`${state.attempts} attempts`, cw / 2, ch / 2 + 20);
    ctx.fillStyle = '#888'; ctx.font = '14px monospace';
    ctx.fillText('the upside down fears you now', cw / 2, ch / 2 + 55);
  }

  ctx.restore();
}

export { CW, CH, GROUND_Y };
