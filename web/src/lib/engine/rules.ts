import { BALL_RADIUS, PITCH_LEFT, PITCH_RIGHT, TICK_RATE } from './constants';
import { GOAL_BOTTOM, GOAL_TOP } from './stadium';
import type { Body, Match, MatchRules, Team } from './types';

export const DEFAULT_MINUTES = 5;
export const MAX_MINUTES = 60;
export const DEFAULT_GOAL_TARGET = 3;
export const MAX_GOAL_TARGET = 99;

export const GOAL_PAUSE_TICKS = 1 * TICK_RATE;
export const KICKOFF_COUNTDOWN_TICKS = 3 * TICK_RATE;

export const clampInt = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

// Missing or empty → NaN (falls back to the default) rather than Number(null) = 0.
const numberParam = (params: URLSearchParams, key: string) => {
  const raw = params.get(key)?.trim();
  return raw ? Number(raw) : NaN;
};

export function rulesFromParams(params: URLSearchParams): MatchRules {
  if (params.get('mode') === 'goals') {
    return { kind: 'goals', target: clampInt(numberParam(params, 'goals'), 1, MAX_GOAL_TARGET, DEFAULT_GOAL_TARGET) };
  }
  return { kind: 'time', minutes: clampInt(numberParam(params, 'minutes'), 1, MAX_MINUTES, DEFAULT_MINUTES) };
}

export function rulesToParams(rules: MatchRules): URLSearchParams {
  return rules.kind === 'goals'
    ? new URLSearchParams({ mode: 'goals', goals: String(rules.target) })
    : new URLSearchParams({ mode: 'time', minutes: String(rules.minutes) });
}

// null for a goal-target match.
export function ticksRemaining(match: Match): number | null {
  if (match.rules.kind !== 'time') return null;
  return Math.max(0, match.rules.minutes * 60 * TICK_RATE - match.clock);
}

// A goal counts once the whole ball is over the line.
export function goalScoredBy(ball: Body): Team | null {
  if (ball.pos.y <= GOAL_TOP || ball.pos.y >= GOAL_BOTTOM) return null;
  if (ball.pos.x < PITCH_LEFT - BALL_RADIUS) return 'orange';
  if (ball.pos.x > PITCH_RIGHT + BALL_RADIUS) return 'blue';
  return null;
}

export function checkWinner(match: Match): Team | 'draw' | null {
  const { score, rules } = match;
  if (rules.kind === 'goals') {
    if (score.blue >= rules.target) return 'blue';
    if (score.orange >= rules.target) return 'orange';
    return null;
  }
  if (ticksRemaining(match)! > 0) return null;
  return score.blue > score.orange ? 'blue' : score.orange > score.blue ? 'orange' : 'draw';
}
