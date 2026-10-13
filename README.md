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

## RL

```sh
cd rl
uv sync
uv run pytest      # physics parity with the web engine
```
