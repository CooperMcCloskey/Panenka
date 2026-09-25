# Discrete action space, mirroring web/src/lib/engine/actions.ts:
# index = (move_x + 1) * 6 + (move_y + 1) * 2 + kick, with move_x, move_y in {-1, 0, 1}.
import jax.numpy as jnp

ACTION_COUNT = 18
IDLE = 8  # no movement, no kick

def encode_action(move_x, move_y, kick):
    return (move_x + 1) * 6 + (move_y + 1) * 2 + kick


def decode_action(index):
    """Returns (move, kick): move has shape (..., 2), kick is a bool array."""
    index = jnp.asarray(index)
    move = jnp.stack([index // 6 - 1, index // 2 % 3 - 1], axis=-1)
    return move, index % 2 == 1
