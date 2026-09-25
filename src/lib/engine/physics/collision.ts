import { POSTS, WALLS, type Wall } from '../stadium';
import type { RigidBody } from '../types';
import { Vec2, vec } from '../vec';

// Resolving one overlap can push a body into another, so run a second pass.
const ITERATIONS = 2;

const BALL_WALLS = WALLS.filter((w) => w.stops === 'ball');
const PLAYER_WALLS = WALLS.filter((w) => w.stops === 'players');

// Mutates the bodies. The fixed order keeps the simulation deterministic.
export function resolveCollisions(players: RigidBody[], ball: RigidBody) {
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) circleCollision(players[i], players[j]);
      circleCollision(players[i], ball);
    }
    for (const player of players) collideStatic(player, PLAYER_WALLS);
    collideStatic(ball, BALL_WALLS);
  }
}

function collideStatic(body: RigidBody, walls: readonly Wall[]) {
  for (const post of POSTS) fixedCollision(body, post.pos, post.radius, post.elasticity);
  for (const wall of walls) {
    const point = closestPointOnSegment(body.pos, wall.a, wall.b);
    fixedCollision(body, point, 0, wall.elasticity, wall.b.sub(wall.a));
  }
}

function circleCollision(a: RigidBody, b: RigidBody) {
  const delta = b.pos.sub(a.pos)
  const dist = delta.length()
  const overlap = a.radius + b.radius - dist
  if (overlap <= 0) return

  const invA = 1 / a.mass
  const invB = 1 / b.mass
  const totalInv = invA + invB
  if (totalInv === 0) return

  const n = dist === 0 ? vec(1, 0) : delta.scale(1 / dist)

  // Separate in proportion to inverse mass: the lighter body moves more.
  a.pos = a.pos.sub(n.scale(overlap * invA / totalInv))
  b.pos = b.pos.add(n.scale(overlap * invB / totalInv))

  const approach = b.vel.sub(a.vel).dot(n)
  if (approach >= 0) return // already separating
  const bounce = a.elasticity * b.elasticity
  const impulse = -(1 + bounce) * approach / totalInv
  a.vel = a.vel.sub(n.scale(impulse * invA))
  b.vel = b.vel.add(n.scale(impulse * invB))
}

// Against something immovable: a post, or the closest point on a wall (radius 0).
// `tangent` is the wall's direction, used to push the body out if its center is exactly on the wall.
function fixedCollision(body: RigidBody, point: Vec2, radius: number, elasticity: number, tangent = vec(1, 0)) {
  const delta = body.pos.sub(point)
  const dist = delta.length()
  const overlap = body.radius + radius - dist
  if (overlap <= 0) return

  const n = dist === 0 ? vec(-tangent.y, tangent.x).normalize() : delta.scale(1 / dist)
  body.pos = body.pos.add(n.scale(overlap))

  const approach = body.vel.dot(n)
  if (approach >= 0) return
  const bounce = body.elasticity * elasticity
  body.vel = body.vel.sub(n.scale((1 + bounce) * approach))
}

function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = b.sub(a)
  const t = Math.max(0, Math.min(1, p.sub(a).dot(ab) / ab.dot(ab)))
  return a.add(ab.scale(t))
}
