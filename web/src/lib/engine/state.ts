import { CENTER_X, CENTER_Y, KICKOFF_SPACING, PITCH_LEFT, PITCH_WIDTH } from './constants';
import { KICKOFF_COUNTDOWN_TICKS } from './rules';
import type { GameState, MatchRules, TeamSizes, World } from './types';
import { vec } from './vec';

export function createState(teamSizes: TeamSizes, rules: MatchRules): GameState {
  return {
    world: kickoffWorld(teamSizes),
    match: {
      tick: 0,
      clock: 0,
      phase: { kind: 'countdown', ticksLeft: KICKOFF_COUNTDOWN_TICKS },
      score: { orange: 0, blue: 0 },
      rules,
      teamSizes,
      winner: null,
    },
  };
}

// Blue players first, then orange. Each team lines up vertically, centered.
export function kickoffWorld(teamSizes: TeamSizes): World {

  const {blue: blueTeamSize, orange: orangeTeamSize} = {...teamSizes}
  const players = Array.from({length: blueTeamSize + orangeTeamSize}, (_,k) => {
    const playerIndex = k < blueTeamSize ? k : k-blueTeamSize
    const playerTeamSize = k < blueTeamSize ? blueTeamSize : orangeTeamSize
    const player = {
      pos: vec(
        PITCH_LEFT + (k < blueTeamSize ? 0.1 : 0.9) * PITCH_WIDTH,
        CENTER_Y + ((playerTeamSize-1)/2 - playerIndex) * KICKOFF_SPACING,
      ),
      vel: vec(),
      kickHeld: false,
      kickUsed: false,
      kickCooldown: 0,
    }
    return player
  })

  return {
    players,
    ball: { 
      pos: vec(CENTER_X, CENTER_Y),
      vel: vec() 
    }, 
  };
}
