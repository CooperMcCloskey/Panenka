from .config import INITIAL_ACTION_TICKS, FINAL_ACTION_TICKS, ACTION_TICK_DECAY_PERIOD, ROLLOUT_TICKS
import math

# how many ticks each action is held at this update, decaying geometrically from INITIAL to FINAL.
# It can be fractional: the env rounds it per decision (6.3 -> 6 or 7 ticks) so it averages out exactly
def get_action_ticks(update_num):
  period_elapsed = min(update_num/ACTION_TICK_DECAY_PERIOD, 1) # fraction of the decay elapsed
  return INITIAL_ACTION_TICKS * (FINAL_ACTION_TICKS/INITIAL_ACTION_TICKS)**period_elapsed

# decisions per rollout, so each rollout covers about ROLLOUT_TICKS of game time.
# The rollout length is fixed when update is compiled, so it's rounded to a power of 2:
# that way it only changes (and recompiles) a few times over a run instead of every update
def get_rollout_steps(action_ticks):
  return 2 ** round(math.log2(ROLLOUT_TICKS/action_ticks))
