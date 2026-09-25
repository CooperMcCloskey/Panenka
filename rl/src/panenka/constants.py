# Mirrors web/src/lib/engine/constants.ts (minus the browser game loop); tests/test_parity.py checks they match.

TICK_RATE = 60  # ticks per second
SUBSTEPS = 4  # movement and collisions per tick

# Mechanics ------------------------------------------------------------------
# Each tick: vel = (vel + FORCE / mass) * DAMPING, so top speed = (FORCE / mass) * DAMPING / (1 - DAMPING).
# Elasticity is 0 (no bounce) to 1 (perfect bounce); a collision uses the product of both bodies' values.

PLAYER_MASS = 1.0
PLAYER_FORCE = 0.0004
PLAYER_DAMPING = 0.94
PLAYER_ELASTICITY = 0.3
PLAYER_RADIUS = 0.03

KICK_POWER = 0.015  # ball speed added by a kick
KICK_REACH = 0.01  # max gap between player and ball edges
KICK_DIRECTION_BONUS = 1.5  # extra kick speed per unit of the kicker's speed toward the ball
KICK_COOLDOWN = 15  # ticks
KICK_MASS_MULTIPLIER = 9  # while kick is held: heavier (harder to bump)...
KICK_FORCE_MULTIPLIER = 3  # ...and stronger (wins pushing contests)

BALL_MASS = 0.2
BALL_DAMPING = 0.98
BALL_ELASTICITY = 0.8
BALL_RADIUS = 0.015
MAX_BALL_SPEED = 0.025  # with SUBSTEPS, keeps each substep under half a ball radius so it can't tunnel

WALL_ELASTICITY = 1.0
NET_ELASTICITY = 0.1
POST_ELASTICITY = 0.8

# Layout ---------------------------------------------------------------------
# Valid center positions:
#   Player:          x ∈ [0, 1.8]    y ∈ [0, 1]
#   Ball on pitch:   x ∈ [0.1, 1.7]  y ∈ [0.1, 0.9]
#   Ball in a goal:  x ∈ [0, 0.1] or [1.7, 1.8],  y ∈ [0.35, 0.65]

WORLD_WIDTH = 1.8
WORLD_HEIGHT = 1.0

# Lines sit one ball radius outside the ball's area, where its edge touches them.
BALL_MARGIN = 0.1
PITCH_LEFT = BALL_MARGIN - BALL_RADIUS
PITCH_RIGHT = WORLD_WIDTH - BALL_MARGIN + BALL_RADIUS
PITCH_TOP = BALL_MARGIN - BALL_RADIUS
PITCH_BOTTOM = WORLD_HEIGHT - BALL_MARGIN + BALL_RADIUS
PITCH_WIDTH = PITCH_RIGHT - PITCH_LEFT
PITCH_HEIGHT = PITCH_BOTTOM - PITCH_TOP

CENTER_X = WORLD_WIDTH / 2
CENTER_Y = WORLD_HEIGHT / 2

GOAL_WIDTH = 0.33  # between post centers
GOAL_DEPTH = BALL_MARGIN  # so a ball in the net can reach the world edge
POST_RADIUS = 0.012
