import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { startWebSocketServer } from '$lib/server/game/websocket.server';

export const handle: Handle = ({ event, resolve }) => {
  if (!building) startWebSocketServer();
  return resolve(event);
};
