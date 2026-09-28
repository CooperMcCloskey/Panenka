from .config import NUM_GAMES, ROLLOUT_STEPS, NUM_UPDATES, UPDATE_LOG_INTERVAL

import time

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

key = jax.random.key(0)
learners = {}
for name, algo in algorithms.items():
    key, init_key = jax.random.split(key)
    learners[name] = algo.init(init_key, env.observation_size)

key, reset_key = jax.random.split(key)
obs, states = jax.vmap(env.reset)(jax.random.split(reset_key, NUM_GAMES))

# obs[agent] is (NUM_GAMES, obs_size), so each act call chooses that agent's action in every game at once
def select_actions(learners, obs, key):
    actions, logging = {}, {}
    for agent in env.agents:
        key, action_key = jax.random.split(key)
        name = mapping[agent] # agent is the agent name, name is the algorithm name
        actions[agent], logging[agent] = algorithms[name].act(learners[name], obs[agent], action_key)
    return actions, logging

def rollout(learners, states, obs, key):
    def step(carry, key):
        states, obs = carry # carry is the (states, obs) that is returned by the prev step
        action_key, env_key = jax.random.split(key)
        actions, logging = select_actions(learners, obs, action_key)
        next_obs, states, rewards, dones, _ = jax.vmap(env.step)( # steps every game at once
            jax.random.split(env_key, NUM_GAMES), states, actions) # the env ignores its keys, it's deterministic
        transitions = {a: Transition(obs[a], actions[a], rewards[a], dones["__all__"], logging[a]) for a in env.agents}
        return (states, next_obs), transitions

    # an accumulator,
    # runs the step function with an initial value of (states, obs)
    # passes in an array of (ROLLOUT_STEPS) random keys to run each step with
    # returns the final (states, obs), which the next rollout continues from, and the outputs
    # outputs are a Transition per agent whose fields have leading (ROLLOUT_STEPS, NUM_GAMES) dimensions
    (states, obs), transitions = jax.lax.scan(step, (states, obs), jax.random.split(key, ROLLOUT_STEPS))
    return states, obs, transitions

@jax.jit #compile
def update(learners, states, obs, key):
    key, rollout_key = jax.random.split(key)
    states, obs, transitions = rollout(learners, states, obs, rollout_key)

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
update_time_elapsed = 0

for i in range(NUM_UPDATES):
    key, update_key = jax.random.split(key)

    start = time.perf_counter()
    learners, states, obs, transitions, metrics = jax.block_until_ready( # waits until the update is done (so the timer is accurate)
        update(learners, states, obs, update_key))
    update_time_elapsed += time.perf_counter() - start

    reward = transitions["blue_0"].reward
    blue_goals += int((reward > 0).sum())
    orange_goals += int((reward < 0).sum())
    episodes += int(transitions["blue_0"].done.sum())

    if(i % UPDATE_LOG_INTERVAL == UPDATE_LOG_INTERVAL-1):
        print(f"{i+1} Updates elapsed:")
        print(f"    -> {NUM_GAMES} games x {UPDATE_LOG_INTERVAL * ROLLOUT_STEPS} steps in {update_time_elapsed:.1f}s {"(including compile)" if i == UPDATE_LOG_INTERVAL-1 else ""}")
        print(f"    -> episodes finished: {episodes}, goals: blue {blue_goals}, orange {orange_goals}")
        blue_goals = 0
        orange_goals = 0
        episodes = 0
        update_time_elapsed = 0
