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

  constructor(private controls: KeyboardControls, private onChange?: () => void) { }

  getAction(): Action {
    const action = this.peekAction();
    this.kicked = false;
    return action;
  }

  // Inspect held keys and pending taps without consuming a pending kick.
  peekAction(): Action {
    const key = (code: string) => (this.held.has(code) ? 1 : 0);
    const { up, left, down, right, kick } = this.controls;
    return {
      moveX: (key(right) - key(left)) as Action['moveX'],
      moveY: (key(down) - key(up)) as Action['moveY'],
      kick: this.kicked || this.held.has(kick),
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!Object.values(this.controls).includes(e.code) || this.held.has(e.code)) return;
    this.held.add(e.code);
    if (e.code === this.controls.kick) this.kicked = true;
    this.onChange?.();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (this.held.delete(e.code)) this.onChange?.();
  };
  private onBlur = () => {
    this.held.clear();
    this.kicked = false;
    this.onChange?.();
  };

  attach() {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.onBlur);
  }

  detach() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.onBlur)
    this.held.clear();
    this.kicked = false;
  }
}
