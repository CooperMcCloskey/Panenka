import { describe, expect, it } from 'vitest';
import { IDLE } from '$lib/engine/actions';
import { InputBuffer } from './input-buffer';

describe('server input buffer', () => {
  it('preserves a quick kick press/release for one tick with the latest movement', () => {
    const buffer = new InputBuffer();
    buffer.set('blue', { ...IDLE, kick: true });
    buffer.set('blue', { ...IDLE, moveX: 1 });
    expect(buffer.take(['blue', 'orange'])).toEqual([{ ...IDLE, moveX: 1, kick: true }, IDLE]);
    expect(buffer.take(['blue'])).toEqual([{ ...IDLE, moveX: 1 }]);
  });

  it('keeps held kicks active and clears input when players disconnect or leave', () => {
    const buffer = new InputBuffer();
    buffer.set('blue', { ...IDLE, kick: true });
    expect(buffer.take(['blue'])[0].kick).toBe(true);
    expect(buffer.take(['blue'])[0].kick).toBe(true);
    buffer.release('blue');
    expect(buffer.take(['blue'])).toEqual([IDLE]);
    buffer.set('blue', { ...IDLE, moveY: 1, kick: true });
    buffer.remove('blue');
    expect(buffer.take(['blue'])).toEqual([IDLE]);
  });
});
