import jax
from .algorithm import Algorithm

from panenka.env.engine.actions import ACTION_COUNT


class RandomAlgorithm(Algorithm):
    action_dim: int = ACTION_COUNT

    def init(self, key, obs_size):
        return None # no learner for a random algorithm

    def act(self, learner, obs, key):
        actions = jax.random.randint(key, obs.shape[:-1], 0, self.action_dim) # key, shape, min, max
        return actions, ()

    def update(self, learner, rollout, last_obs, key):
        return (None, {})