# Panenka

A football-style game, built to train multi-agent RL policies on.
Play Now!

[panenkaball.com](https://panenkaball.com)


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

The server simulates at 60 Hz and normally sends one snapshot per tick. Clients
predict the whole physics world using the same engine: players, ball, kicks and
collision impulses advance together. Received snapshots restore authoritative
state and replay inputs the server has not yet acknowledged. Scores, phases,
kickoffs and match decisions remain server-authoritative.

`client/snapshot-clock.ts` estimates simulation time from the earliest deliveries
in a rolling two-second window. A late packet no longer shifts the playback clock
and changes movement speed. Small timing differences are ignored; longer-term
clock corrections adjust playback by at most 5%, without rewinding positions.
`client/adaptive-delay.ts` starts adaptive playback at 25 ms, then targets one tick
(16.7 ms) on steady connections. It covers the 95th percentile of observed delivery
offsets, capped at a 100 ms target, and recovers at 30 ms per second. An underrun
adds one snapshot interval of reserve and holds it for a second before recovery.
Playback approaches that target without jumping backward. Unexpected gaps longer
than the buffer can still cause a hold; kickoffs and long suspensions reset playback.
Tune `ADAPTIVE_DELAY_SETTINGS` or `INTERPOLATION_SETTINGS`, or pass overrides as the
optional sixth argument to `NetworkSource`. `{ prediction: false }` selects
authoritative interpolation. Combining it with `{ adaptiveDelay: false }` keeps a
fixed 50 ms buffer; an explicit `{ delayMs: 40 }` also selects fixed buffering.
The interpolation buffer remains the fallback for spectators and old snapshots
without prediction metadata.

`client/client-prediction.ts` keeps bounded local input history, reconciles all
dynamic bodies together, and smooths corrections only in the drawn positions.
The contact guard runs after drawing corrections so smoothing cannot leave bodies
overlapping. Prediction stops advancing after 250 ms without a fresh snapshot,
resets at kickoffs, and never feeds drawn positions back into physics. Disable it
or tune `PREDICTION_SETTINGS` through the `prediction` option.

`client/network-metrics.ts` exposes RTT, input send/confirmation/playback latency,
snapshot gaps, browser frame intervals and server scheduling delays through
`NetworkSource.diagnostics`. Prediction adds its lead, reconciliation error and
local response timing. Details and research references are in
[docs/network-playback.md](docs/network-playback.md).

`client/contact-guard.ts` corrects visible overlaps caused by interpolating curved
contact paths or small residual overlaps in a crowded server snapshot. It runs the
existing collision constraints on temporary bodies, with a bounded number of
passes, and changes only drawn positions. Received snapshots, velocities, kicking
and authoritative physics are untouched. All bodies are corrected together.

`server/game/tick-scheduler.ts` schedules against fixed deadlines to avoid periodic
gaps from rounding a 60 Hz interval to whole milliseconds. Missed physics ticks
still run, but only the final snapshot is sent after a catch-up batch.
`server/game/snapshot-broadcast.ts` encodes the physics state once and skips sockets
with queued data; they receive the newest state when writable instead of building
a queue of obsolete snapshots. Each client receives its own input acknowledgement
and measured RTT alongside the shared held actions and server timing. Metadata is
separate from the exact physics codec. The transport remains the existing JSON WebSocket.

Key changes send immediately through `client/input-sender.ts`, with rapid changes
coalesced to at most 90 messages/s and held inputs refreshed every 100 ms. The
shared `InputBuffer` preserves short kick taps until the server's next simulation
tick. A congested client retries within its send budget without consuming pending
kicks; a coalesced tap also schedules its release promptly. These modules keep the
existing WebSocket transport, state codec, physics tick rate and server authority.
Input messages carry an optional increasing sequence; acknowledgements are emitted
only after a physics tick consumes those inputs. Legacy inputs remain accepted.
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
