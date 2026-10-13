import type { InputAck } from '$lib/shared/protocol';

// Receiving an input is not an acknowledgement: a physics tick must consume it.
export class InputAcknowledgements {
  private pending = new Map<string, { sequence: number; receivedAtMs: number }>();
  private applied = new Map<string, InputAck>();

  accepts(clientId: string, sequence: number): boolean {
    return sequence > (this.pending.get(clientId)?.sequence ?? this.applied.get(clientId)?.sequence ?? 0);
  }

  receive(clientId: string, sequence: number, receivedAtMs: number) {
    this.pending.set(clientId, { sequence, receivedAtMs });
  }

  appliedAt(tick: number, nowMs: number) {
    for (const [id, input] of this.pending)
      this.applied.set(id, { sequence: input.sequence, tick, queueMs: Math.max(0, nowMs - input.receivedAtMs) });
    this.pending.clear();
  }

  get(clientId: string): InputAck | undefined { return this.applied.get(clientId); }

  remove(clientId: string) {
    this.pending.delete(clientId);
    this.applied.delete(clientId);
  }

  clear() {
    this.pending.clear();
    this.applied.clear();
  }
}
