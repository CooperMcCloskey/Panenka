"""One tick of physics, ported from web/src/lib/engine/physics/.

Pure, so it works under jit and vmap: branches are jnp.where, and collisions are unrolled in the
same order as the TypeScript engine so results match it (see tests/test_parity.py).
"""
from typing import NamedTuple

import jax
import jax.numpy as jnp
from jax import lax

from .actions import decode_action
from .constants import (
    BALL_DAMPING, BALL_ELASTICITY, BALL_MASS, BALL_RADIUS, KICK_COOLDOWN, KICK_DIRECTION_BONUS,
    KICK_FORCE_MULTIPLIER, KICK_MASS_MULTIPLIER, KICK_POWER, KICK_REACH, MAX_BALL_SPEED, PLAYER_DAMPING,
    PLAYER_ELASTICITY, PLAYER_FORCE, PLAYER_MASS, PLAYER_RADIUS, POST_ELASTICITY, POST_RADIUS, SUBSTEPS,
)
from .stadium import BALL_WALLS, PLAYER_WALLS, POSTS
from .world import World

# Resolving one overlap can push a body into another, so run a second pass.
ITERATIONS = 2

class Props(NamedTuple):
    radius: float
    mass: float | jax.Array
    elasticity: float


BALL = Props(BALL_RADIUS, BALL_MASS, BALL_ELASTICITY)

type Body = tuple[jax.Array, jax.Array]  # (pos, vel)


def physics_step(world: World, actions: jax.Array) -> World:
    """Advances the world one tick. `actions` holds one action index per player, shape (N,)."""
    world = apply_input(world, actions)
    world = world._replace(ball_vel=world.ball_vel * BALL_DAMPING)
    world = apply_kicks(world)
    world = world._replace(ball_vel=clamp_length(world.ball_vel, MAX_BALL_SPEED))
    return move(world)


# Players --------------------------------------------------------------------


def player_mass(kick_held: jax.Array) -> jax.Array:
    """Holding kick makes a player heavier (harder to bump) and stronger (wins pushing contests)."""
    return jnp.where(kick_held, PLAYER_MASS * KICK_MASS_MULTIPLIER, PLAYER_MASS)


def player_force(kick_held: jax.Array) -> jax.Array:
    return jnp.where(kick_held, PLAYER_FORCE * KICK_FORCE_MULTIPLIER, PLAYER_FORCE)


def can_kick(world: World) -> jax.Array:
    """Per player: will kick as soon as the ball is in reach."""
    return world.kick_held & ~world.kick_used & (world.kick_cooldown == 0)


def apply_input(world: World, actions: jax.Array) -> World:
    move_dir, kick = decode_action(actions)
    accel = normalize(move_dir) * (player_force(kick) / player_mass(kick))[:, None]
    return world._replace(
        player_vel=(world.player_vel + accel) * PLAYER_DAMPING,
        kick_held=kick,
        kick_used=kick & world.kick_used,  # releasing kick re-arms it
        kick_cooldown=jnp.maximum(0, world.kick_cooldown - 1),
    )


def apply_kicks(world: World) -> World:
    """Pushes the ball away from each kicking player in reach; players aim by where they stand."""
    delta = world.ball_pos - world.player_pos
    kicks = can_kick(world) & (length(delta) <= PLAYER_RADIUS + BALL_RADIUS + KICK_REACH)
    direction = normalize(delta)
    run_speed = jnp.maximum(0, dot(world.player_vel, direction))  # running away from the ball doesn't weaken the kick
    impulses = direction * (KICK_POWER + KICK_DIRECTION_BONUS * run_speed)[:, None]

    # Added one at a time in player order, so float rounding matches the TypeScript loop.
    ball_vel = world.ball_vel
    for i in range(impulses.shape[0]):
        ball_vel = jnp.where(kicks[i], ball_vel + impulses[i], ball_vel)

    return world._replace(
        ball_vel=ball_vel,
        kick_used=world.kick_used | kicks,
        kick_cooldown=jnp.where(kicks, KICK_COOLDOWN, world.kick_cooldown),
    )


# Movement and collisions ----------------------------------------------------


def move(world: World) -> World:
    def substep(_, w: World) -> World:
        w = w._replace(
            player_pos=w.player_pos + w.player_vel * (1 / SUBSTEPS),
            ball_pos=w.ball_pos + w.ball_vel * (1 / SUBSTEPS),
        )
        return resolve_collisions(w)

    return lax.fori_loop(0, SUBSTEPS, substep, world)


