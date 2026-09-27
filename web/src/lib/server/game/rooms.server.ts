import { customAlphabet } from 'nanoid';
import type { MatchRules } from '$lib/engine/types';
import { Room } from './room.server';

// Keep the registry shared with the socket listener across development reloads.
const globalRooms = globalThis as typeof globalThis & { panenkaRooms?: Map<string, Room> };
const rooms = globalRooms.panenkaRooms ??= new Map<string, Room>();
const generateCode = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export function createRoom(rules: MatchRules, numPlayers: number, username: string): Room {
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));
  const room = new Room(code, rules, numPlayers);
  room.addPlayer(username);
  rooms.set(code, room);
  return room;
}
export function getRoom(code: string) {
  return rooms.get(code.toUpperCase()); 
}

export function delRoom(code: string) {
  getRoom(code)?.stop();
  return rooms.delete(code.toUpperCase());
}
