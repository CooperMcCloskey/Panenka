// Timing ---------------------------------------------------------------------

export const TICK_RATE = 60; // ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_FRAME_MS = 250; // longer frames (e.g. a backgrounded tab) are cut short instead of simulated

// Mechanics ------------------------------------------------------------------
// Each tick: vel = (vel + FORCE / mass) * DAMPING, so top speed = (FORCE / mass) * DAMPING / (1 - DAMPING).
// Elasticity is 0 (no bounce) to 1 (perfect bounce); a collision uses the product of both bodies' values.

export const PLAYER_MASS = 1
export const PLAYER_FORCE = 0.0004
export const PLAYER_DAMPING = 0.94
export const PLAYER_ELASTICITY = 0.3
export const PLAYER_RADIUS = 0.03

export const KICK_POWER = 0.015 // ball speed added by a kick
export const KICK_REACH = 0.01 // max gap between player and ball edges
export const KICK_DIRECTION_BONUS = 1.5 // extra kick speed per unit of the kicker's speed toward the ball
export const KICK_COOLDOWN = 15 // ticks
export const KICK_MASS_MULTIPLIER = 9 // while kick is held: heavier (harder to bump)...
export const KICK_FORCE_MULTIPLIER = 3 // ...and stronger (wins pushing contests)

export const BALL_MASS = 0.2
export const BALL_DAMPING = 0.98
export const BALL_ELASTICITY = 0.8
export const BALL_RADIUS = 0.015

export const WALL_ELASTICITY = 1
export const NET_ELASTICITY = 0.1
export const POST_ELASTICITY = 0.8

// Layout ---------------------------------------------------------------------
// Valid center positions:
//   Player:          x ∈ [0, 1.8]    y ∈ [0, 1]
//   Ball on pitch:   x ∈ [0.1, 1.7]  y ∈ [0.1, 0.9]
//   Ball in a goal:  x ∈ [0, 0.1] or [1.7, 1.8],  y ∈ [0.35, 0.65]

export const WORLD_WIDTH = 1.8
export const WORLD_HEIGHT = 1

// Lines sit one ball radius outside the ball's area, where its edge touches them.
export const BALL_MARGIN = 0.1
export const PITCH_LEFT = BALL_MARGIN - BALL_RADIUS
export const PITCH_RIGHT = WORLD_WIDTH - BALL_MARGIN + BALL_RADIUS
export const PITCH_TOP = BALL_MARGIN - BALL_RADIUS
export const PITCH_BOTTOM = WORLD_HEIGHT - BALL_MARGIN + BALL_RADIUS
export const PITCH_WIDTH = PITCH_RIGHT - PITCH_LEFT
export const PITCH_HEIGHT = PITCH_BOTTOM - PITCH_TOP

export const CENTER_X = WORLD_WIDTH / 2
export const CENTER_Y = WORLD_HEIGHT / 2

export const GOAL_WIDTH = 0.33 // between post centers
export const GOAL_DEPTH = BALL_MARGIN // so a ball in the net can reach the world edge
export const POST_RADIUS = 0.012
