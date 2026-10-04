import type { Action } from '$lib/engine/types';

export type ClientMessage =
  | { type: 'join'; code: string; token: string }
  | { type: 'start' }
  | { type: 'input'; seq: number; action: Action };
export type ServerMessage =
  | { type: 'lobby'; usernames: string[]; connected: boolean[]; playerIndex: number; active: boolean }
  | { type: 'snapshot'; state: number[] }
  | { type: 'error'; message: string };

export function isInput(value: unknown): value is Extract<ClientMessage, { type: 'input' }> {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  const a = m.action as Action | undefined;
  return m.type === 'input' && Number.isSafeInteger(m.seq) && (m.seq as number) >= 0
    && !!a && [-1, 0, 1].includes(a.moveX) && [-1, 0, 1].includes(a.moveY)
    && typeof a.kick === 'boolean';
}
