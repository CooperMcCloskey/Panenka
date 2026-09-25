from jaxmarl.environments.multi_agent_env import MultiAgentEnv

class PanenkaEnv(MultiAgentEnv):
    def __init__(self, num_agents):
        super().__init__(num_agents)

    def reset(self, key):
        return super().reset(key)

    def step_env(self, key, state, actions):
        return super().step_env(key, state, actions)

    def get_obs(self, state):
        return super().get_obs(state)

    def get_avail_actions(self, state):
        return super().get_avail_actions(state)

    @property
    def agent_classes(self):
        return super().agent_classes