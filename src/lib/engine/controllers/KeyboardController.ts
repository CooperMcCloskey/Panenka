import type { Action, Controller } from "../types";

export type KeyboardControls = {up: string, left: string,  down: string,  right: string,  kick: string}

export class KeyboardController implements Controller{
  private keysHeld = new Set<string>();
  private controls: KeyboardControls;

  constructor(controls: KeyboardControls){
    this.controls = controls
  }

  getAction(): Action {
    return {
      moveX: (this.keysHeld.has(this.controls.right) ? 1 : 0) + (this.keysHeld.has(this.controls.left) ? -1 : 0) as -1 | 0 | 1,
      moveY: (this.keysHeld.has(this.controls.up) ? -1 : 0) + (this.keysHeld.has(this.controls.down) ? 1 : 0) as -1 | 0 | 1,
      kick: this.keysHeld.has(this.controls.kick)
    }
  }

  private keyDownEventListener = (e: KeyboardEvent)=>{this.keysHeld.add(e.code)}
  private keyUpEventListener = (e: KeyboardEvent)=>{this.keysHeld.delete(e.code)}
  attach(): void { addEventListener("keydown", this.keyDownEventListener); addEventListener("keyup", this.keyUpEventListener)}
  detach(): void { removeEventListener("keydown", this.keyDownEventListener); removeEventListener("keyup", this.keyUpEventListener)}
}