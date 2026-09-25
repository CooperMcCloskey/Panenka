import {
  BALL_ELASTICITY, BALL_MASS, BALL_RADIUS, PLAYER_ELASTICITY, PLAYER_RADIUS, POST_ELASTICITY, POST_RADIUS,
} from '../constants';
import { BALL_WALLS, PLAYER_WALLS, POSTS, type Wall } from '../stadium';
import type { Body, Player } from '../types';
import { Vec2, vec } from '../vec';
import { playerMass } from './player';

// Resolving one overlap can push a body into another, so run a second pass.
const ITERATIONS = 2;

interface Props {
  radius: number;
  mass: number;
  elasticity: number;
}

const BALL: Props = { radius: BALL_RADIUS, mass: BALL_MASS, elasticity: BALL_ELASTICITY };
const playerProps = (p: Player): Props => ({ radius: PLAYER_RADIUS, mass: playerMass(p.kickHeld), elasticity: PLAYER_ELASTICITY });

// Mutates the bodies. The fixed order keeps the simulation deterministic.
export function resolveCollisions(players: Player[], ball: Body) {
  const props = players.map(playerProps);
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) circleCollision(players[i], props[i], players[j], props[j]);
      circleCollision(players[i], props[i], ball, BALL);
    }
    players.forEach((p, i) => collideStatic(p, props[i], PLAYER_WALLS));
    collideStatic(ball, BALL, BALL_WALLS);
  }
}

function collideStatic(body: Body, props: Props, walls: readonly Wall[]) {
  for (const post of POSTS) fixedCollision(body, props, post, POST_RADIUS, POST_ELASTICITY);
  for (const wall of walls) {
    const point = closestPointOnSegment(body.pos, wall.a, wall.b);
    fixedCollision(body, props, point, 0, wall.elasticity, wall.b.sub(wall.a));
  }
}

function circleCollision(a: Body, pa: Props, b: Body, pb: Props) {
  const delta = b.pos.sub(a.pos)
  const dist = delta.length()
  const overlap = pa.radius + pb.radius - dist
  if (overlap <= 0) return

  const invA = 1 / pa.mass
  const invB = 1 / pb.mass
  const totalInv = invA + invB

  const n = dist === 0 ? vec(1, 0) : delta.scale(1 / dist)

  // Separate in proportion to inverse mass: the lighter body moves more.
  a.pos = a.pos.sub(n.scale(overlap * invA / totalInv))
  b.pos = b.pos.add(n.scale(overlap * invB / totalInv))

  const approach = b.vel.sub(a.vel).dot(n)
  if (approach >= 0) return // already separating
  const bounce = pa.elasticity * pb.elasticity
  const impulse = -(1 + bounce) * approach / totalInv
  a.vel = a.vel.sub(n.scale(impulse * invA))
  b.vel = b.vel.add(n.scale(impulse * invB))
}

// Against something immovable: a post, or the closest point on a wall (radius 0).
// `tangent` is the wall's direction, used to push the body out if its center is exactly on the wall.
function fixedCollision(body: Body, props: Props, point: Vec2, radius: number, elasticity: number, tangent = vec(1, 0)) {
  const delta = body.pos.sub(point)
  const dist = delta.length()
  const overlap = props.radius + radius - dist
  if (overlap <= 0) return

  const n = dist === 0 ? vec(-tangent.y, tangent.x).normalize() : delta.scale(1 / dist)
  body.pos = body.pos.add(n.scale(overlap))

  const approach = body.vel.dot(n)
  if (approach >= 0) return
  const bounce = props.elasticity * elasticity
  body.vel = body.vel.sub(n.scale((1 + bounce) * approach))
}

function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = b.sub(a)
  const t = Math.max(0, Math.min(1, p.sub(a).dot(ab) / ab.dot(ab)))
  return a.add(ab.scale(t))
}
