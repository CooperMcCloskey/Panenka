// Immutable: every method returns a new vector.
export class Vec2 {
  constructor(readonly x = 0, readonly y = 0) {}

  add(o: Vec2): Vec2 { return new Vec2(this.x + o.x, this.y + o.y) }
  sub(o: Vec2): Vec2 { return new Vec2(this.x - o.x, this.y - o.y) }
  scale(k: number): Vec2 { return new Vec2(this.x * k, this.y * k) }
  dot(o: Vec2): number { return this.x * o.x + this.y * o.y }
  length(): number { return Math.sqrt(this.x * this.x + this.y * this.y) } // not Math.hypot: its result can differ between JS engines
  normalize(): Vec2 { const len = this.length(); return len === 0 ? new Vec2() : this.scale(1 / len) }
  clampLength(max: number): Vec2 { const len = this.length(); return len > max ? this.scale(max / len) : this }
  lerp(o: Vec2, t: number): Vec2 { return new Vec2(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t) }
}

export const vec = (x = 0, y = 0) => new Vec2(x, y);
