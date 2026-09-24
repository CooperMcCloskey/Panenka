import type { KeyboardControls } from "./controllers/KeyboardController";

// Rendering ------------------------------------------------------------------

export const TICK_RATE = 60; // simulation ticks/s
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_FRAME_MS = 250; // Max time that is interpolated. Otherwise jump to the latest tick. 

//Mechanics ------------------------------------------------------------------

// Bounciness, 0 (no bounce) to 1 (perfect bounce). A collision uses the product of both bodies' values.
// Each tick: vel = (vel + FORCE / mass) * damping. Top speed = (FORCE / mass) * DAMPING / (1 - DAMPING).
export const PLAYER_MASS = 1
export const PLAYER_FORCE = 0.0004 // push from movement input; acceleration = PLAYER_FORCE / current mass
export const PLAYER_DAMPING = 0.94 // vel is multiplied by damping each tick
export const PLAYER_ELASTICITY = 0.3
export const PLAYER_RADIUS = 0.03
export const KICK_POWER = 0.015 // speed added to the ball by a kick, units per tick
export const KICK_REACH = 0.01
export const KICK_DIRECTION_BONUS = 1.5// kick speed += this * player's speed toward the kick direction
export const KICK_COOLDOWN = 15 // ticks before player can kick again (0.25 s)
export const KICK_MASS_MULTIPLIER = 9 // Holding kick makes a player heavier (harder to bump) and stronger (wins pushing contests).
export const KICK_FORCE_MULTIPLIER = 3

export const BALL_MASS = 0.2
export const BALL_DAMPING = 0.98
export const BALL_ELASTICITY = 0.8
export const BALL_RADIUS = 0.015

export const WALL_ELASTICITY = 1 // touchlines and goal lines
export const NET_ELASTICITY = 0.1 // back and sides of the goal, so the ball dies in the net
export const POST_ELASTICITY = 0.8


//Layout ------------------------------------------------------------------
// Valid center positions (the layout below is derived so these come out exact):
//   Player:          x ∈ [0, 1.8]    y ∈ [0, 1]
//   Ball on pitch:   x ∈ [0.1, 1.7]  y ∈ [0.1, 0.9]
//   Ball in a goal:  x ∈ [0, 0.1] or [1.7, 1.8],  y ∈ [0.35, 0.65]
export const WORLD_WIDTH = 1.8 // player centers: x ∈ [0, WORLD_WIDTH]
export const WORLD_HEIGHT = 1 // player centers: y ∈ [0, WORLD_HEIGHT]

// Ball centers on the pitch stay BALL_MARGIN inside the world on every side. The lines
// sit one ball radius further out, where the ball's edge touches them.
export const BALL_MARGIN = 0.1
export const PITCH_LEFT = BALL_MARGIN - BALL_RADIUS
export const PITCH_RIGHT = WORLD_WIDTH - BALL_MARGIN + BALL_RADIUS
export const PITCH_TOP = BALL_MARGIN - BALL_RADIUS
export const PITCH_BOTTOM = WORLD_HEIGHT - BALL_MARGIN + BALL_RADIUS

export const PITCH_WIDTH = PITCH_RIGHT - PITCH_LEFT // 1.63
export const PITCH_HEIGHT = PITCH_BOTTOM - PITCH_TOP // 0.83

export const CENTER_X = WORLD_WIDTH / 2
export const CENTER_Y = WORLD_HEIGHT / 2

export const GOAL_WIDTH = 0.33 // between post centers; the ball fits through at y ∈ [0.35, 0.65]
export const GOAL_DEPTH = BALL_MARGIN // so a ball in the net can reach x = 0 / WORLD_WIDTH

export const POST_RADIUS = 0.012

//Settings ------------------------------------------------------------------
export const DEFAULT_PLAYER1_CONTROLS: KeyboardControls = {up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD", kick: "Space"}
export const DEFAULT_PLAYER2_CONTROLS: KeyboardControls = {up: "KeyO", left: "KeyK", down: "KeyL", right: "Semicolon", kick: "Enter"}