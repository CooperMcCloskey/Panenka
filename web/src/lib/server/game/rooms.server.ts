import { customAlphabet } from "nanoid";
import type { MatchRules } from "$lib/engine/types";

export interface Room {
  code: string;
  rules: MatchRules;
  numPlayers: number;
}

const rooms = new Map<string, Room>();

const generateCode = customAlphabet("1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

// making unique room code 
function validCode(): string {
  let code: string;

  do {
    code = generateCode();
  } while (rooms.has(code));

  return code;
}

export function createRoom(rules: MatchRules, numPlayers: number): Room {
  const room: Room = {
    code: validCode(),
    rules,
    numPlayers,
  };

  rooms.set(room.code, room);

  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function delRoom(code: string): boolean {
  return rooms.delete(code.toUpperCase());
}
