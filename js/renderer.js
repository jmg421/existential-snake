// Canvas renderer
import { G } from './config.js';
import { getActiveSkin } from './config.js';
import { drawParticles } from './particles.js';

export function render(ctx, state) {
  const { snake, food, demogorgonFood, mysteryFood, upsideDown, hue, screenShake, score, dir, W, H } = state;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;

  let sx = 0, sy = 0;
  if (screenShake > 0) {
    sx = (Math.random() - .5) * screenShake * 2;
    sy = (Math.random() - .5) * screenShake * 2;
  }
  ctx.save(); ctx.translate(sx, sy);

  // Background
  ctx.fillStyle = upsideDown ? `rgb(${5 + Math.sin(Date.now() / 1000) * 3},0,${15 + Math.sin(Date.now() / 1000) * 3})` : `hsl(${hue},5%,${3 + Math.sin(Date.now() / 1000)}%)`;
  ctx.fillRect(0, 0, cw, ch);

  // Upside down effects
  if (upsideDown) {
    for (let i = 0; i < 15; i++) {
      const px = (Math.sin(Date.now() / 2000 + i * 47) * 300 + 300) % cw;
      const py = (Date.now() / 20 + i * 137) % ch;
      ctx.fillStyle = `rgba(160,0,255,${.1 + Math.sin(Date.now() / 1000 + i) * .05})`;
      ctx.fillRect(px, py, 2, 2);
    }
    for (let i = 0; i < 8; i++) {
      const vx = Math.sin(Date.now() / 3000 + i * 2) * 20;
      ctx.strokeStyle = `rgba(80,0,160,${.15 + Math.sin(Date.now() / 1500 + i) * .05})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(i * 75 + vx, 0); ctx.quadraticCurveTo(i * 75 + vx + 20, 50 + Math.sin(Date.now() / 2000 + i) * 20, i * 75 + vx, 100 + Math.sin(Date.now() / 1500 + i) * 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 75 + vx, ch); ctx.quadraticCurveTo(i * 75 + vx - 20, ch - 50 + Math.sin(Date.now() / 2000 + i) * 20, i * 75 + vx, ch - 100 - Math.sin(Date.now() / 1500 + i) * 30); ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Grid
  ctx.strokeStyle = upsideDown ? 'rgba(80,0,160,0.15)' : `hsla(${hue},60%,25%,0.1)`;
  for (let x = 0; x < W; x++) { ctx.beginPath(); ctx.moveTo(x * G, 0); ctx.lineTo(x * G, ch); ctx.stroke(); }
  for (let y = 0; y < H; y++) { ctx.beginPath(); ctx.moveTo(0, y * G); ctx.lineTo(cw, y * G); ctx.stroke(); }

  // Particles
  drawParticles(ctx);

  // Snake
  const skin = getActiveSkin();
  snake.forEach((s, i) => {
    let snakeHue = upsideDown ? 270 + (i * 5) % 40 : (hue + i * 10) % 360;
    let sat = upsideDown ? 80 : 80 + Math.sin(Date.now() / 300 + i) * 20;
    let light = i === 0 ? (upsideDown ? 70 : 80) : Math.max(upsideDown ? 30 : 35, (upsideDown ? 60 : 70) - (i / snake.length) * (upsideDown ? 35 : 40));
    ctx.fillStyle = `hsl(${snakeHue},${sat}%,${light}%)`;
    ctx.shadowColor = upsideDown ? 'hsl(280,80%,50%)' : `hsl(${snakeHue},100%,50%)`; ctx.shadowBlur = i === 0 ? 20 : 8;
    const wb = score > 15 ? Math.sin(Date.now() / 200 + i) * 2 : 0;
    const wby = score > 15 ? Math.cos(Date.now() / 200 + i) * 2 : 0;
    ctx.fillRect(s.x * G + 1 + wb, s.y * G + 1 + wby, G - 2, G - 2);
    if (i === 0) {
      ctx.fillStyle = upsideDown ? '#a0f' : '#000'; ctx.shadowBlur = 0;
      const ex = dir.x * 3, ey = dir.y * 3, eyeSize = Math.min(5, 3 + score / 15);
      ctx.beginPath(); ctx.arc(s.x * G + 6 + ex + wb, s.y * G + 7 + ey + wby, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x * G + 14 + ex + wb, s.y * G + 7 + ey + wby, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = upsideDown ? '#000' : '#fff';
      ctx.beginPath(); ctx.arc(s.x * G + 6 + ex + wb - 1, s.y * G + 7 + ey + wby - 1, eyeSize * .4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x * G + 14 + ex + wb - 1, s.y * G + 7 + ey + wby - 1, eyeSize * .4, 0, Math.PI * 2); ctx.fill();
    }
    // Emoji skin overlay
    if (skin.head && i === 0) {
      ctx.shadowBlur = 0; ctx.font = `${G - 4}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(skin.head, s.x * G + G / 2 + wb, s.y * G + G - 3 + wby);
    } else if (skin.body && i > 0) {
      ctx.shadowBlur = 0; ctx.font = `${G - 6}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(skin.body, s.x * G + G / 2 + wb, s.y * G + G - 4 + wby);
    }
  });
  ctx.shadowBlur = 0;

  // Food
  const pulse = Math.sin(Date.now() / 150) * 5;
  if (mysteryFood) {
    // Rainbow shimmer mystery food
    const mh = (Date.now() / 5) % 360;
    ctx.fillStyle = `hsl(${mh},100%,70%)`; ctx.shadowColor = `hsl(${mh},100%,60%)`; ctx.shadowBlur = 25 + pulse;
    ctx.beginPath(); ctx.arc(food.x * G + G / 2, food.y * G + G / 2, G / 2 + pulse / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('?', food.x * G + G / 2, food.y * G + G / 2 + 4);
  } else if (demogorgonFood) {
    ctx.fillStyle = upsideDown ? '#f0f' : '#f8f'; ctx.shadowColor = upsideDown ? '#a0f' : '#f0f'; ctx.shadowBlur = 20 + pulse;
    for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5 + Date.now() / 500; ctx.beginPath(); ctx.arc(food.x * G + G / 2 + Math.cos(a) * (6 + pulse / 2), food.y * G + G / 2 + Math.sin(a) * (6 + pulse / 2), 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(food.x * G + G / 2, food.y * G + G / 2, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    const fh = upsideDown ? 0 : (hue + 180) % 360;
    ctx.fillStyle = `hsl(${fh},100%,65%)`; ctx.shadowColor = `hsl(${fh},100%,60%)`; ctx.shadowBlur = 20 + pulse;
    ctx.beginPath(); ctx.arc(food.x * G + G / 2, food.y * G + G / 2, G / 2 - 1 + pulse / 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Border — bright and visible
  ctx.strokeStyle = upsideDown ? `rgba(160,0,255,${.7 + Math.sin(Date.now() / 500) * .2})` : `hsl(${hue},100%,60%)`;
  ctx.lineWidth = 3; ctx.strokeRect(0, 0, cw, ch); ctx.lineWidth = 1;

  // Vignette
  const vg = ctx.createRadialGradient(cw / 2, ch / 2, 80, cw / 2, ch / 2, 350);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(${upsideDown ? '10,0,20' : '0,0,0'},${Math.min(.5, .15 + score / 60)})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);

  // Random flicker
  if (upsideDown && Math.random() < .02) { ctx.fillStyle = `rgba(160,0,255,${Math.random() * .1})`; ctx.fillRect(0, 0, cw, ch); }

  ctx.restore();
  if (score > 10) { const d = Math.sin(Date.now() / 500) * (upsideDown ? 4 : 2); state.canvas.style.transform = `skew(${d * .3}deg,${d * .2}deg)`; }
}
