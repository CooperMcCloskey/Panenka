import type { MatchRules, Team, Action } from '$lib/engine/types';
import { WebSocket } from "ws";

export type LobbyPlayer = {username: string, team: Team}

export type Client = {
  token: string,
  socket?: WebSocket,
  playerIDs: string[],
  username: string,
}

export type LobbyPlayers = Record<string, LobbyPlayer>

export type ClientAction = {
  actions: Record<string, Action>,
  queue: Record<string, Action[]>, 
}

export type LobbyState = {
  rev: number,
  rules: MatchRules,  
  players: LobbyPlayers,
  started: boolean
}

export type ClientMessage =
  | { type: 'join', code: string, token: string }
  | { type: 'start' , lobbyState: LobbyState }
  | { type: 'input', action: ClientAction}
  | { type: 'addPlayer', player: LobbyPlayer, rev: number }

export type ServerMessage =
  | {
      type: 'lobby';
      lobbyState: LobbyState;
      controlledPlayerIds: string[]; // the player IDs this client controls
    }
  | { type: 'snapshot', state: number[] }
  | { type: 'error', message: string }

export function isLegalInputMessage(value: unknown): value is Extract<ClientMessage, { type: 'input' }> {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  const a = m.action as PlayerAction | undefined;
  return m.type === 'input' && Number.isSafeInteger(m.seq) && (m.seq as number) >= 0
    && !!a && [-1, 0, 1].includes(a.moveX) && [-1, 0, 1].includes(a.moveY)
    && typeof a.kick === 'boolean';
}

