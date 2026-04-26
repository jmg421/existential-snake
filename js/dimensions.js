import { state } from './snake.js';
import { beep } from './audio.js';
import { popEmoji, popText, showSTCharacter } from './ui.js';

export function flipDimension(canvas) {
  state.upsideDown = !state.upsideDown;
  state.screenShake = 15;
  if (state.upsideDown) {
    beep(80, .5, 'sawtooth'); setTimeout(() => beep(60, .5, 'sawtooth'), 200);
    canvas.style.filter = 'saturate(0.5) brightness(0.7)';
    document.getElementById('dimension').textContent = '⬡ THE UPSIDE DOWN ⬡';
    document.getElementById('dimension').style.color = '#f44';
    document.getElementById('vecna').style.opacity = '0.06';
    document.body.style.background = '#0a0000';
    popEmoji(4); popText(); showSTCharacter();
  } else {
    beep(523, .15); setTimeout(() => beep(659, .15), 100);
    canvas.style.filter = '';
    document.getElementById('dimension').textContent = 'THE RIGHT-SIDE UP';
    document.getElementById('dimension').style.color = '#c44';
    document.getElementById('vecna').style.opacity = '0';
    document.body.style.background = '#0a0a0a';
    showSTCharacter();
  }
  document.getElementById('score').textContent = 'aura: ' + state.score + ' | dimension: ' + (state.upsideDown ? 'upside down 🕷️' : 'right-side up 🔴');
}
