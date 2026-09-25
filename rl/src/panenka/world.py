from typing import NamedTuple

import jax
import jax.numpy as jnp

from .constants import CENTER_X, CENTER_Y, KICKOFF_SPACING, PITCH_LEFT, PITCH_WIDTH


class World(NamedTuple):
    """Everything physics needs, mirroring `World` in web/src/lib/engine/types.ts.

    Players alternate teams by index: even are blue (defend the left goal), odd are orange.
    """

    ball_pos: jax.Array  # (2,)
    ball_vel: jax.Array  # (2,)
    player_pos: jax.Array  # (N, 2)
    player_vel: jax.Array  # (N, 2)
    kick_held: jax.Array  # (N,) bool
    kick_used: jax.Array  # (N,) bool: already kicked during the current press
    kick_cooldown: jax.Array  # (N,) int32: ticks until the next kick is allowed


def kickoff_world(player_count: int) -> World:
    """Blue (even indices) on the left, orange (odd) on the right. Teammates line up vertically, centered."""

    def position(i: int) -> list[float]:
        team = i % 2
        team_size = -(-(player_count - team) // 2)  # rounded up
        offset = (i // 2 - (team_size - 1) / 2) * KICKOFF_SPACING
        return [PITCH_LEFT + (0.9 if team else 0.1) * PITCH_WIDTH, CENTER_Y + offset]

    return World(
        ball_pos=jnp.array([CENTER_X, CENTER_Y]),
        ball_vel=jnp.zeros(2),
        player_pos=jnp.array([position(i) for i in range(player_count)]),
        player_vel=jnp.zeros((player_count, 2)),
        kick_held=jnp.zeros(player_count, bool),
        kick_used=jnp.zeros(player_count, bool),
        kick_cooldown=jnp.zeros(player_count, jnp.int32),
    )
