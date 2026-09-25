import { MAX_FRAME_MS, TICK_MS } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import type { Action, GameState, MatchRules, RigidBody } from '$lib/engine/types';

export interface Controller {
  getAction(state: GameState, playerIndex: number): Action;
  attach?(): void;
  detach?(): void;
}

export interface StateSource {
  start(): void;
  stop(): void;
  update(dtMs: number): void;
  currentState(): GameState;
}

export class LocalSource implements StateSource {
  private prev: GameState;
  private state: GameState;
  private acc = 0; // ms of real time not yet simulated

  constructor(private controllers: Controller[], rules: MatchRules) {
    this.state = createState(controllers.length, rules);
    this.prev = this.state;
  }

  start() { this.controllers.forEach((c) => c.attach?.()) }
  stop() { this.controllers.forEach((c) => c.detach?.()) }

  update(dtMs: number) {
    this.acc += Math.min(dtMs, MAX_FRAME_MS);
    while (this.acc >= TICK_MS) {
      const actions = this.controllers.map((c, i) => c.getAction(this.state, i));
      this.prev = this.state;
      this.state = step(this.state, actions);
      this.acc -= TICK_MS;
    }
  }

  // Blends the last two ticks for smooth drawing; purely for rendering, do not feed anywhere else.
  currentState(): GameState {
    const t = this.acc / TICK_MS;
    const lerp = <T extends RigidBody>(a: T, b: T): T => ({ ...b, pos: a.pos.lerp(b.pos, t) });
    return {
      ...this.state,
      ball: lerp(this.prev.ball, this.state.ball),
      players: this.state.players.map((p, i) => lerp(this.prev.players[i], p)),
    };
  }
}
