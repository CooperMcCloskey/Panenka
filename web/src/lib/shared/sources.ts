import { encodeAction } from '$lib/engine/actions';
import { MAX_FRAME_MS, TICK_MS } from '$lib/engine/constants';
import type { Recording } from '$lib/engine/replay';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import type { Body, GameState, MatchRules } from '$lib/engine/types';
import type { Controller } from './controller';

// Where a match's state comes from: simulated locally, or (later) received from the server.
export interface StateSource {
  start(): void;
  stop(): void;
  update(dtMs: number): void;
  currentState(): GameState; // for drawing
}

// Runs the simulation locally at a fixed tick rate.
export class LocalSource implements StateSource {
  private prev: GameState;
  private state: GameState;
  private acc = 0; // ms of real time not yet simulated
  readonly recording: Recording;

  constructor(private controllers: Controller[], rules: MatchRules) {
    this.state = createState(controllers.length, rules);
    this.prev = this.state;
    this.recording = { rules, playerCount: controllers.length, actions: [] };
  }

  get latest(): GameState {
    return this.state;
  }

  start() { this.controllers.forEach((c) => c.attach?.()) }
  stop() { this.controllers.forEach((c) => c.detach?.()) }

  update(dtMs: number) {
    this.acc += Math.min(dtMs, MAX_FRAME_MS);
    while (this.acc >= TICK_MS) {
      const actions = this.controllers.map((c, i) => c.getAction(this.state, i));
      this.recording.actions.push(actions.map(encodeAction));
      this.prev = this.state;
      this.state = step(this.state, actions);
      this.acc -= TICK_MS;
    }
  }

  // Blends the last two ticks for smooth drawing; never feed this back into step().
  currentState(): GameState {
    const t = this.acc / TICK_MS;
    const lerp = <T extends Body>(a: T, b: T): T => ({ ...b, pos: a.pos.lerp(b.pos, t) });
    const { world } = this.state;
    const prev = this.prev.world;
    return {
      ...this.state,
      world: { ball: lerp(prev.ball, world.ball), players: world.players.map((p, i) => lerp(prev.players[i], p)) },
    };
  }
}
