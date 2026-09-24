// Rendering

import type { KeyboardControls } from "./controllers/KeyboardController";

export const TICK_RATE = 60; //simulation ticks/s
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_FRAME_MS = 250; // Max time that is interpolated. Otherwise jump to the latest tick. 

//Mechanics

export const PLAYER_WEIGHT = 1
export const BALL_WEIGHT = 0.2

export const DEFAULT_PLAYER1_CONTROLS: KeyboardControls = {up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyA", kick: "Space"}
export const DEFAULT_PLAYER2_CONTROLS: KeyboardControls = {up: "KeyO", left: "KeyK", down: "KeyL", right: "Semicolon", kick: "Space"}