import { customAlphabet } from 'nanoid';
import type { MatchRules } from '$lib/engine/types';
import { Room } from './room.server';
import { WebSocket } from 'ws';

export const HEARTBEAT_MS = 15_000;
export const MAX_MISSED_PINGS = 2;
const removalTimers = new WeakMap<Room, Map<string, ReturnType<typeof setTimeout>>>();

export function cancelPlayerRemoval(room: Room, token: string) {
  const timers = removalTimers.get(room);
  clearTimeout(timers?.get(token));
  timers?.delete(token);
}

export function removePlayer(room: Room, token: string, socket?: WebSocket) {
  const player = room.players.find(p => p.token === token);
  // An old connection must never remove a player who has reconnected elsewhere.
  if (!player || (socket ? player.socket !== socket : !!player.socket)) return false;
  cancelPlayerRemoval(room, token);
  room.removePlayer(token);
  socket?.terminate();
  deleteRoomIfEmpty(room);
  return true;
}

export function schedulePlayerRemoval(room: Room, token: string) {
  cancelPlayerRemoval(room, token);
  let timers = removalTimers.get(room);
  if (!timers) { timers = new Map(); removalTimers.set(room, timers); }
  timers.set(token, setTimeout(() => removePlayer(room, token), HEARTBEAT_MS * MAX_MISSED_PINGS));
}

export function deleteRoomIfEmpty(room: Room) {
  if (getRoom(room.code) !== room) return false;
  if (room.players.some(p => p.socket?.readyState === WebSocket.OPEN)) return false;
  return delRoom(room.code);
}

// Keep the registry shared with the socket listener across development reloads.
const globalRooms = globalThis as typeof globalThis & { panenkaRooms?: Map<string, Room> };
const rooms = globalRooms.panenkaRooms ??= new Map<string, Room>();
const generateCode = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export function createRoom(): Room {
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));
  const room = new Room(code);
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase()); 
}

export function delRoom(code: string) {
  const room = getRoom(code);
  if (room) {
    room.stop();
    removalTimers.get(room)?.forEach(timer => clearTimeout(timer));
    removalTimers.delete(room);
    room.players.forEach(p => p.socket?.close(1000, 'Room deleted'));
    room.players.splice(0);
  }
  return rooms.delete(code.toUpperCase());
}
