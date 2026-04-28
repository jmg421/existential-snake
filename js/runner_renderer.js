// Runner renderer — scrolling ground, lanes, player, obstacles, collectibles
import { CANVAS_W, CANVAS_H, LANE_H, PLAYER_X, PLAYER_W, PLAYER_H, laneY } from './runner.js';
import { LANE_COUNT } from './level.js';
import { drawParticles } from './particles.js';

const GROUND_TILE = 40;

// Obstacle/collectible emoji map
const SPRITES = {}; // using custom draw functions instead

function drawObstacle(ctx, x, y, w, h, subtype, elapsed, upsideDown) {
  const cx = x + w / 2, cy = y + h / 2;
  const pulse = Math.sin(elapsed / 150) * 3;

  // Red warning box
  ctx.fillStyle = `rgba(255,20,20,${0.3 + Math.sin(elapsed / 200) * 0.1})`;
  ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6); ctx.fill();
  ctx.strokeStyle = '#f33'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;

  ctx.shadowColor = '#f44'; ctx.shadowBlur = 12 + pulse;

  if (subtype === 'demogorgon') {
    // Flower-mouth shape
    ctx.fillStyle = '#e22';
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5 + elapsed / 400;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#400';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  } else if (subtype === 'vine') {
    // Pulsing red orb with tendrils
    ctx.fillStyle = '#f22';
    ctx.beginPath(); ctx.arc(cx, cy, 8 + pulse / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c00'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + elapsed / 600;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, cx + Math.cos(a + 0.5) * 12, cy + Math.sin(a + 0.5) * 14);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  } else {
    // Skull — tentacle
    ctx.fillStyle = '#ddd';
    ctx.beginPath(); ctx.arc(cx, cy - 2, 10, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 10, cy - 2, 20, 8);
    ctx.fillStyle = '#200';
    ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 3, cy + 6, 2, 3); ctx.fillRect(cx + 1, cy + 6, 2, 3);
  }
  ctx.shadowBlur = 0;
}

function drawCollectible(ctx, x, y, w, h, subtype, elapsed, hue) {
  const cx = x + w / 2, cy = y + h / 2;
  const pulse = Math.sin(elapsed / 150) * 3;
  const bob = Math.sin(elapsed / 300) * 3;

  if (subtype === 'eggo') {
    // Bright golden waffle
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18 + pulse;
    ctx.fillStyle = `rgba(255,215,0,${0.25 + Math.sin(elapsed / 200) * 0.1})`;
    ctx.beginPath(); ctx.arc(cx, cy + bob, 20 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4c430';
    ctx.beginPath(); ctx.roundRect(cx - 10, cy - 8 + bob, 20, 16, 3); ctx.fill();
    // Grid lines
    ctx.strokeStyle = '#c89b20'; ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i += 4) {
      ctx.beginPath(); ctx.moveTo(cx - 9, cy + i + bob); ctx.lineTo(cx + 9, cy + i + bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + i, cy - 7 + bob); ctx.lineTo(cx + i, cy + 7 + bob); ctx.stroke();
    }
  } else if (subtype === 'light') {
    // Bright star
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 22 + pulse;
    ctx.fillStyle = `rgba(255,255,100,${0.3 + Math.sin(elapsed / 200) * 0.1})`;
    ctx.beginPath(); ctx.arc(cx, cy + bob, 22 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe44d';
    drawStar(ctx, cx, cy + bob, 5, 12 + pulse / 2, 5);
    ctx.fillStyle = '#fff';
    drawStar(ctx, cx, cy + bob, 5, 5, 2);
  } else if (subtype === 'walkie') {
    // Shield — cyan diamond
    ctx.shadowColor = '#0ff'; ctx.shadowBlur = 20 + pulse;
    ctx.fillStyle = `rgba(0,200,255,${0.25 + Math.sin(elapsed / 200) * 0.1})`;
    ctx.beginPath(); ctx.arc(cx, cy + bob, 20 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0cf';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12 + bob); ctx.lineTo(cx + 10, cy + bob);
    ctx.lineTo(cx, cy + 12 + bob); ctx.lineTo(cx - 10, cy + bob);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  } else if (subtype === 'heart') {
    // Bright green heart — clearly good
    ctx.shadowColor = '#0f0'; ctx.shadowBlur = 22 + pulse;
    ctx.fillStyle = `rgba(0,255,100,${0.25 + Math.sin(elapsed / 200) * 0.1})`;
    ctx.beginPath(); ctx.arc(cx, cy + bob, 20 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f0';
    drawHeart(ctx, cx, cy + bob, 14);
    // Plus sign
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 2, cy - 5 + bob, 4, 10);
    ctx.fillRect(cx - 5, cy - 2 + bob, 10, 4);
  }
  ctx.shadowBlur = 0;
}

function drawStar(ctx, cx, cy, points, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI / points) - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
}

function drawHeart(ctx, cx, cy, size) {
  const s = size / 14;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 6 * s);
  ctx.bezierCurveTo(cx - 12 * s, cy - 4 * s, cx - 7 * s, cy - 12 * s, cx, cy - 5 * s);
  ctx.bezierCurveTo(cx + 7 * s, cy - 12 * s, cx + 12 * s, cy - 4 * s, cx, cy + 6 * s);
  ctx.fill();
}

