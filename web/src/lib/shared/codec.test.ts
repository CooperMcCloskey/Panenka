import { describe, expect, it } from 'vitest';
import { ACTION_COUNT, decodeAction } from '$lib/engine/actions';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import type { GameState, MatchRules, Teams } from '$lib/engine/types';
import { vec } from '$lib/engine/vec';
import { decodeState, encodeState } from './codec';
import { LocalSource } from './sources';

describe('codec', () => {
  it('round-trips states in every phase exactly', () => {
    const rules: MatchRules = { kind: 'goals', target: 2 };
    const teams: Teams = { blue: 3, orange: 1 };
    let seed = 3;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    let s: GameState = createState(teams, rules);
    const seen = new Set<string>();
    const check = () => {
      seen.add(s.match.winner ? 'winner' : s.match.phase.kind);
      expect(decodeState(encodeState(s), rules, teams)).toEqual(s);
    };
    for (let goal = 0; goal < 2; goal++) {
      // Random play, then fire the ball into the right goal so every phase and a winner occur.
      for (let t = 0; t < 400; t++) {
        s = step(s, s.world.players.map(() => decodeAction(Math.floor(rnd() * ACTION_COUNT))));
        check();
      }
      s = { ...s, world: { ...s.world, ball: { pos: vec(1.6, 0.5), vel: vec(0.025, 0) } } };
      for (let t = 0; t < 400; t++) {
        s = step(s, s.world.players.map(() => decodeAction(0)));
        check();
      }
    }
    expect(seen).toEqual(new Set(['countdown', 'play', 'goal', 'winner']));
  });
});

describe('LocalSource', () => {
  it('records inputs that replay to its latest state', async () => {
    const { replay } = await import('$lib/engine/replay');
    let n = 0;
    const controller = { getAction: () => decodeAction(n++ % ACTION_COUNT) };
    const source = new LocalSource({ blue: [controller], orange: [controller] }, { kind: 'time', minutes: 1 });
    for (let i = 0; i < 200; i++) source.update(16.7);
    expect(source.recording.actions.length).toBe(source.latest.match.tick);
    expect(replay(source.recording)).toEqual(source.latest);
  });
});
