import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

type Upgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

// In dev and preview Vite owns the HTTP server, so it passes the game's WebSocket upgrades
// on /ws to the socket server from src/lib/server/game/websocket.server.ts.
// Production does the same in server.js.
function gameSockets(): Plugin {
	const onUpgrade: Upgrade = (req, socket, head) => {
		if (req.url?.split('?')[0] !== '/ws') return; // leave Vite's own hot-reload socket alone
		const upgrade = (globalThis as { panenkaUpgrade?: Upgrade }).panenkaUpgrade;
		if (upgrade) upgrade(req, socket, head);
		else socket.destroy(); // set up on the first page request, which always comes first
	};
	return {
		name: 'panenka-game-sockets',
		configureServer: (server) => void server.httpServer?.on('upgrade', onUpgrade),
		configurePreviewServer: (server) => void server.httpServer.on('upgrade', onUpgrade)
	};
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Node, not serverless: a future game server needs a long-running process.
			adapter: adapter()
		}),
		gameSockets()
	]
});
