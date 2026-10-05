import type { Action, MatchRules, Team, Teams } from '$lib/engine/types';
import { WebSocket } from "ws";

export type MatchInfo = { rules: MatchRules, teams: Teams; order: string[] };

export type LobbyState = {
  rev: number;
  rules: MatchRules;
  players: LobbyPlayer[];
  match: MatchInfo | null;
};

export type ClientMessage =
  | { type: 'join'; code: string; token: string }
  | { type: 'start' }
  | { type: 'input'; seq: number; action: Action }
  | { type: 'setTeam'; playerID: string; team: Team }
  | { type: 'setRules'; rules: MatchRules };

export type ServerMessage =
  | { type: 'lobby'; usernames: string[]; connected: boolean[]; active: boolean }
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

// Defininf types
export type Client = {
  token: string;
  socket?: WebSocket;
  playerIDs: string[];
}

export type LobbyPlayer = {
  username: string;
  action: Action;
  queue: Action[];
  seq: number;
  received: number;
  team: Team;
}