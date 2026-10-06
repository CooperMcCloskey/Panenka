import type { Action, MatchRules, Team } from '$lib/engine/types';
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
  // Record of playerID and action. One entry per player connected to client
  action: Record<string, Action>,

  // Queue of records of playerID and actions
  queue: Record<string, Action[]>,
  seq: number, //the number of actions sent (used to drop old updates)
  recieved: number, //ms since last message arrived
}

export type PlayerInput = {
  action: Action;
  queue: Action[];
  seq: number;
  received: number;
};

export type LobbyState = {
  rev: number,
  rules: MatchRules,  
  players: LobbyPlayers,
  // Record of clientID and client username
  spectators: Record<string, string>,
}

export type ClientMessage =
  | { type: 'join', code: string, token: string }
  | { type: 'start' , lobbyState: LobbyState }
  | { type: 'input', seq: number, actions: Record<string, Action>}
  | { type: 'setLobby', lobbyState: LobbyState }

export type ServerMessage =
  | {
      type: 'lobby';
      lobbyState: LobbyState;
      controlledPlayerIds: string[]; // the player IDs this client controls
      start: boolean;
    }
  | { type: 'snapshot', state: number[] }
  | { type: 'error', message: string }

export function isInput(value: unknown): value is Extract<ClientMessage, { type: 'input' }> {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  const a = m.action as Action | undefined;
  return m.type === 'input' && Number.isSafeInteger(m.seq) && (m.seq as number) >= 0
    && !!a && [-1, 0, 1].includes(a.moveX) && [-1, 0, 1].includes(a.moveY)
    && typeof a.kick === 'boolean';
}

