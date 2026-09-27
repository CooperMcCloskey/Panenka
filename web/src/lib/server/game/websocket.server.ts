import { WebSocketServer } from 'ws';
import { getRoom } from './rooms.server';
import type { Room } from './room.server';
import { isInput } from '$lib/shared/protocol';

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
    let count = 0;
    let player: Room['players'][number] | undefined;
    let pingSentAt: number | undefined;
    let pingPayload = '';
    const ping = () => {
      alive = false;
      pingSentAt = performance.now();
      pingPayload = String(pingSentAt);
      socket.ping(pingPayload);
    };
    const joinTimeout = setTimeout(() => socket.close(1008, 'Join required'), 5000);
    const heartbeat = setInterval(() => {
      if (!alive) { socket.terminate(); return; }
      ping();
    }, 15_000);
    const rateTimer = setInterval(() => { count = 0; }, 1000);
    socket.on('pong', data => {
      if (pingSentAt === undefined || data.toString() !== pingPayload) return;
      const pingMs = performance.now() - pingSentAt;
      pingSentAt = undefined;
      alive = true;
      if (room && player && player.socket === socket)
        console.log(`[room ${room.code}] ${player.username} ping: ${pingMs.toFixed(1)} ms (RTT)`);
    });
    socket.on('message', (data, binary) => {
      if (binary || ++count > 120) { socket.close(1008, 'Invalid input rate'); return; }
      try {
        const message = JSON.parse(data.toString());
        if (!room) {
          if (message?.type !== 'join' || typeof message.code !== 'string' || typeof message.token !== 'string') {
            socket.close(1008, 'Invalid join'); return;
          }
          const target = getRoom(message.code);
          player = target?.connect(message.token, socket);
          if (!player) { socket.close(1008, 'Invalid room session'); return; }
          room = target; token = message.token;
          clearTimeout(joinTimeout);
          ping();
        } else if (isInput(message)) room.input(token, socket, message.seq, message.action);
        else socket.close(1008, 'Invalid message');
      } catch { socket.close(1008, 'Invalid JSON'); }
    });
    socket.on('close', () => {
      clearTimeout(joinTimeout); clearInterval(heartbeat); clearInterval(rateTimer);
      room?.disconnect(socket);
    });
    socket.on('error', () => socket.terminate());
  });
  return wss;
}
