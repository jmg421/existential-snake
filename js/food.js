import { W, H } from './config.js';
import { state } from './snake.js';

export function spawn() {
  do {
    state.food = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };
  } while (state.snake.some(s => s.x === state.food.x && s.y === state.food.y));
  state.demogorgonFood = Math.random() < .3 && state.score > 3;
}
