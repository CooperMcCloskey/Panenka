import type { KeyboardControls } from '$lib/client/bindings';
import type { Action, GameState } from '$lib/engine/types';

// Chooses one player's action each tick: keyboard, network input, or an AI policy.
export interface Controller {
  getAction(state: GameState): Action;
  attach?(): void;
  detach?(): void;
}

export class KeyboardController implements Controller {
  private kicked = false;
  private held = new Set<string>();

  constructor(private controls: KeyboardControls) { }

  getAction(): Action {
    const kicked = this.kicked;
    this.kicked = false;

    const key = (code: string) => (this.held.has(code) ? 1 : 0);
    const { up, left, down, right, kick } = this.controls;
    return {
      moveX: (key(right) - key(left)) as Action['moveX'],
      moveY: (key(down) - key(up)) as Action['moveY'],
      kick: kicked || this.held.has(kick),
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {this.held.add(e.code); if(e.code === this.controls.kick) this.kicked = true;} 
  private onKeyUp = (e: KeyboardEvent) => this.held.delete(e.code);
  private onBlur = () => this.held.clear();

  attach() {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.onBlur);
  }

  detach() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.onBlur)
  }
}
