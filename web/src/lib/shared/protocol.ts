import { type MatchRules, type Team, type Action, DEFAULT_MATCH_RULES } from '$lib/engine/types';
import { WebSocket } from "ws";

export type PlayerId = string;
export type ClientId = string;
export type LobbyPlayer = {username: string, team: Team}

export type Client = {
  token: string,
  socket?: WebSocket,
  controlledPlayers: PlayerId[],
  username: string,
  rttMs?: number,
}
export type PublicClient = {
  username: string
  controlledPlayers: PlayerId[]
}

export type LobbyPlayers = Record<PlayerId, LobbyPlayer>
export type ClientAction = Record<PlayerId, Action>

// Transport metadata stays outside the physics state and its exact codec.
export type InputAck = { sequence: number; tick: number; queueMs: number };
export type SnapshotNetwork = {
  heldActions: Action[];
  inputAck?: InputAck;
  rttMs?: number;
  serverFrameMs: number;
  serverTickDelayMs: number;
};

export type LobbyState = {
  rev: number,

  players: LobbyPlayers,
  clients: Record<ClientId, PublicClient>,
  adminId: string 

  rules: MatchRules,  
  playerMapping: string[],
  started: boolean,
}

export const NEW_LOBBY_STATE: ()=>LobbyState = () => ({
  rev: 0, 
  
  players: {}, 
  clients: {},
  adminId: "",

  rules: DEFAULT_MATCH_RULES, 
  playerMapping: [],
  started: false
});

export type ClientMessage =
  | { type: 'join', code: string, token: string }
  | { type: 'start' , lobbyState: LobbyState }
  | { type: 'input', actions: ClientAction, sequence?: number }
  | { type: 'addPlayer', player: LobbyPlayer, rev: number }
  | { type: 'removePlayer', playerId: string, rev: number }
  | { type: 'switchTeam', playerId: string, rev: number }
  | { type: 'setRules', newRules: MatchRules , rev: number }
  | { type: 'endMatch' }

export type ServerMessage =
  | {
      type: 'lobby';
      lobbyState: LobbyState;
      controlledPlayerIds: string[]; // the player IDs this client controls
    }
  | { type: 'snapshot', state: number[], network?: SnapshotNetwork }
  | { type: 'error', message: string }

export function isLegalInputMessage(value: unknown): boolean {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

  // { type: 'input', actions: { [playerId]: Action } }
  if (!isObject(value) || value.type !== 'input' || !isObject(value.actions)) return false;
  if (value.sequence !== undefined && (!Number.isSafeInteger(value.sequence) || (value.sequence as number) < 1)) return false;

  return Object.values(value.actions).every(a =>
    isObject(a)
    && [-1, 0, 1].includes(a.moveX as number)
    && [-1, 0, 1].includes(a.moveY as number)
    && typeof a.kick === 'boolean'
  );
}
