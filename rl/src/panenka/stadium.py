# Static geometry, mirroring web/src/lib/engine/stadium.ts. Collisions run through these in order,
# so the order is part of the physics. Walls are (ax, ay, bx, by, elasticity).
from .constants import (
    CENTER_Y, GOAL_DEPTH, GOAL_WIDTH, NET_ELASTICITY, PITCH_BOTTOM, PITCH_LEFT, PITCH_RIGHT, PITCH_TOP, PLAYER_RADIUS,
    WALL_ELASTICITY, WORLD_HEIGHT, WORLD_WIDTH,
)

GOAL_TOP = CENTER_Y - GOAL_WIDTH / 2
GOAL_BOTTOM = CENTER_Y + GOAL_WIDTH / 2

L, R, T, B = PITCH_LEFT, PITCH_RIGHT, PITCH_TOP, PITCH_BOTTOM

# Stop the ball: touchlines, goal lines beside each mouth, then the nets.
BALL_WALLS = (
    (L, T, R, T, WALL_ELASTICITY),
    (L, B, R, B, WALL_ELASTICITY),
    (L, T, L, GOAL_TOP, WALL_ELASTICITY),
    (L, GOAL_BOTTOM, L, B, WALL_ELASTICITY),
    (R, T, R, GOAL_TOP, WALL_ELASTICITY),
    (R, GOAL_BOTTOM, R, B, WALL_ELASTICITY),
    (L, GOAL_TOP, L - GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY),
    (L - GOAL_DEPTH, GOAL_TOP, L - GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY),
    (L - GOAL_DEPTH, GOAL_BOTTOM, L, GOAL_BOTTOM, NET_ELASTICITY),
    (R, GOAL_TOP, R + GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY),
    (R + GOAL_DEPTH, GOAL_TOP, R + GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY),
    (R + GOAL_DEPTH, GOAL_BOTTOM, R, GOAL_BOTTOM, NET_ELASTICITY),
)

# Stop players: one player radius outside the world, so player centers stay within it.
OUT_L, OUT_R = -PLAYER_RADIUS, WORLD_WIDTH + PLAYER_RADIUS
OUT_T, OUT_B = -PLAYER_RADIUS, WORLD_HEIGHT + PLAYER_RADIUS

PLAYER_WALLS = (
    (OUT_L, OUT_T, OUT_R, OUT_T, 0.0),
    (OUT_R, OUT_T, OUT_R, OUT_B, 0.0),
    (OUT_R, OUT_B, OUT_L, OUT_B, 0.0),
    (OUT_L, OUT_B, OUT_L, OUT_T, 0.0),
)

# Stop everything.
POSTS = ((L, GOAL_TOP), (L, GOAL_BOTTOM), (R, GOAL_TOP), (R, GOAL_BOTTOM))
