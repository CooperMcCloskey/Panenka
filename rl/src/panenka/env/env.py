from jaxmarl.environments.multi_agent_env import MultiAgentEnv
from jaxmarl.environments.spaces import Box, Discrete
import jax.numpy as jnp
from .rules import goal_scored_by
from .world import kickoff_world, World
from .physics import physics_step
from .utils import observe, agent_name
from .actions import ACTION_COUNT, mirror_action
from flax import struct

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

        obs_size = 9 * self.agent_num + 5 # me 7 + others 9 each + ball 6 + time elapsed → 23 in 1v1
        self.observation_spaces = {a: Box(-1, 1, (obs_size,)) for a in self.agents}
        self.action_spaces = {a: Discrete(ACTION_COUNT) for a in self.agents}


    def reset(self, key):
        state = State(world=kickoff_world(self.blue_agent_num, self.orange_agent_num), step=0)
        return self.get_obs(state), state

    def get_obs(self, state):
        observation = {}
        for i in range(self.agent_num):
            observation[agent_name(i, self.blue_agent_num)] = observe(state, i, self.blue_agent_num, self.agent_num, self.max_steps)
        return observation

    def step_env(self, key, state, actions):
        player_actions = jnp.stack([actions[a] for a in self.agents])
        is_orange = jnp.arange(self.agent_num) >= self.blue_agent_num
        player_actions = jnp.where(is_orange, mirror_action(player_actions), player_actions)
        world = physics_step(state.world, player_actions)
        new_state = State(world=world, step=state.step + 1)
        obs = self.get_obs(new_state)

        goal = goal_scored_by(world.ball_pos)
        rewards = {a: goal * (1.0 if a.startswith("blue") else -1.0) for a in self.agents}

        done = (goal != 0) | (new_state.step >= self.max_steps)
        dones = {a: done for a in self.agents} | {"__all__": done}

        return obs, new_state, rewards, dones, {}
            
    def get_avail_actions(self, state):
        return {a: jnp.ones(ACTION_COUNT, dtype=bool) for a in self.agents}
    
    @property
    def agent_classes(self):
        return {"blue": self.agents[:self.blue_agent_num], "orange": self.agents[self.blue_agent_num:]}


