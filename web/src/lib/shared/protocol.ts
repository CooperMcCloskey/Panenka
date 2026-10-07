import { type MatchRules, type Team, type Action, DEFAULT_MATCH_RULES } from '$lib/engine/types';
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
  playerMapping: string[],
  started: boolean,
}

export const NEW_LOBBY_STATE: LobbyState = {
  rev: 0, 
  rules: DEFAULT_MATCH_RULES, 
  players: {}, 
  playerMapping: [],
  started: false
};

export type ClientMessage =
  | { type: 'join', code: string, token: string }
  | { type: 'start' , lobbyState: LobbyState }
  | { type: 'input', action: ClientAction}
  | { type: 'addPlayer', player: LobbyPlayer, rev: number }
  | { type: 'removePlayer', playerId: string, rev: number }
  | { type: 'switchTeam', playerId: string, rev: number }
  | { type: 'setRules', newRules: MatchRules , rev: number }

export type ServerMessage =
  | {
      type: 'lobby';
      lobbyState: LobbyState;
      controlledPlayerIds: string[]; // the player IDs this client controls
    }
  | { type: 'snapshot', state: number[] }
  | { type: 'error', message: string }

export function isLegalInputMessage(value: unknown): boolean {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

  if (!isObject(value) || value.type !== 'input') return false;
  const input = value.action;
  if (!isObject(input) || !isObject(input.actions)) return false;

  return Object.values(input.actions).every(a =>
    isObject(a)
    && [-1, 0, 1].includes(a.moveX as number)
    && [-1, 0, 1].includes(a.moveY as number)
    && typeof a.kick === 'boolean'
  );
}
