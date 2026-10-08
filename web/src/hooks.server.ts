import { building } from '$app/environment';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { startWebSocketServer } from '$lib/server/game/websocket.server';

// Ready for /ws connections as soon as the server starts
export const init: ServerInit = () => {
  if (!building) startWebSocketServer();
};

export const handle: Handle = ({ event, resolve }) => {
  if (!building) startWebSocketServer(); // in dev, picks up the socket handler after a hot reload
  return resolve(event);
};
