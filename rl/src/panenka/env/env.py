from jaxmarl.environments.multi_agent_env import MultiAgentEnv
from jaxmarl.environments.spaces import Box, Discrete
import jax.numpy as jnp
from .engine.rules import goal_scored_by
from .engine.world import kickoff_world, World
from .engine.physics import physics_step
from .engine.actions import ACTION_COUNT, mirror_action
from .observations import observe
from flax import struct

# Actions
# x movement {-1, 0, 1} |3|
# y movement {-1, 0, 1} |3|
# kick {0, 1} |2|
# total action space is 3*3*2 = discrete options 18
# 
# Observation: [
#   Self (7), (No relative positions)
#   teammates (n_teammates*9), 
#   opponents (n_opponents*9), 
#   ball (6), 
#   time elapsed (1)
# ] * n 
# total of n(7 + 9(n-1) + 6 + 1) scalars
# simplifies to n(9n + 5) -> 23 per player in a 1v1, total of 46
# positions and velocities are in [-1,1]
# everything else is in [0,1]
# orange agents have all positions and velocities multiplied by [-1, 1] so agents always learn as if they were blue
# orange actions are then flipped back using the mirror_action function
#
# reward: 1 for scoring -1 for conceeding
# dones: set all agents to done when the max steps has been reached or a goal is scored

def agent_name(i, blue_agent_num):
    return f"blue_{i}" if i < blue_agent_num else f"orange_{i - blue_agent_num}"

@struct.dataclass
class State:
    world: World
    step: int

class PanenkaEnv(MultiAgentEnv):

    def __init__(self, blue_agent_num, orange_agent_num, game_length):
        self.blue_agent_num = blue_agent_num
        self.orange_agent_num = orange_agent_num
        self.agent_num = blue_agent_num + orange_agent_num
        self.max_steps = game_length

        super().__init__(self.agent_num)
        self.agents = [agent_name(i, self.blue_agent_num) for i in range(self.agent_num)]

        self.observation_size = 9 * self.agent_num + 5
        self.observation_spaces = {a: Box(-1, 1, (self.observation_size,)) for a in self.agents}
        self.action_spaces = {a: Discrete(ACTION_COUNT) for a in self.agents}


    def reset(self, key): # key is unused because the game is deterministic
        state = State(world=kickoff_world(self.blue_agent_num, self.orange_agent_num), step=0)
        return self.get_obs(state), state

    def get_obs(self, state):
        observation = {}
        for i in range(self.agent_num):
            observation[agent_name(i, self.blue_agent_num)] = observe(state, i, self.blue_agent_num, self.agent_num, self.max_steps)
        return observation

    def step_env(self, key, state, actions): # key is unused because the game is deterministic
        player_actions = jnp.stack([actions[a] for a in self.agents])
        is_orange = jnp.arange(self.agent_num) >= self.blue_agent_num
        player_actions = jnp.where(is_orange, mirror_action(player_actions), player_actions)
        world = physics_step(state.world, player_actions)
        new_state = State(world=world, step=state.step + 1)
        obs = self.get_obs(new_state)

        goal = goal_scored_by(world.ball_pos) # 1 if blue scored, 0 if nobody scored, -1 if orange scored
        rewards = {a: goal * (1.0 if a.startswith("blue") else -1.0) for a in self.agents} # flip the score for orange players so they get a positive reward when they score

        done = (goal != 0) | (new_state.step >= self.max_steps) # done = true when a goal is scored or max steps is reached
        dones = {a: done for a in self.agents} | {"__all__": done} # apply done to all agents so they all stop together

        return obs, new_state, rewards, dones, {} 
            
    def get_avail_actions(self, state):
        return {a: jnp.ones(ACTION_COUNT, dtype=bool) for a in self.agents} # all actions are always available
    
    @property
    def agent_classes(self):
        return {"blue": self.agents[:self.blue_agent_num], "orange": self.agents[self.blue_agent_num:]}


