import type { Action } from './types';

// Discrete action space: one compact index per action, for network input and RL.
// index = (moveX + 1) * 6 + (moveY + 1) * 2 + kick
export const ACTION_COUNT = 18;

export const encodeAction = (a: Action): number => (a.moveX + 1) * 6 + (a.moveY + 1) * 2 + (a.kick ? 1 : 0);

export const decodeAction = (i: number): Action => ({
  moveX: (Math.floor(i / 6) - 1) as Action['moveX'],
  moveY: ((Math.floor(i / 2) % 3) - 1) as Action['moveY'],
  kick: i % 2 === 1,
});

export const IDLE: Action = { moveX: 0, moveY: 0, kick: false };
