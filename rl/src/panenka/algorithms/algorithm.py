from typing import Any,NamedTuple,Protocol
import jax

class Transition(NamedTuple):        # one step of experience for one agent, as the runner records it
    obs: jax.Array                   # (obs_size,)
    action: jax.Array                # ()
    reward: jax.Array                # ()
    done: jax.Array                  # ()
    logging: Any                      # whatever act asked to record: log probabilities, values, etc.

class Algorithm(Protocol):
    # return the learner (the weights, plus everything else the algorithm keeps between updates)
    def init(self, key, obs_size: int) -> Any:
      pass

    # obs (..., obs_size) returns actions (...) plus logging to record.
    # The leading dimensions are games, and agents too if several share this instance.
    def act(self, learner, obs, key) -> tuple[jax.Array, Any]:
      pass

    # Learns from a rollout, returns the new learner state and metrics to log.
    # rollout is a batch of transitions, but has the same type: its fields have leading (steps, ...) dimensions.
    # last_obs (..., obs_size) is the observation after the rollout's final step.
    def update(self, learner, rollout: Transition, last_obs, key) -> tuple[Any, dict]:
      pass
