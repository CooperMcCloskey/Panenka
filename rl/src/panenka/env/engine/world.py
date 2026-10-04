from typing import NamedTuple

import jax
import jax.numpy as jnp

from .constants import CENTER_X, CENTER_Y, KICKOFF_SPACING, PITCH_LEFT, PITCH_WIDTH


class World(NamedTuple):
    """Everything physics needs, mirroring `World` in web/src/lib/engine/types.ts.

    Players are listed blue team first (defends the left goal), then orange.
    """

    ball_pos: jax.Array  # (2,)
    ball_vel: jax.Array  # (2,)
    player_pos: jax.Array  # (N, 2)
    player_vel: jax.Array  # (N, 2)
    kick_held: jax.Array  # (N,) bool
    kick_used: jax.Array  # (N,) bool: already kicked during the current press
    kick_cooldown: jax.Array  # (N,) int32: ticks until the next kick is allowed


def kickoff_world(blue: int, orange: int) -> World:
    """`blue` players on the left, then `orange` on the right. Each team lines up vertically, centered."""

    def line(size: int, x: float) -> list[list[float]]:
        return [[x, CENTER_Y + (k - (size - 1) / 2) * KICKOFF_SPACING] for k in range(size)]

    n = blue + orange
    return World(
        ball_pos=jnp.array([CENTER_X, CENTER_Y]),
        ball_vel=jnp.zeros(2),
        player_pos=jnp.array(line(blue, PITCH_LEFT + 0.1 * PITCH_WIDTH) + line(orange, PITCH_LEFT + 0.9 * PITCH_WIDTH)),
        player_vel=jnp.zeros((n, 2)),
        kick_held=jnp.zeros(n, bool),
        kick_used=jnp.zeros(n, bool),
        kick_cooldown=jnp.zeros(n, jnp.int32),
    )
