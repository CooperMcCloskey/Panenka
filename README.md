# Panenka

A football-style game, built to train multi-agent RL policies on.

- `web/` — the game (SvelteKit). Local and online play; play-vs-AI later.
- `rl/` — training (Python). A port of the game engine plus the MARL experiments.

## Web

```sh
cd web
npm install
npm run dev
npm test           # engine, codec and replay tests
npm run fixtures   # regenerate rl/fixtures/physics.json after engine changes
npm run build && node build   # production (Node, PORT defaults to 3000)
```

Layout of `web/src/lib/`:

- `engine/` — the simulation. Pure TypeScript, no browser or Node APIs; the reference for the Python port.
  `physicsStep(world, actions)` is physics only; `step(state, actions)` adds match flow.
- `shared/` — not tied to the browser, so a future game server can reuse it: `Controller`, `LocalSource`, state codec.
- `client/` — browser only: keyboard controller and key bindings.
- `render/` — canvas drawing.

## Online play

Run `npm run dev` from `web/`. WebSockets use `/ws` on the same host and port as
SvelteKit; do not launch a separate game server. For production,
run `npm run build` followed by `npm start`.

Open two separate browser profiles (or one normal and one private window), create
a room in one, and join using its code in the other. The match starts when both
players connect. Each player uses their first saved control scheme (WASD and Space
by default). Lobby updates and game snapshots use the same socket.

The server simulates at 60 Hz and normally sends one snapshot per tick. All players
and the ball share one playback timeline. Movement, collision impulses, kicks and
match decisions remain server-authoritative; there is no client-side prediction.

`client/snapshot-clock.ts` estimates simulation time from the earliest deliveries
in a rolling two-second window. A late packet no longer shifts the playback clock
and changes movement speed. Small timing differences are ignored; longer-term
clock corrections adjust playback by at most 5%, without rewinding positions.
`client/adaptive-delay.ts` starts with 50 ms of buffering, then targets two ticks
(33 ms) on steady connections. It adds the observed delivery jitter, capped at a
100 ms target, and removes the extra delay gradually after conditions improve.
Playback approaches that target without jumping backward. Unexpected gaps longer
than the buffer can still cause a hold; kickoffs and long suspensions reset playback.
Tune `ADAPTIVE_DELAY_SETTINGS` or `INTERPOLATION_SETTINGS`, or pass overrides as the
optional sixth argument to `NetworkSource`. `{ adaptiveDelay: false }` keeps a
fixed 50 ms buffer; an explicit `{ delayMs: 40 }` also selects fixed buffering.
`NetworkSource.diagnostics` exposes target/current playback delay, observed jitter,
buffer underruns and queued input bytes without adding anything to the UI.

`client/contact-guard.ts` corrects visible overlaps caused by interpolating curved
contact paths or small residual overlaps in a crowded server snapshot. It runs the
existing collision constraints on temporary bodies, with a bounded number of
passes, and changes only drawn positions. Received snapshots, velocities, kicking
and authoritative physics are untouched. All bodies are corrected together.

`server/game/tick-scheduler.ts` schedules against fixed deadlines to avoid periodic
gaps from rounding a 60 Hz interval to whole milliseconds. Missed physics ticks
still run, but only the final snapshot is sent after a catch-up batch.
`server/game/snapshot-broadcast.ts` encodes each broadcast once and skips sockets
with queued data; they receive the newest state when writable instead of building
a queue of obsolete snapshots. The transport remains the existing JSON WebSocket.

Key changes send immediately through `client/input-sender.ts`, with rapid changes
coalesced to at most 90 messages/s and held inputs refreshed every 100 ms. The
shared `InputBuffer` preserves short kick taps until the server's next simulation
tick. A congested client retries within its send budget without consuming pending
kicks; a coalesced tap also schedules its release promptly. These modules keep the
existing WebSocket protocol, state codec, physics tick rate and server authority.
Reload to reconnect using the room cookie.
Rooms are in memory and reset when the server restarts; disconnected slots remain
reserved. Run a single server process. Restart development after changing server
room code, because the registry survives hot reloads.

Online matches show usernames above each player. Players controlled by your client
use yellow labels; everyone else uses cream labels. Change colours, font, spacing,
maximum width, or disable labels in `web/src/lib/render/player-labels.ts`
(`PLAYER_LABEL_STYLE`). Labels use lobby metadata and stay separate from simulation
state and network snapshots. `Match` accepts optional `playerLabels` in simulation
player order, so other game modes can reuse the renderer when they have names.

## Website metadata

`web/static/panenka.svg` is the football emblem used as the favicon.
`components/Seo.svelte` and `lib/seo.ts` supply server-rendered titles,
descriptions, canonical links, Open Graph/Twitter metadata, and homepage VideoGame
structured data. `/sitemap.xml` lists the three public menu pages; `/robots.txt`
advertises it. Match lobbies and error pages carry `noindex` metadata.

Set `PUBLIC_SITE_URL` to the production site's full origin (for example your HTTPS
domain) to pin canonical and sitemap URLs. Without it, URLs use the request
origin. When running the Node adapter behind a proxy, configure `ORIGIN` for the
deployment so SvelteKit receives the correct public origin.

## RL

```sh
cd rl
uv sync
uv run pytest      # physics parity with the web engine
```
