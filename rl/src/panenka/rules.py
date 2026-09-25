# Goal detection, mirroring goalScoredBy in web/src/lib/engine/rules.ts. The rest of the match rules
# (clock, pauses, winner) belong to the browser game.
import jax
import jax.numpy as jnp

from .constants import BALL_RADIUS, PITCH_LEFT, PITCH_RIGHT
from .stadium import GOAL_BOTTOM, GOAL_TOP


def goal_scored_by(ball_pos: jax.Array) -> jax.Array:
    """1 if blue scored, -1 if orange did, else 0: the ball must be fully over a goal line, between the posts."""
    x, y = ball_pos[..., 0], ball_pos[..., 1]
    in_mouth = (y > GOAL_TOP) & (y < GOAL_BOTTOM)
    blue = x > PITCH_RIGHT + BALL_RADIUS
    orange = x < PITCH_LEFT - BALL_RADIUS
    return jnp.where(in_mouth, blue.astype(jnp.int32) - orange.astype(jnp.int32), 0)
