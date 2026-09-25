"""Parity with the TypeScript engine, against trajectories from `npm run fixtures` in web/."""
import json
from pathlib import Path

import jax
import jax.numpy as jnp
import numpy as np
import pytest

from panenka import (
    ACTION_COUNT, IDLE, World, decode_action, encode_action, goal_scored_by, kickoff_world, physics_step,
)
from panenka import constants, stadium

FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "physics.json").read_text())
CASES = {case["name"]: case for case in FIXTURE["cases"]}
BROWSER_ONLY = {"TICK_MS", "MAX_FRAME_MS"}  # game loop timing, not physics


def to_world(flat: list[dict]) -> World:
    """Stacks fixture worlds (ball [px, py, vx, vy], players [px, py, vx, vy, kickHeld, kickUsed, kickCooldown])."""
    ball = np.array([w["ball"] for w in flat])
    players = np.array([w["players"] for w in flat])
    return World(
        ball_pos=jnp.array(ball[:, :2]),
        ball_vel=jnp.array(ball[:, 2:]),
        player_pos=jnp.array(players[..., 0:2]),
        player_vel=jnp.array(players[..., 2:4]),
        kick_held=jnp.array(players[..., 4] == 1),
        kick_used=jnp.array(players[..., 5] == 1),
        kick_cooldown=jnp.array(players[..., 6], jnp.int32),
    )


def assert_worlds_close(actual: World, expected: World, atol: float, name: str):
    """Compares batches of worlds tick by tick and reports the first tick that differs."""
    for field in World._fields:
        a = np.asarray(getattr(actual, field), float)
        e = np.asarray(getattr(expected, field), float)
        error = np.abs(a - e).reshape(len(a), -1).max(axis=1)
        bad = np.flatnonzero(error > atol)
        assert not bad.size, f"{name}: {field} differs from tick {bad[0]} (error {error[bad[0]]:.2e}, {bad.size} ticks)"


def step_each_tick(case: dict) -> tuple[World, World]:
    """Steps every recorded world once, all ticks in parallel. Returns (actual, expected)."""
    before = to_world([case["initial"], *case["states"][:-1]])
    actions = jnp.array(case["actions"])
    return jax.jit(jax.vmap(physics_step))(before, actions), to_world(case["states"])


def test_constants():
    for name, value in FIXTURE["constants"].items():
        if name not in BROWSER_ONLY:
            assert getattr(constants, name) == value, name


def test_geometry():
    geometry = FIXTURE["geometry"]
    assert stadium.BALL_WALLS == tuple(map(tuple, geometry["ball_walls"]))
    assert stadium.PLAYER_WALLS == tuple(map(tuple, geometry["player_walls"]))
    assert stadium.POSTS == tuple(map(tuple, geometry["posts"]))


def test_action_encoding():
    move, kick = decode_action(jnp.arange(ACTION_COUNT))
    assert (encode_action(move[:, 0], move[:, 1], kick) == jnp.arange(ACTION_COUNT)).all()
    assert len({(*m, k) for m, k in zip(move.tolist(), kick.tolist())}) == ACTION_COUNT
    assert move[IDLE].tolist() == [0, 0] and not kick[IDLE]


def test_goal_scored_by():
    with jax.enable_x64(True):  # the boundary points are 1e-9 apart
        goals = np.array(FIXTURE["goals"])
        actual = np.asarray(goal_scored_by(jnp.array(goals[:, :2])))
        wrong = goals[actual != goals[:, 2]]
        assert not len(wrong), f"[x, y, expected scorer]: {wrong.tolist()}"
        assert set(goals[:, 2]) == {-1, 0, 1}  # the fixture covers every outcome


@pytest.mark.parametrize("name", [name for name in CASES if name.endswith("chase")])
def test_kickoff(name):
    with jax.enable_x64(True):
        case = CASES[name]
        expected = to_world([case["initial"]])
        actual = jax.tree.map(lambda x: x[None], kickoff_world(case["playerCount"]))
        assert_worlds_close(actual, expected, 0, name)


# Steps from each recorded world rather than rolling out the whole trajectory: XLA's compiler
# optimizations can change the last bit of a result, and over hundreds of ticks that compounds.


@pytest.mark.parametrize("name", CASES)
def test_step_float64(name):
    """Same arithmetic as the TypeScript engine, so every tick should match to rounding error."""
    with jax.enable_x64(True):
        assert_worlds_close(*step_each_tick(CASES[name]), atol=1e-12, name=name)


@pytest.mark.parametrize("name", CASES)
def test_step_float32(name):
    """Training runs in float32. When two bodies barely touch, its rounding can decide whether they
    collide, and a collision applies a whole bounce, hence the looser tolerance."""
    assert_worlds_close(*step_each_tick(CASES[name]), atol=1e-4, name=name)
