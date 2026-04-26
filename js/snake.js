import { W, H } from './config.js';

export const state = {
  snake: [{ x: 15, y: 10 }],
  dir: { x: 0, y: 0 },
  food: null,
  score: 0,
  alive: true,
  started: false,
  tick: null,
  hue: 0,
  screenShake: 0,
  combo: 0,
  comboTimer: 0,
  speedMs: 120,
  upsideDown: false,
  demogorgonFood: false,
  lightEls: [],
  lightPattern: 0,
};

export function moveSnake() {
  const head = { x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y };
  if (head.x < 0 || head.x >= W || head.y < 0 || head.y >= H || state.snake.some(s => s.x === head.x && s.y === head.y)) {
    return null; // collision
  }
  state.snake.unshift(head);
  return head;
}

export function removeTail() {
  state.snake.pop();
}
