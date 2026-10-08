// Limits checked in the browser for feedback and on the server for enforcement.
// Kept apart from protocol.ts, which imports server-only modules.
import { MAX_GOAL_TARGET, MAX_MINUTES } from '$lib/engine/rules';
import type { MatchRules } from '$lib/engine/types';

export const MAX_USERNAME_LENGTH = 20;
export const MAX_LOCAL_PLAYERS = 2; // one per side of the keyboard

// 1–20 characters, at least one of them not whitespace
export const isValidUsername = (name: unknown): name is string =>
  typeof name === 'string' && name.trim().length > 0 && name.length <= MAX_USERNAME_LENGTH;

const inRange = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= max;

// A 1–60 minute game or first to 1–99 goals
export const isValidRules = (rules: unknown): rules is MatchRules => {
  const r = rules as Partial<Record<string, unknown>> | null;
  if (r?.kind === 'time') return inRange(r.minutes, MAX_MINUTES);
  if (r?.kind === 'goals') return inRange(r.target, MAX_GOAL_TARGET);
  return false;
};