export function renderRunner(ctx, state) {
  const { upsideDown, hue, screenShake, scrollSpeed, elapsed, objects, playerY, jumping, jumpT, score, combo, shield, alive, complete } = state;
  const cw = CANVAS_W, ch = CANVAS_H;

  // Screen shake
  let sx = 0, sy = 0;
  if (screenShake > 0.5) {
    sx = (Math.random() - 0.5) * screenShake * 2;
    sy = (Math.random() - 0.5) * screenShake * 2;
  }
  ctx.save();
  ctx.translate(sx, sy);

  // Background — per-level color
  const bg = state.level.bg || [3, 0, 3];
  const pulse = Math.sin(elapsed / 1000) * 3;
  if (upsideDown) {
    ctx.fillStyle = `rgb(${bg[0] + 15 + pulse},${bg[1]},${bg[2] + 15 + pulse})`;
  } else {
    ctx.fillStyle = `rgb(${bg[0] + pulse},${bg[1] + pulse},${bg[2] + pulse})`;
  }
  ctx.fillRect(0, 0, cw, ch);

  // Scrolling ground lines
  const groundOffset = (elapsed * scrollSpeed * 0.05) % GROUND_TILE;
  ctx.strokeStyle = upsideDown ? 'rgba(80,0,160,0.15)' : `hsla(${hue},60%,25%,0.1)`;
  for (let x = -groundOffset; x < cw; x += GROUND_TILE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
  }

  // Lane dividers
  ctx.setLineDash([8, 12]);
  ctx.strokeStyle = upsideDown ? 'rgba(160,0,255,0.3)' : `hsla(${hue},80%,50%,0.2)`;
  ctx.lineWidth = 2;
  for (let i = 1; i < LANE_COUNT; i++) {
    const ly = LANE_H * i + LANE_H / 2;
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(cw, ly); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  // Upside down vines
  if (upsideDown) {
    for (let i = 0; i < 6; i++) {
      const vx = ((elapsed * 0.02 + i * 100) % (cw + 40)) - 20;
      ctx.strokeStyle = `rgba(80,0,160,${0.15 + Math.sin(elapsed / 1500 + i) * 0.05})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + 15, 60 + Math.sin(elapsed / 2000 + i) * 20, vx, 120);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Particles
  drawParticles(ctx);

  // Objects (obstacles + collectibles)
  for (const obj of objects) {
    if (!obj.active) continue;
    if (obj.type === 'obstacle') {
      drawObstacle(ctx, obj.x, obj.y, obj.w, obj.h, obj.subtype, elapsed, upsideDown);
    } else {
      drawCollectible(ctx, obj.x, obj.y, obj.w, obj.h, obj.subtype, elapsed, hue);
    }
  }

  // Boss
  if (state.boss && !state.boss.defeated) {
    const b = state.boss;
    const bx = b.x, by = CANVAS_H / 2;
    const bSize = 60;
    const pulse = Math.sin(elapsed / 200) * 4;

    // Boss body
    ctx.shadowColor = b.subtype === 'vecna' ? '#f00' : '#f0f';
    ctx.shadowBlur = 20 + pulse;
    ctx.fillStyle = b.subtype === 'vecna' ? '#600' : '#404';
    ctx.beginPath(); ctx.roundRect(bx - bSize/2, by - bSize/2 + pulse, bSize, bSize, 12); ctx.fill();

    // Boss face
    ctx.shadowBlur = 0;
    ctx.fillStyle = b.subtype === 'vecna' ? '#f44' : '#f0f';
    ctx.beginPath(); ctx.arc(bx - 12, by - 8 + pulse, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 12, by - 8 + pulse, 6, 0, Math.PI * 2); ctx.fill();
    // Angry mouth
    ctx.strokeStyle = b.subtype === 'vecna' ? '#f44' : '#f0f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 15, by + 12 + pulse);
    ctx.lineTo(bx - 8, by + 8 + pulse);
    ctx.lineTo(bx, by + 14 + pulse);
    ctx.lineTo(bx + 8, by + 8 + pulse);
    ctx.lineTo(bx + 15, by + 12 + pulse);
    ctx.stroke();
    ctx.lineWidth = 1;

    // HP bar
    const hpW = 50, hpH = 6;
    ctx.fillStyle = '#400';
    ctx.fillRect(bx - hpW/2, by - bSize/2 - 14, hpW, hpH);
    ctx.fillStyle = '#f44';
    ctx.fillRect(bx - hpW/2, by - bSize/2 - 14, hpW * (b.hp / b.maxHp), hpH);

    // Boss label
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(b.subtype === 'vecna' ? 'VECNA' : 'DEMOGORGON', bx, by - bSize/2 - 18);
    ctx.fillText('JUMP TO ATTACK!', bx, by + bSize/2 + 16);
  }

  const jumpDur = state.jumpDuration || 400;
  const jumpOffset = jumping ? -Math.sin(jumpT / jumpDur * Math.PI) * 50 : 0;
  const px = PLAYER_X, py = playerY + jumpOffset;
  const bigHead = state.mutators && state.mutators.has('bighead');
  const pw = bigHead ? PLAYER_W * 1.8 : PLAYER_W;
  const ph = bigHead ? PLAYER_H * 1.8 : PLAYER_H;
  const pxAdj = bigHead ? px - (pw - PLAYER_W) / 2 : px;
  const pyAdj = bigHead ? py - (ph - PLAYER_H) / 2 : py;

  // Rainbow trail
  if (state.mutators && state.mutators.has('rainbow') && state.started && state.alive) {
    const trailHue = (elapsed / 3) % 360;
    ctx.fillStyle = `hsla(${trailHue},100%,60%,0.3)`;
    ctx.beginPath(); ctx.roundRect(pxAdj - 20, pyAdj + 4, 18, ph - 8, 4); ctx.fill();
    ctx.fillStyle = `hsla(${(trailHue + 40) % 360},100%,60%,0.2)`;
    ctx.beginPath(); ctx.roundRect(pxAdj - 38, pyAdj + 8, 16, ph - 16, 4); ctx.fill();
  }

  // Skip drawing player every other frame when invincible (flash effect)
  const showPlayer = !state.invincible || Math.floor(elapsed / 80) % 2 === 0;

  if (showPlayer) {
    // Player glow
    const playerHue = state.skinHue !== undefined ? state.skinHue : (upsideDown ? 280 : (hue + 60) % 360);
    ctx.shadowColor = `hsl(${playerHue},100%,60%)`;
    ctx.shadowBlur = shield ? 25 : 15;

    // Player body
    ctx.fillStyle = `hsl(${playerHue},80%,${upsideDown ? 60 : 70}%)`;
    ctx.beginPath();
    ctx.roundRect(pxAdj, pyAdj, pw, ph, 8);
    ctx.fill();

    // Player face
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    const faceScale = bigHead ? 1.8 : 1;
    ctx.beginPath(); ctx.arc(pxAdj + 12 * faceScale, pyAdj + 14 * faceScale, 4 * faceScale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(pxAdj + 24 * faceScale, pyAdj + 14 * faceScale, 4 * faceScale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(pxAdj + 18 * faceScale, pyAdj + 24 * faceScale, 6 * faceScale, 0, Math.PI);
    ctx.stroke();

    // Shield indicator
    if (shield) {
      ctx.strokeStyle = `hsla(180,100%,70%,${0.5 + Math.sin(elapsed / 100) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pxAdj + pw / 2, pyAdj + ph / 2, pw * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  // Jump shadow on ground
  if (jumping) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(px + PLAYER_W / 2, laneY(state.targetLane) + PLAYER_H, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = upsideDown ? `rgba(160,0,255,${0.7 + Math.sin(elapsed / 500) * 0.2})` : `hsl(${hue},100%,60%)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, cw, ch);
  ctx.lineWidth = 1;

  // Vignette
  const vg = ctx.createRadialGradient(cw / 2, ch / 2, 80, cw / 2, ch / 2, 350);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(${upsideDown ? '10,0,20' : '0,0,0'},0.2)`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, ch);

  // HUD — score + combo top-left
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`AURA: ${score}`, 10, 10);
  ctx.fillStyle = '#888'; ctx.font = '12px monospace';
  ctx.fillText(state.level.name, 10, 30);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
  ctx.fillText(`${'❤️'.repeat(state.lives)}${'🖤'.repeat(state.maxLives - state.lives)}`, 10, 50);
  if (combo > 1) {
    ctx.fillStyle = `hsl(${(hue + combo * 30) % 360},100%,70%)`;
    ctx.fillText(`${combo}x COMBO`, 10, 70);
  }

  // Progress bar
  const pct = Math.min(1, state.elapsed / state.duration);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(cw - 160, 10, 150, 8);
  ctx.fillStyle = upsideDown ? '#a0f' : `hsl(${hue},100%,60%)`;
  ctx.fillRect(cw - 160, 10, 150 * pct, 8);

  // Death flash
  if (!alive) {
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.fillRect(0, 0, cw, ch);
  }

  // Level complete flash
  if (complete) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.sin(elapsed / 200) * 0.05})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  ctx.restore();
}
