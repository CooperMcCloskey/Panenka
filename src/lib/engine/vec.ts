export class Vec2 {
  constructor(readonly x = 0, readonly y = 0) {}

  static from(v: { x: number; y: number }): Vec2 { return new Vec2(v.x, v.y) }
  add(o: Vec2): Vec2 { return new Vec2(this.x + o.x, this.y + o.y) }
  sub(o: Vec2): Vec2 { return new Vec2(this.x - o.x, this.y - o.y) }
  scale(k: number): Vec2 { return new Vec2(this.x * k, this.y * k) }
  dot(o: Vec2): number { return this.x * o.x + this.y * o.y }
  length(): number { return Math.hypot(this.x, this.y) }
  distance(o: Vec2): number { return Math.hypot(this.x - o.x, this.y - o.y) }
  normalize(): Vec2 { const len = this.length(); return len === 0 ? new Vec2() : this.scale(1 / len) }
  lerp(o: Vec2, t: number): Vec2 { return new Vec2(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t) }
}

export const vec = (x = 0, y = 0) => new Vec2(x, y);
