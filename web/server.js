// Production entry (`npm start`, after `npm run build`): SvelteKit's request handler and the
// game's WebSocket on one port, since hosts like Azure App Service expose only one.
import { createServer } from 'node:http';
import { handler } from './build/handler.js';

const server = createServer((req, res) => handler(req, res, () => res.writeHead(404).end()));

// globalThis.panenkaUpgrade is set by src/lib/server/game/websocket.server.ts when SvelteKit
// starts up (the init hook in hooks.server.ts), which happens while build/handler.js loads.
server.on('upgrade', (req, socket, head) => {
  if (req.url?.split('?')[0] === '/ws' && globalThis.panenkaUpgrade) globalThis.panenkaUpgrade(req, socket, head);
  else socket.destroy();
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Listening on port ${port}`));
