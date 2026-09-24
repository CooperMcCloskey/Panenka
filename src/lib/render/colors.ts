const COLOR_NAMES = ['green0', 'green1', 'pitchLines', 'white', 'black', 'orange', 'blue'] as const;
export type Colors = Record<(typeof COLOR_NAMES)[number], string>;

export const colors = Object.fromEntries(COLOR_NAMES.map((k) => [k, ''])) as Colors;

// Read the CSS color variables (e.g. --blue) visible to `el` into `colors`. Call once
// the element is in the DOM, and again if the theme changes.
export function loadColors(el: Element) {
  const s = getComputedStyle(el);
  for (const k of COLOR_NAMES) colors[k] = s.getPropertyValue(`--${k}`).trim();
}
