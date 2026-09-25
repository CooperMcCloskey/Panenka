export const CONTROL_ACTIONS = ['up', 'left', 'down', 'right', 'kick'] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];
export type KeyboardControls = Record<ControlAction, string>; // KeyboardEvent.code per action
export type PlayerControls = [KeyboardControls, KeyboardControls];

const STORAGE_KEY = 'panenka.controls';

export const defaultControls = (): PlayerControls => [
  { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', kick: 'Space' },
  { up: 'KeyO', left: 'KeyK', down: 'KeyL', right: 'Semicolon', kick: 'Enter' },
];

// Falls back to the defaults when storage is unavailable (private window, server render) or holds bad data.
export function loadControls(): PlayerControls {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const valid = (c: unknown): c is KeyboardControls =>
      typeof c === 'object' && c !== null && CONTROL_ACTIONS.every((a) => typeof (c as Record<string, unknown>)[a] === 'string');
    if (Array.isArray(saved) && saved.length === 2 && saved.every(valid)) return [saved[0], saved[1]];
  } catch {}
  return defaultControls();
}

export function saveControls(controls: PlayerControls) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
  } catch {}
}

// If `code` is already bound elsewhere, the two bindings swap so no key does two things.
export function rebind(controls: PlayerControls, player: 0 | 1, action: ControlAction, code: string): PlayerControls {
  const next: PlayerControls = [{ ...controls[0] }, { ...controls[1] }];
  const previous = next[player][action];
  for (const c of next) {
    for (const a of CONTROL_ACTIONS) if (c[a] === code) c[a] = previous;
  }
  next[player][action] = code;
  return next;
}

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Bksp',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', MetaLeft: 'L Cmd', MetaRight: 'R Cmd',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
};

// "KeyW" → "W", "Digit1" → "1", "Numpad5" → "Num 5".
export function keyLabel(code: string): string {
  if (code in NAMED_KEYS) return NAMED_KEYS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}
