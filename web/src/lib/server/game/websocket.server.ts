import { WebSocketServer } from 'ws';
import { getRoom, cancelPlayerRemoval, removeClient, schedulePlayerRemoval,
  deleteRoomIfEmpty, HEARTBEAT_MS, MAX_MISSED_PINGS } from './rooms.server';
import type { Room } from './room.server';
import { isInput, type ClientMessage } from '$lib/shared/protocol';

const runtime = globalThis as typeof globalThis & { panenkaSockets?: WebSocketServer };
export function startWebSocketServer() {
  if (runtime.panenkaSockets) return runtime.panenkaSockets;
  const wss = new WebSocketServer({ port: 8080, maxPayload: 2048 });
  runtime.panenkaSockets = wss;
  wss.on('error', console.error);
  wss.on('connection', socket => {
    let room: Room | undefined;
    let token = '';
    let alive = true;
    let missedPings = 0;
    let count = 0;
    let client: Room['clients'][string] | undefined;
    let pingSentAt: number | undefined;
    let pingPayload = '';
    // May be useful for interpolation and testing
    const ping = () => {
      alive = false;
      pingSentAt = performance.now();
      pingPayload = String(pingSentAt);
      socket.ping(pingPayload);
    };
    const joinTimeout = setTimeout(() => socket.close(1008, 'Join required'), 5000);
    const heartbeat = setInterval(() => {
      if (!alive && ++missedPings >= MAX_MISSED_PINGS) {
        if (!room || !removeClient(room, token, socket)) socket.terminate();
        return;
      }
      ping();
    }, HEARTBEAT_MS);
    const rateTimer = setInterval(() => { count = 0; }, 1000);
    socket.on('pong', data => {
      if (pingSentAt === undefined || data.toString() !== pingPayload) return;
      const pingMs = performance.now() - pingSentAt;
      pingSentAt = undefined;
      alive = true;
      missedPings = 0;
    });
    socket.on('message', (data, binary) => {
      if (binary || ++count > 120) { socket.close(1008, 'Invalid input rate'); return; }
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        if (!room) {
          if (message?.type !== 'join' || typeof message.code !== 'string' || typeof message.token !== 'string') {
            socket.close(1008, 'Invalid join'); return;
          }
          const target = getRoom(message.code);
          client = target?.connect(message.token, socket);
          if (!client) { socket.close(1008, 'Invalid room session'); return; }
          room = target!; token = message.token;
          cancelPlayerRemoval(room, token);
          clearTimeout(joinTimeout);
          ping();
          // TODO FIX START MATCH
        } else if (message?.type === 'start') room.startMatch(token, socket);
        else if (isInput(message)) room.input(token, socket, message.seq, message.actions);
        else socket.close(1008, 'Invalid message');
      } catch { socket.close(1008, 'Invalid JSON'); }
    });
    socket.on('close', () => {
      clearTimeout(joinTimeout); clearInterval(heartbeat); clearInterval(rateTimer);
      if (room && client?.socket === socket) {
        room.disconnect(socket);
        schedulePlayerRemoval(room, token);
        deleteRoomIfEmpty(room);
      }
    });
    socket.on('error', () => socket.terminate());
  });
  return wss;
}
