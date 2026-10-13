import { WebSocket } from 'ws';
import type { GameState } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { ServerMessage, SnapshotNetwork } from '$lib/shared/protocol';

// Snapshots are complete states. A slow socket should get a fresh state when it
// drains, rather than queueing a growing history it will have to play through.
// Lobby messages still use the room's normal reliable send path.
export function broadcastSnapshot(state: GameState, sockets: readonly WebSocket[], network?: (socket: WebSocket) => SnapshotNetwork) {
  const ready = sockets.filter(socket => socket.readyState === WebSocket.OPEN && socket.bufferedAmount === 0);
  if (!ready.length) return;
  const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(state)) };
  const payload = JSON.stringify(message);
  for (const socket of ready)
    socket.send(network ? JSON.stringify({ ...message, network: network(socket) }) : payload);
}
