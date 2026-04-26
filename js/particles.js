// Particle system
import { G } from './config.js';

let particles = [];

export function addParticles(x, y, n, upsideDown) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x: x * G + G / 2, y: y * G + G / 2,
      vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8,
      life: 1, hue: upsideDown ? Math.random() * 30 : Math.random() * 360,
      size: Math.random() * 4 + 2
    });
  }
}

export function drawParticles(ctx) {
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.life -= .03; p.vx *= .95; p.vy *= .95;
    if (p.life <= 0) return false;
    ctx.fillStyle = `hsla(${p.hue},100%,60%,${p.life})`;
    ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
    ctx.shadowBlur = 8;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.shadowBlur = 0;
    return true;
  });
}
