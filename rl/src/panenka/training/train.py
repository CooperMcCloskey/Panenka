from .config import NUM_GAMES, NUM_UPDATES, UPDATE_LOG_INTERVAL
from .utils import get_action_ticks, get_rollout_steps

import time
from functools import partial
import jax
import jax.numpy as jnp

from panenka.algorithms.random_algorithm import RandomAlgorithm
from panenka.algorithms.algorithm import Transition
from panenka.env import PanenkaEnv

env = PanenkaEnv(blue_agent_num=1, orange_agent_num=1, game_length=1800)

algorithms = {"random": RandomAlgorithm()}

mapping = { # agent name -> algorithm name
    "blue_0": "random",
    "orange_0": "random"
}

initial_key = jax.random.key(0)
learners = {}
for name, algo in algorithms.items():
    key, init_key = jax.random.split(initial_key)
    learners[name] = algo.init(init_key, env.observation_size)

key, reset_key = jax.random.split(key)
obs, states = jax.vmap(env.reset)(jax.random.split(reset_key, NUM_GAMES))

# obs[agent] is (NUM_GAMES, obs_size), so each act call chooses that agent's action in every game at once
def select_actions(learners, obs, key):
    actions, logging = {}, {}
    for agent_name in env.agents:
        key, action_key = jax.random.split(key)
        algo_name = mapping[agent_name]
        actions[agent_name], logging[agent_name] = algorithms[algo_name].act(learners[algo_name], obs[agent_name], action_key)
    return actions, logging

def rollout(learners, states, obs, key, action_ticks, steps):
    def step(carry, key):
        states, obs = carry # carry is the (states, obs) that is returned by the prev step
        action_key, env_key = jax.random.split(key)
        actions, logging = select_actions(learners, obs, action_key)

        # steps every game at once. in_axes: each game gets its own key, state and actions, but they all share action_ticks
        next_obs, states, rewards, dones, _ = jax.vmap(env.step, in_axes=(0, 0, 0, None))(
            jax.random.split(env_key, NUM_GAMES), states, actions, action_ticks # each game's key rounds its ticks
        )

        transitions = {a: Transition(obs[a], actions[a], rewards[a], dones["__all__"], logging[a]) for a in env.agents}
        return (states, next_obs), transitions

    # an accumulator,
    # runs the step function with an initial value of (states, obs)
    # passes in an array of (steps) random keys to run each step with
    # returns the final (states, obs), which the next rollout continues from, and the outputs
    # outputs are a Transition per agent whose fields have leading (steps, NUM_GAMES) dimensions
    (states, obs), transitions = jax.lax.scan(step, (states, obs), jax.random.split(key, steps))
    return states, obs, transitions

# compiled once per rollout length: steps is static (scan needs a fixed length), but action_ticks is traced,
# so it can change every update without recompiling
@partial(jax.jit, static_argnames="steps")
def update(learners, states, obs, key, action_ticks, steps):
    key, rollout_key = jax.random.split(key)

    states, obs, transitions = rollout(learners, states, obs, rollout_key, action_ticks, steps)

    learners, metrics = dict(learners), {}
    for name, algo in algorithms.items():
        key, learn_key = jax.random.split(key)
        agents = [a for a in env.agents if mapping[a] == name]
        
        # agents that share an algorithm are joined along the games dimension, so it learns from all of them at once
        batch = jax.tree.map(lambda *xs: jnp.concatenate(xs, axis=1), *[transitions[a] for a in agents])

        last_obs = jnp.concatenate([obs[a] for a in agents], axis=0)
        learners[name], metrics[name] = algo.update(learners[name], batch, last_obs, learn_key)

    return learners, states, obs, transitions, metrics

blue_goals = 0
orange_goals = 0
episodes = 0
steps_played = 0
update_time_elapsed = 0

for i in range(NUM_UPDATES):
    key, update_key = jax.random.split(key)
    action_ticks = get_action_ticks(i)
    steps = get_rollout_steps(action_ticks)

    start = time.perf_counter()
    learners, states, obs, transitions, metrics = jax.block_until_ready( # waits until the update is done (so the timer is accurate)
        update(learners, states, obs, update_key, action_ticks, steps))
    update_time_elapsed += time.perf_counter() - start
    steps_played += steps

    reward = transitions["blue_0"].reward
    blue_goals += int((reward > 0).sum())
    orange_goals += int((reward < 0).sum())
    episodes += int(transitions["blue_0"].done.sum())

    if(i % UPDATE_LOG_INTERVAL == UPDATE_LOG_INTERVAL-1):
        print(f"{i+1} Updates elapsed:")
        print(f"    -> {NUM_GAMES} games x {steps_played} steps in {update_time_elapsed:.1f}s, actions held {action_ticks:.2f} ticks ({steps} steps per rollout)")
        print(f"    -> episodes finished: {episodes}, goals: blue {blue_goals}, orange {orange_goals}")
        blue_goals = 0
        orange_goals = 0
        episodes = 0
        steps_played = 0
        update_time_elapsed = 0
