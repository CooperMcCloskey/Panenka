import { describe, expect, it } from 'vitest';
import { ACTION_COUNT, decodeAction, encodeAction } from './actions';
import { canKick, playerMass } from './physics';
import { replay } from './replay';
import { createState } from './state';
import { step } from './step';
import type { Action, GameState, MatchRules } from './types';

// A scripted match (players chase the ball and kick, with some randomness from a fixed seed)
// reduced to one hash. Any change to the physics or match flow changes it; update the
// expected value only when that change is intended.
function fingerprint(): number {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const dirs = [-1, 0, 1] as const;

  const run = (rules: MatchRules, ticks: number) => {
    let s = createState(4, rules);
    let acts: Action[] = s.world.players.map(() => ({ moveX: 0, moveY: 0, kick: false }));
    const trace: unknown[] = [];
    for (let i = 0; i < ticks; i++) {
      const { ball, players } = s.world;
      if (i % 12 === 0) {
        acts = players.map((p) => {
          if (rnd() < 0.6) {
            const dx = ball.pos.x - p.pos.x, dy = ball.pos.y - p.pos.y;
            return { moveX: Math.sign(Math.round(dx * 20)), moveY: Math.sign(Math.round(dy * 20)), kick: rnd() < 0.5 } as Action;
          }
          return { moveX: dirs[Math.floor(rnd() * 3)], moveY: dirs[Math.floor(rnd() * 3)], kick: rnd() < 0.3 };
        });
      }
      s = step(s, acts);
      const { world: w, match: m } = s;
      if (i % 250 === 0) {
        trace.push([m.tick, m.clock, m.phase.kind, m.score.blue, m.score.orange, w.ball.pos.x.toFixed(9), w.ball.pos.y.toFixed(9),
          w.players.map((p) => p.pos.x.toFixed(9) + p.kickCooldown + playerMass(p.kickHeld) + canKick(p) + p.kickUsed).join()]);
      }
    }
    const { world: w, match: m } = s;
    const next = step(s, acts).world;
    return {
      final: [m.tick, m.clock, JSON.stringify(m.phase), JSON.stringify(m.score), m.winner, w.ball.pos.x.toFixed(12), w.ball.vel.y.toFixed(12)],
      interp: w.ball.pos.lerp(next.ball.pos, 0.37).x.toFixed(12),
      trace,
    };
  };

  const str = JSON.stringify({
    goals: run({ kind: 'goals', target: 5 }, 20000),
    time: run({ kind: 'time', minutes: 1 }, 6000),
    goals2v1: run({ kind: 'goals', target: 2 }, 8000),
  });
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

describe('engine', () => {
  it('matches the recorded fingerprint', () => {
    expect(fingerprint()).toBe(346816436);
  });

  it('encodes every action to a unique index and back', () => {
    const seen = new Set<number>();
    for (let i = 0; i < ACTION_COUNT; i++) {
      const a = decodeAction(i);
      expect(encodeAction(a)).toBe(i);
      seen.add(a.moveX * 100 + a.moveY * 10 + +a.kick);
    }
    expect(seen.size).toBe(ACTION_COUNT);
  });

  it('replays a recording to the same state', () => {
    const rules: MatchRules = { kind: 'goals', target: 2 };
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const actions: number[][] = [];
    let s: GameState = createState(2, rules);
    for (let t = 0; t < 3000; t++) {
      const tick = [0, 1].map(() => Math.floor(rnd() * ACTION_COUNT));
      actions.push(tick);
      s = step(s, tick.map(decodeAction));
    }
    expect(replay({ rules, playerCount: 2, actions })).toEqual(s);
  });
});
