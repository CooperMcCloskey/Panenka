NUM_UPDATES = 250
UPDATE_LOG_INTERVAL = 50
NUM_GAMES = 256      # games played in parallel
ROLLOUT_TICKS = 1024  # game ticks per game in each update; games carry on into the next update

# TODO: Check how this impacts the discount rate
INITIAL_ACTION_TICKS = 8 # actions will initially be held for this many ticks to encourage exploration
FINAL_ACTION_TICKS = 1
ACTION_TICK_DECAY_PERIOD = 10000 # after this many updates, actions will be held down for final_action ticks