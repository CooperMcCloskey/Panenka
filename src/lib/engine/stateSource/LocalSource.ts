import { MAX_FRAME_MS, TICK_MS } from '../constants';
import { interpolateState } from '../interpolate';
import { createState, step } from '../step';
import type { Controller, GameState } from '../types';
import type { StateSource } from './StateSource';

export class LocalSource implements StateSource {
  private prev: GameState;
  private state: GameState;
  private acc = 0; // real time (ms)

  constructor(private controllers: Controller[]) {
    this.state = createState(controllers.length);
    this.prev = this.state;
  }

  start() {
    this.controllers.forEach((c) => c.attach?.());
  }

  stop() {
    this.controllers.forEach((c) => c.detach?.());
  }

  update(dtMs: number) {
    this.acc += Math.min(dtMs, MAX_FRAME_MS);

    while (this.acc >= TICK_MS) {
      const actions = this.controllers.map((c, i) => c.getAction(this.state, i));
      this.prev = this.state;
      this.state = step(this.state, actions);
      this.acc -= TICK_MS;
    }
  }

  currentState(): GameState {
    const alpha = this.acc / TICK_MS; 
    return interpolateState(this.prev, this.state, alpha);
  }
}
