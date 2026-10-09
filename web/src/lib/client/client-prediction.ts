import { MAX_FRAME_MS, TICK_MS } from '$lib/engine/constants';
import { physicsStep } from '$lib/engine/physics';
import type { GameState, World } from '$lib/engine/types';
import { vec, type Vec2 } from '$lib/engine/vec';
import { InputBuffer } from '$lib/shared/input-buffer';
import type { ClientAction, SnapshotNetwork } from '$lib/shared/protocol';
import { guardContacts } from './contact-guard';
import { snapshotWasReset } from './snapshot-reset';

export type PredictionSettings = {
  maxPredictionMs: number;
  correctionHalfLifeMs: number;
  snapDistance: number;
  maxInputChanges: number;
};

export const PREDICTION_SETTINGS: Readonly<PredictionSettings> = {
  maxPredictionMs: 250,
  correctionHalfLifeMs: 40,
  snapDistance: 0.12,
  maxInputChanges: 256,
};

type InputChange = { revision: number; tick: number; atMs: number; actions: ClientAction };

const sameActions = (a: ClientAction, b: ClientAction) => {
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length && ids.every(id =>
    b[id] && a[id].moveX === b[id].moveX && a[id].moveY === b[id].moveY && a[id].kick === b[id].kick);
};
const bodies = (world: World) => [...world.players, world.ball];

// All dynamic bodies roll back and replay together through the shared physics.
// Never feed visual smoothing or interpolated positions into the simulation.
export class ClientPrediction {
  private settings: PredictionSettings;
  private base?: { state: GameState; network: SnapshotNetwork; ids: readonly string[] };
  private changes: InputChange[] = [];
  private sent: { sequence: number; revision: number }[] = [];
  private held: ClientAction = {};
  private revision = 0;
  private shownRevision = 0;
  private offsets: Vec2[] = [];
  private lastDrawMs?: number;
  private targetTick = 0;
  private error = 0;
  private reconciliations = 0;
  private localResponseMs?: number;
  private overflow = false;

  constructor(options: Partial<PredictionSettings> = {}) {
    this.settings = { ...PREDICTION_SETTINGS, ...options };
  }

  get diagnostics() {
    return {
      predictionActive: !!this.base && !this.overflow,
      predictedTick: this.targetTick,
      predictionLeadMs: this.base ? Math.max(0, this.targetTick - this.base.state.match.tick) * TICK_MS : 0,
      predictionError: this.error,
      reconciliations: this.reconciliations,
      pendingInputChanges: this.changes.length,
      localResponseMs: this.localResponseMs,
    };
  }

  input(actions: ClientAction, nowMs: number, estimatedTick: number, force = false) {
    if (!force && sameActions(this.held, actions)) return;
    this.held = Object.fromEntries(Object.entries(actions).map(([id, action]) => [id, { ...action }]));
    this.changes.push({ revision: ++this.revision,
      tick: Math.max(this.changes.at(-1)?.tick ?? 0, Math.ceil(estimatedTick)),
      atMs: force ? this.changes.at(-1)?.atMs ?? nowMs : nowMs, actions: this.held });
    if (this.changes.length > this.settings.maxInputChanges) {
      // Stop guessing during sustained congestion; keep only the latest held keys.
      this.changes = this.changes.slice(-this.settings.maxInputChanges);
      this.overflow = true;
    }
  }

  inputSent(sequence: number) {
    this.sent.push({ sequence, revision: this.revision });
    if (this.sent.length > this.settings.maxInputChanges) this.sent.shift();
  }

