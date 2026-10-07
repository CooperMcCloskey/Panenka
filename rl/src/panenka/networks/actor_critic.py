from panenka.env.engine.actions import ACTION_COUNT
import flax.linen as nn
import jax.numpy as jnp

class ActorCritic(nn.Module):
  action_dim = ACTION_COUNT

  @nn.compact
  def __call__(self, *args, **kwargs):
    x = nn.Dense(features=64)(x)
    x = nn.tanh(x)
    x = nn.Dense(features=64)(x)
    x = nn.tanh(x)

    actor_logits = nn.Dense(features=self.action_dim)(x)
    critic_value = nn.Dense(features=1)(x)

    return actor_logits, jnp.squeeze(critic_value, axis=-1)


