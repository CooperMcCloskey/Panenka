import jax
from .algorithm import Algorithm

class PPO(Algorithm):
  def init(self, key, obs_size):
    pass

  def act(self, learner, obs, key):
    pass

  def update(self, learner, rollout, last_obs, key):
    pass