  push(state: GameState, network: SnapshotNetwork | undefined, ids: readonly string[], nowMs: number, estimatedTick: number) {
    if (this.base && state.match.tick <= this.base.state.match.tick) return;
    if (!network || network.heldActions.length !== state.world.players.length
      || ids.length !== state.world.players.length || !Object.keys(this.held).length) {
      this.base = undefined;
      return;
    }
    const hadBase = !!this.base;
    const reset = !this.base || snapshotWasReset(this.base.state, state)
      || (state.match.tick - this.base.state.match.tick) * TICK_MS > MAX_FRAME_MS;
    const tick = this.limitTick(state, Math.max(this.targetTick, estimatedTick));
    const before = !reset && !this.overflow ? this.replay(tick) : undefined;
    if (network.inputAck) {
      const acknowledged = this.sent.filter(input => input.sequence <= network.inputAck!.sequence).at(-1);
      if (acknowledged) this.changes = this.changes.filter(change => change.revision > acknowledged.revision);
      this.sent = this.sent.filter(input => input.sequence > network.inputAck!.sequence);
      if (!this.changes.length) this.overflow = false;
    }
    this.base = { state, network, ids: [...ids] };
    this.targetTick = tick;
    if (reset) {
      this.offsets = [];
      // A kickoff must forget old presses, but keys still held continue afterward.
      if (hadBase) {
        this.changes = [{ revision: ++this.revision, tick: state.match.tick + 1, atMs: nowMs, actions: this.held }];
        this.sent = [];
      }
      this.overflow = false;
    }
    const after = this.replay(tick);
    if (before && after) {
      const previous = bodies(before), next = bodies(after);
      this.error = Math.max(...next.map((body, i) => body.pos.sub(previous[i].pos).length()));
      this.reconciliations++;
      this.decayOffsets(nowMs);
      this.offsets = this.error > this.settings.snapDistance ? [] : next.map((body, i) =>
        previous[i].pos.add(this.offsets[i] ?? vec(0, 0)).sub(body.pos));
    }
    this.lastDrawMs = nowMs;
  }

  sample(nowMs: number, estimatedTick: number): GameState | undefined {
    if (!this.base || this.overflow) return;
    // Long outages have a bounded prediction horizon, then hold the whole world.
    this.targetTick = this.limitTick(this.base.state, Math.max(this.targetTick, estimatedTick));
    const raw = this.replay(this.targetTick)!;
    this.decayOffsets(nowMs);
    if (this.base.state.match.phase.kind !== 'countdown') {
      for (const change of this.changes) {
        if (change.revision <= this.shownRevision || Math.max(this.base.state.match.tick + 1, change.tick) > Math.ceil(this.targetTick)) continue;
        this.shownRevision = change.revision;
        this.localResponseMs = Math.max(0, nowMs - change.atMs);
      }
    }
    const shifted = bodies(raw).map((body, i) => ({ ...body, pos: body.pos.add(this.offsets[i] ?? vec(0, 0)) }));
    return { ...this.base.state, world: guardContacts({
      players: shifted.slice(0, -1) as World['players'], ball: shifted.at(-1)!,
    }) };
  }

  private limitTick(state: GameState, tick: number): number {
    const phase = state.match.phase;
    // Goals, countdowns and kickoffs are decided by the server, never prediction.
    const horizon = phase.kind === 'countdown' ? 0 : phase.kind === 'goal'
      ? Math.min(phase.ticksLeft - 1, this.settings.maxPredictionMs / TICK_MS)
      : this.settings.maxPredictionMs / TICK_MS;
    return Math.max(state.match.tick, Math.min(tick, state.match.tick + Math.max(0, horizon)));
  }

  private replay(target: number): World | undefined {
    if (!this.base) return;
    const { state, network, ids } = this.base;
    target = this.limitTick(state, target);
    const inputs = new InputBuffer();
    // Seed held keys without turning an already-consumed remote tap into a new one.
    ids.forEach((id, i) => inputs.set(id, network.heldActions[i]));
    let world = state.world, previous = world, changeIndex = 0;
    for (let tick = state.match.tick + 1; tick <= Math.ceil(target); tick++) {
      while (changeIndex < this.changes.length && Math.max(state.match.tick + 1, this.changes[changeIndex].tick) <= tick) {
        for (const [id, action] of Object.entries(this.changes[changeIndex++].actions)) inputs.set(id, action);
      }
      previous = world;
      world = physicsStep(world, inputs.take(ids));
    }
    const fraction = target - Math.floor(target);
    if (!fraction) return world;
    return {
      players: world.players.map((player, i) => ({ ...player, pos: previous.players[i].pos.lerp(player.pos, fraction) })),
      ball: { ...world.ball, pos: previous.ball.pos.lerp(world.ball.pos, fraction) },
    };
  }

  private decayOffsets(nowMs: number) {
    const elapsed = Math.max(0, nowMs - (this.lastDrawMs ?? nowMs));
    const decay = Math.pow(0.5, elapsed / this.settings.correctionHalfLifeMs);
    this.offsets = this.offsets.map(offset => offset.scale(decay));
    this.lastDrawMs = nowMs;
  }

  clear() {
    this.base = undefined;
    this.changes = [];
    this.sent = [];
    this.held = {};
    this.offsets = [];
    this.lastDrawMs = undefined;
    this.revision = this.shownRevision = this.targetTick = this.error = this.reconciliations = 0;
    this.localResponseMs = undefined;
    this.overflow = false;
  }
}
