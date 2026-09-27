import jax.numpy as jnp
from .constants import CENTER_X, CENTER_Y, WORLD_WIDTH, WORLD_HEIGHT, MAX_BALL_SPEED, KICK_COOLDOWN
WORLD_CENTER = jnp.array([CENTER_X, CENTER_Y])
WORLD_INV_SIZE = jnp.array([1/WORLD_WIDTH, 1/WORLD_HEIGHT])
INV_MAX_SPEED = 1/MAX_BALL_SPEED
KICK_COOLDOWN_NORMALIZER = 1/KICK_COOLDOWN

normalize_pos = lambda p : (p-WORLD_CENTER) * WORLD_INV_SIZE

def observe(state, i, blue_agent_num, agent_num, game_length):
    world = state.world
    is_blue = i < blue_agent_num

    blue_indices, orange_indices = range(blue_agent_num), range(blue_agent_num, agent_num)
    team, opponents = (blue_indices, orange_indices) if is_blue else (orange_indices, blue_indices)
    sorted_indices = [i, *(j for j in team if j != i), *opponents]

    player_features = jnp.concatenate([get_player_features(world, i, j, is_blue) for j in sorted_indices])
    ball_features = get_ball_features(world, i, is_blue)
    time_elapsed = jnp.array([state.step/game_length])

    return jnp.concatenate([player_features, ball_features, time_elapsed])
        

# getting the features of agent j, relative to agent i
def get_player_features(world, i, j, is_blue):  
    flip = jnp.array([1, 1]) if is_blue else jnp.array([-1 , 1])
    pos_i = normalize_pos(world.player_pos[i]) * flip
    pos_j = normalize_pos(world.player_pos[j]) * flip
    relative_pos = pos_j - pos_i if i != j else [] # ignore relative pos if this is the feature for agent i
    vel = world.player_vel[j] * INV_MAX_SPEED * flip
    kick = jnp.array([world.kick_held[j], world.kick_used[j], world.kick_cooldown[j] * KICK_COOLDOWN_NORMALIZER], dtype=jnp.float32)

    features = jnp.array([*pos_j, *relative_pos, *vel, *kick])
    return features

def get_ball_features(world, i, is_blue):
    flip = jnp.array([1, 1]) if is_blue else jnp.array([-1 , 1])
    pos_i = normalize_pos(world.player_pos[i]) * flip
    ball_pos = normalize_pos(world.ball_pos) * flip
    relative_pos = ball_pos - pos_i
    vel = world.ball_vel * INV_MAX_SPEED * flip

    features = jnp.concatenate([ball_pos, relative_pos, vel])
    return features

def agent_name(i, blue_agent_num):
    return f"blue_{i}" if i < blue_agent_num else f"orange_{i - blue_agent_num}"