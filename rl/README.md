# RL

Training side of Panenka. Not started yet.

The environment will be a Python port of `physicsStep` in `web/src/lib/engine/physics/`. Keep the port minimal:

- State is the engine's `World`: ball and player positions/velocities, and per-player
  `kickHeld`, `kickUsed`, `kickCooldown` (mass and the "can kick" flag are derived from these).
- Drop the browser match flow (`Match`: phase, clock, goal pause, kickoff countdown, winner,
  rules): after a goal reset straight to kickoff; the env wrapper decides when an episode ends.
- Actions are indices 0–17: `(moveX + 1) * 6 + (moveY + 1) * 2 + kick`.
- Physics must match the TypeScript engine. `fixtures/physics.json` (from `npm run fixtures` in
  `web/`) has every constant, the collision geometry in order, and trajectories to test against:
  compare one step at a time from the recorded state, with a small tolerance if running in float32.
- Trained policies are exported (e.g. ONNX) for the web game's AI controller.
