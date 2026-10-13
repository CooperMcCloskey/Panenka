import { IDLE } from '$lib/engine/actions';
import type { Action } from '$lib/engine/types';

// The latest held input wins, but a short kick survives until a simulation tick.
export class InputBuffer {
  private actions = new Map<string, Action>();
  private kicks = new Set<string>();

  clear() {
    this.actions.clear();
    this.kicks.clear();
  }

  peek(ids: readonly string[]): Action[] {
    return ids.map(id => this.actions.get(id) ?? IDLE);
  }

  set(id: string, action: Action) {
    this.actions.set(id, action);
    if (action.kick) this.kicks.add(id);
  }

  release(id: string) {
    this.actions.set(id, IDLE);
    this.kicks.delete(id);
  }

  remove(id: string) {
    this.actions.delete(id);
    this.kicks.delete(id);
  }

  take(ids: readonly string[]): Action[] {
    return ids.map(id => {
      const action = this.actions.get(id) ?? IDLE;
      const kick = this.kicks.delete(id);
      return kick ? { ...action, kick: true } : action;
    });
  }
}