def resolve_collisions(world: World) -> World:
    masses = player_mass(world.kick_held)
    props = [Props(PLAYER_RADIUS, m, PLAYER_ELASTICITY) for m in masses]

    def collide_player_static(body: Body, mass: jax.Array) -> Body:
        return collide_static(body, Props(PLAYER_RADIUS, mass, PLAYER_ELASTICITY), PLAYER_WALLS)

    def iteration(_, w: World) -> World:
        players = list(zip(w.player_pos, w.player_vel))
        ball = (w.ball_pos, w.ball_vel)
        for i in range(len(players)):
            for j in range(i + 1, len(players)):
                players[i], players[j] = circle_collision(players[i], props[i], players[j], props[j])
            players[i], ball = circle_collision(players[i], props[i], ball, BALL)

        # Each player only hits static geometry, so they're independent here and can run in parallel.
        player_pos, player_vel = jax.vmap(collide_player_static)(
            (jnp.stack([p for p, _ in players]), jnp.stack([v for _, v in players])), masses
        )
        ball_pos, ball_vel = collide_static(ball, BALL, BALL_WALLS)
        return w._replace(player_pos=player_pos, player_vel=player_vel, ball_pos=ball_pos, ball_vel=ball_vel)

    return lax.fori_loop(0, ITERATIONS, iteration, world)


def collide_static(body: Body, props: Props, walls: tuple) -> Body:
    for post in POSTS:
        body = fixed_collision(body, props, jnp.array(post), POST_RADIUS, POST_ELASTICITY)
    for ax, ay, bx, by, elasticity in walls:
        point = closest_point_on_segment(body[0], jnp.array([ax, ay]), jnp.array([bx, by]))
        body = fixed_collision(body, props, point, 0.0, elasticity, (bx - ax, by - ay))
    return body


def circle_collision(a: Body, pa: Props, b: Body, pb: Props) -> tuple[Body, Body]:
    (a_pos, a_vel), (b_pos, b_vel) = a, b
    delta = b_pos - a_pos
    dist = length(delta)
    overlap = pa.radius + pb.radius - dist
    hit = overlap > 0

    inv_a = 1 / pa.mass
    inv_b = 1 / pb.mass
    total_inv = inv_a + inv_b

    n = jnp.where(dist == 0, jnp.array([1.0, 0.0]), delta * (1 / dist))

    # Separate in proportion to inverse mass: the lighter body moves more.
    a_pos = jnp.where(hit, a_pos - n * (overlap * inv_a / total_inv), a_pos)
    b_pos = jnp.where(hit, b_pos + n * (overlap * inv_b / total_inv), b_pos)

    approach = dot(b_vel - a_vel, n)
    bounce = hit & (approach < 0)  # not if already separating
    impulse = -(1 + pa.elasticity * pb.elasticity) * approach / total_inv
    a_vel = jnp.where(bounce, a_vel - n * (impulse * inv_a), a_vel)
    b_vel = jnp.where(bounce, b_vel + n * (impulse * inv_b), b_vel)
    return (a_pos, a_vel), (b_pos, b_vel)


def fixed_collision(
    body: Body, props: Props, point: jax.Array, radius: float, elasticity: float, tangent=(1.0, 0.0)
) -> Body:
    """Against something immovable: a post, or the closest point on a wall (radius 0).

    `tangent` is the wall's direction, used to push the body out if its center is exactly on the wall.
    """
    pos, vel = body
    delta = pos - point
    dist = length(delta)
    overlap = props.radius + radius - dist
    hit = overlap > 0

    n = jnp.where(dist == 0, normalize(jnp.array([-tangent[1], tangent[0]])), delta * (1 / dist))
    pos = jnp.where(hit, pos + n * overlap, pos)

    approach = dot(vel, n)
    vel = jnp.where(hit & (approach < 0), vel - n * ((1 + props.elasticity * elasticity) * approach), vel)
    return pos, vel


def closest_point_on_segment(p: jax.Array, a: jax.Array, b: jax.Array) -> jax.Array:
    ab = b - a
    t = jnp.clip(dot(p - a, ab) / dot(ab, ab), 0, 1)
    return a + ab * t


# Vectors: arrays whose last axis is (x, y) ----------------------------------


def dot(a: jax.Array, b: jax.Array) -> jax.Array:
    return a[..., 0] * b[..., 0] + a[..., 1] * b[..., 1]


def length(v: jax.Array) -> jax.Array:
    return jnp.sqrt(dot(v, v))


def normalize(v: jax.Array) -> jax.Array:
    n = length(v)
    return v * jnp.where(n == 0, 0.0, 1 / n)[..., None]


def clamp_length(v: jax.Array, max_length: float) -> jax.Array:
    n = length(v)
    return v * jnp.where(n > max_length, max_length / n, 1.0)[..., None]
