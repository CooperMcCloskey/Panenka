import { customAlphabet } from 'nanoid';
import { Room } from './room.server';
import { WebSocket } from 'ws';

export const HEARTBEAT_MS = 15_000;
export const MAX_MISSED_PINGS = 2;
const removalTimers = new WeakMap<Room, Map<string, ReturnType<typeof setTimeout>>>();

export function cancelClientRemoval(room: Room, token: string) {
  const timers = removalTimers.get(room);
  clearTimeout(timers?.get(token));
  timers?.delete(token);
}

// TODO merge this function with the function in room.server.ts and have one unified function
export function removeClient(room: Room, token: string, socket?: WebSocket) {
  const found = room.findClient(token)!;
  if (!found) return undefined;
  const {clientId, client} = found;
  const player = room.getPlayerFromClient(client);
  // An old connection must never remove a player who has reconnected elsewhere.
  if (!player || (socket ? client.socket !== socket : !!client.socket)) return false;
  // Rename function to cancelClientRemoval
  cancelClientRemoval(room, token);
  room.removeClient(token);
  socket?.terminate();
  deleteRoomIfEmpty(room);
  return true;
}

// TODO removeClient call will need changing
export function scheduleClientRemoval(room: Room, token: string) {
  cancelClientRemoval(room, token);
  let timers = removalTimers.get(room);
  if (!timers) { timers = new Map(); removalTimers.set(room, timers); }
  timers.set(token, setTimeout(() => removeClient(room, token), HEARTBEAT_MS * MAX_MISSED_PINGS));
}

export function deleteRoomIfEmpty(room: Room) {
  if (getRoom(room.code) !== room) return false;
  if (Object.values(room.clients).some(c => c.socket?.readyState === WebSocket.OPEN)) return false;
  return delRoom(room.code);
}

// Keep the registry shared with the socket listener across development reloads.
const globalRooms = globalThis as typeof globalThis & { panenkaRooms?: Map<string, Room> };
const rooms = globalRooms.panenkaRooms ??= new Map<string, Room>();
const generateCode = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export function createRoom(adminUsername: string): Room {
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));
  const room = new Room(code, adminUsername);
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase()); 
}

// Deletes all of the timers, disconnects the websockets and clears the client array
export function delRoom(code: string) {
  const room = getRoom(code);
  if (room) {
    room.stop();
    removalTimers.get(room)?.forEach(timer => clearTimeout(timer));
    removalTimers.delete(room);
    Object.values(room.clients).forEach(c => c.socket?.close(1000, 'Room deleted'));
    Object.values(room.clients).splice(0);
  }
  return rooms.delete(code.toUpperCase());
}
