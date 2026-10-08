import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { getRoom, cancelClientRemoval, removeClient, scheduleClientRemoval,
  deleteRoomIfEmpty, HEARTBEAT_MS, MAX_MISSED_PINGS } from './roomManager.server';
import type { Room } from './room.server';
import { isLegalInputMessage, type ClientMessage } from '$lib/shared/protocol';

type Upgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
const runtime = globalThis as typeof globalThis & { panenkaSockets?: WebSocketServer, panenkaUpgrade?: Upgrade };

// The game socket shares the site's HTTP server and port (hosts like Azure expose only one).
// That server (Vite in dev, server.js in production) hands upgrade requests for /ws to
// globalThis.panenkaUpgrade, which is set here.
export function startWebSocketServer(): WebSocketServer {
  let wss = runtime.panenkaSockets;
  // A dev process from before this change can still hold the old server on its own port
  if (wss && !wss.options.noServer) { wss.close(); wss = undefined; }
  if (!wss) {
    const server = wss = runtime.panenkaSockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
    server.on('error', console.error);
    runtime.panenkaUpgrade = (req, socket, head) =>
      server.handleUpgrade(req, socket, head, (ws) => server.emit('connection', ws, req));
  }
  // The server outlives dev reloads of this file, so swap in the current handler;
  // otherwise edits here only apply after restarting the dev server
  if (!wss.listeners('connection').includes(connectSocket)) {
    wss.removeAllListeners('connection');
    wss.on('connection', connectSocket);
  }
  return wss;
}

// addClient is called in /online/+page.server.ts dont know if needs to be called anywhere else
function connectSocket(socket: WebSocket): void {
  let room: Room | undefined;
  let token = '';
  let alive = true;
  let missedPings = 0;
  let count = 0;
  let client: Room['clients'][string] | undefined;

  let pingSentAt: number | undefined;
  let pingPayload = '';

  // May be useful for interpolation and testing
  function ping() {
    alive = false;
    pingSentAt = performance.now();
    pingPayload = String(pingSentAt);
    socket.ping(pingPayload);
  };
  function pong(data: Buffer<ArrayBufferLike>) {
    if (pingSentAt === undefined || data.toString() !== pingPayload) return;
    const pingMs = performance.now() - pingSentAt;
    pingSentAt = undefined;
    alive = true;
    missedPings = 0;
  }
  socket.on('pong', pong);

  function joinRoom(message: ClientMessage & {type: "join"}){
    const target = getRoom(message.code);
    client = target?.connect(message.token, socket);
    if (!client) { socket.close(1008, 'Invalid room session'); return; }
    room = target!; token = message.token;
    cancelClientRemoval(room, token);
    clearTimeout(joinTimeout);
    ping();
    // TODO FIX START MATCH 
  }

  const joinTimeout = setTimeout(() => socket.close(1008, 'Join required'), 5000);
  const heartbeat = setInterval(() => {
    if (!alive && ++missedPings >= MAX_MISSED_PINGS) {
      if (!room || !removeClient(room, token, socket)) socket.terminate();
      return;
    }
    ping();
  }, HEARTBEAT_MS);
  const rateTimer = setInterval(() => { count = 0; }, 1000);
  
  socket.on('message', (data, binary) => {
    if (binary || ++count > 120) { socket.close(1008, 'Invalid input rate'); return; }
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      if (!room){
        if(message.type === "join") joinRoom(message);
        else socket.close(1008, 'Sent message before room joined')
        return;
      } 
      else if (message.type === 'input') {
        if(isLegalInputMessage(message)) room.input(token, message.actions);
        else socket.close(1008, 'Illegal inputs');
        return;
      }
      else if (message.type === 'start') room.startMatch(message.lobbyState, token);
      else if (message.type === 'addPlayer' ) room.addPlayer(token, message.player, message.rev);
      else if (message.type === 'removePlayer') room.removePlayer(token, message.playerId, message.rev);
      else if (message.type === 'switchTeam') room.switchPlayerTeam(token, message.playerId, message.rev);
      else if (message.type === 'setRules') room.setRules(token, message.newRules, message.rev);
      else if (message.type === 'endMatch') room.endMatch(token);
      else socket.close(1008, 'Invalid message');
    } catch { socket.close(1008, 'Invalid Message'); }
  });
  socket.on('close', () => {
    clearTimeout(joinTimeout); 
    clearInterval(heartbeat); 
    clearInterval(rateTimer);
    
    if (room && client?.socket === socket) {
      room.disconnect(socket);
      scheduleClientRemoval(room, token);
    }
  });
  socket.on('error', () => socket.terminate());
};

