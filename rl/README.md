# RL

Training side of Panenka, in JAX.

```sh
cd rl
uv sync                                  # .venv with jax and pytest
uv run pytest                            # parity with the TypeScript engine
uv run python -m panenka.training.train  # play games with the current model
```

Layout of `src/panenka/`:

- `env/engine/` — port of the web game's engine (`web/src/lib/engine/`): physics, world, actions, goal rule.
- `env/` — the JaxMARL environment built on it (`PanenkaEnv`) and its observations.
- `models/` — networks that pick actions (`RandomActor` so far).
- `training/` — training scripts and their settings.

## Engine

- `physics_step(world, actions)` advances one tick. It's pure, so it works under `jax.jit` and `jax.vmap`.
- `World` holds ball and player positions/velocities, and per-player `kick_held`, `kick_used`,
  `kick_cooldown` (mass and `can_kick` are derived from these). `kickoff_world(blue, orange)` makes the
  start: players are listed blue team first (defends the left goal), then orange, so any NvM works.
- Actions are indices 0–17: `(move_x + 1) * 6 + (move_y + 1) * 2 + kick` (`encode_action`, `decode_action`).
- `goal_scored_by(ball_pos)` is 1 if blue scored, -1 if orange did, else 0. It's the only part of the
  match rules that's ported: the browser match flow (`Match`: phase, clock, goal pause, kickoff countdown,
  winner) isn't, so after a goal reset straight to kickoff and let the env decide when an episode ends.

## Parity

`fixtures/physics.json` comes from `npm run fixtures` in `web/`: every constant, the collision geometry
in order, recorded trajectories, and goal checks at ball positions on and around the goal boundaries.
After changing the TypeScript engine, regenerate it and mirror the change here until `uv run pytest`
passes. Each recorded tick is checked one step at a time: float64 matches to rounding error, float32
(for training) to 1e-4.

Trained policies are exported (e.g. ONNX) for the web game's AI controller.
