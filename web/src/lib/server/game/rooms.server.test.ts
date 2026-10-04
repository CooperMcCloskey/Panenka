import { afterEach, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createRoom, getRoom, delRoom, removePlayer, schedulePlayerRemoval,
  cancelPlayerRemoval, deleteRoomIfEmpty, HEARTBEAT_MS, MAX_MISSED_PINGS } from './rooms.server';

afterEach(() => vi.useRealTimers());

function socket() {
  return { readyState: WebSocket.OPEN, bufferedAmount: 0, send: vi.fn(),
    close: vi.fn(), terminate: vi.fn() } as unknown as WebSocket;
}

it('expires a disconnected slot after two heartbeat periods and allows a replacement', () => {
  vi.useFakeTimers();
  const room = createRoom({ kind: 'goals', target: 1 }, 1, 'Blue');
  const blue = room.players[0];
  const orange = room.addPlayer('Orange')!;
  const active = socket();
  room.connect(orange.token, active);
  schedulePlayerRemoval(room, blue.token);
  vi.advanceTimersByTime(HEARTBEAT_MS * MAX_MISSED_PINGS - 1);
  expect(room.players).toHaveLength(2);
  vi.advanceTimersByTime(1);
  expect(room.players).toHaveLength(1);
  expect(room.connect(blue.token, socket())).toBeUndefined();
  expect(room.addPlayer('Replacement')).toBeDefined();
  expect(getRoom(room.code)).toBe(room);
  delRoom(room.code);
});

it('protects reconnections and deletes a room after its last connection leaves', () => {
  vi.useFakeTimers();
  const room = createRoom({ kind: 'goals', target: 1 }, 1, 'Blue');
  const player = room.players[0];
  const oldSocket = socket();
  room.connect(player.token, oldSocket);
  room.disconnect(oldSocket);
  schedulePlayerRemoval(room, player.token);
  const newSocket = socket();
  room.connect(player.token, newSocket);
  cancelPlayerRemoval(room, player.token);
  vi.advanceTimersByTime(HEARTBEAT_MS * MAX_MISSED_PINGS);
  expect(removePlayer(room, player.token, oldSocket)).toBe(false);
  expect(room.players).toHaveLength(1);
  expect(deleteRoomIfEmpty(room)).toBe(false);
  room.disconnect(newSocket);
  expect(deleteRoomIfEmpty(room)).toBe(true);
  expect(getRoom(room.code)).toBeUndefined();
  expect(room.players).toHaveLength(0);
});

it('removes a timed-out connection and returns the remaining players to the lobby', () => {
  const room = createRoom({ kind: 'goals', target: 1 }, 1, 'Blue');
  const blue = room.players[0];
  const orange = room.addPlayer('Orange')!;
  const blueSocket = socket();
  const orangeSocket = socket();
  room.connect(blue.token, blueSocket);
  room.connect(orange.token, orangeSocket);
  room.startMatch(blue.token, blueSocket);
  expect(removePlayer(room, blue.token, blueSocket)).toBe(true);
  expect(blueSocket.terminate).toHaveBeenCalledOnce();
  expect(room.players).toEqual([orange]);
  const message = JSON.parse(vi.mocked(orangeSocket.send).mock.calls.at(-1)![0] as string);
  expect(message).toMatchObject({ type: 'lobby', active: false, playerIndex: 0 });
  delRoom(room.code);
});
