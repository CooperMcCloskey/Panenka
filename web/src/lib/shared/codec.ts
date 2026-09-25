import type { GameState, MatchRules, Phase, Player, Team } from '$lib/engine/types';
import { vec } from '$lib/engine/vec';

// Packs a game state into a Float64Array, e.g. for network snapshots (Float64 so decoding is exact).
// Layout: 8 match values, 4 ball values, then 7 values per player. Rules aren't included: they don't change during a match.

const MATCH = 8;
const BALL = 4;
const PLAYER = 7;

const TEAMS: Team[] = ['blue', 'orange'];
const PHASES: Phase['kind'][] = ['play', 'goal', 'countdown'];
const WINNERS: GameState['match']['winner'][] = [null, 'blue', 'orange', 'draw'];

export function encodeState({ world, match }: GameState): Float64Array {
  const out = new Float64Array(MATCH + BALL + PLAYER * world.players.length);
  const { phase } = match;
  out.set([
    match.tick,
    match.clock,
    PHASES.indexOf(phase.kind),
    phase.kind === 'play' ? 0 : phase.ticksLeft,
    phase.kind === 'goal' ? TEAMS.indexOf(phase.scorer) : 0,
    match.score.blue,
    match.score.orange,
    WINNERS.indexOf(match.winner),
  ]);
  const { ball } = world;
  out.set([ball.pos.x, ball.pos.y, ball.vel.x, ball.vel.y], MATCH);
  world.players.forEach((p, i) => {
    out.set(
      [p.pos.x, p.pos.y, p.vel.x, p.vel.y, +p.kickHeld, +p.kickUsed, p.kickCooldown],
      MATCH + BALL + PLAYER * i,
    );
  });
  return out;
}

export function decodeState(data: Float64Array, rules: MatchRules): GameState {
  const [tick, clock, phaseKind, ticksLeft, scorer, blue, orange, winner] = data;
  const kind = PHASES[phaseKind];
  const phase: Phase =
    kind === 'play' ? { kind } : kind === 'goal' ? { kind, scorer: TEAMS[scorer], ticksLeft } : { kind, ticksLeft };

  const b = MATCH;
  const players: Player[] = [];
  for (let o = MATCH + BALL; o < data.length; o += PLAYER) {
    players.push({
      pos: vec(data[o], data[o + 1]),
      vel: vec(data[o + 2], data[o + 3]),
      kickHeld: data[o + 4] === 1,
      kickUsed: data[o + 5] === 1,
      kickCooldown: data[o + 6],
    });
  }

  return {
    world: { ball: { pos: vec(data[b], data[b + 1]), vel: vec(data[b + 2], data[b + 3]) }, players },
    match: { tick, clock, phase, score: { orange, blue }, rules, winner: WINNERS[winner] },
  };
}
