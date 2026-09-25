import { KICK_FORCE_MULTIPLIER, KICK_MASS_MULTIPLIER, PLAYER_FORCE, PLAYER_MASS } from '../constants';
import type { Player } from '../types';

// Holding kick makes a player heavier (harder to bump) and stronger (wins pushing contests).
export const playerMass = (kickHeld: boolean) => (kickHeld ? PLAYER_MASS * KICK_MASS_MULTIPLIER : PLAYER_MASS);
export const playerForce = (kickHeld: boolean) => (kickHeld ? PLAYER_FORCE * KICK_FORCE_MULTIPLIER : PLAYER_FORCE);

// Will kick as soon as the ball is in reach.
export const canKick = (p: Player) => p.kickHeld && !p.kickUsed && p.kickCooldown === 0;
