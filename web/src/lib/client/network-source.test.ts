import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS } from '$lib/engine/constants';
import { physicsStep } from '$lib/engine/physics';
import { createState } from '$lib/engine/state';
import { vec } from '$lib/engine/vec';
import { encodeState } from '$lib/shared/codec';
import { KeyboardController } from '$lib/shared/controller';
import { NEW_LOBBY_STATE, type ClientMessage, type ServerMessage } from '$lib/shared/protocol';
import { NetworkSource } from './network-source';

class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  bufferedAmount = 0;
  messages: ClientMessage[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (() => void) | null;
  constructor() { Socket.latest = this; }
  send(text: string) { this.messages.push(JSON.parse(text)); }
  close() { this.readyState = 3; }
  receive(message: ServerMessage) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(prediction = true) {
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('addEventListener', vi.fn());
  vi.stubGlobal('removeEventListener', vi.fn());
  vi.stubGlobal('window', {
    location: { href: 'http://localhost:5173/lobby/online/test' },
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  });
  const now = { value: 0 };
  vi.spyOn(performance, 'now').mockImplementation(() => now.value);
  vi.spyOn(KeyboardController.prototype, 'getAction').mockReturnValue({ ...IDLE, moveX: 1 });
  const lobby = {
    ...NEW_LOBBY_STATE(), rev: 1, started: true, playerMapping: ['blue', 'orange'],
    players: { blue: { username: 'You', team: 'blue' as const }, orange: { username: 'Other', team: 'orange' as const } },
  };
  const source = new NetworkSource('test', 'token', lobby, () => {}, () => {}, { prediction });
  source.start();
  const socket = Socket.latest;
  socket.onopen?.();
  // Even an initial lobby message with the same revision initializes ownership.
  socket.receive({ type: 'lobby', lobbyState: lobby, controlledPlayerIds: ['blue'] });
  const state = createState({ blue: 1, orange: 1 }, lobby.rules);
  state.match.phase = { kind: 'play' };
  socket.receive({ type: 'snapshot', state: Array.from(encodeState(state)), acknowledgedSequence: 0 });
  return { source, socket, now, state, lobby };
}

describe('NetworkSource smoothing integration', () => {
  it('sends and predicts the same inputs, while remote bodies and match results stay authoritative', () => {
    const { source, socket, now, state } = setup();
    try {
      now.value = TICK_MS * 5.5;
      source.update(now.value);
      const inputs = socket.messages.filter(m => m.type === 'input');
      expect(inputs.map(m => m.sequence)).toEqual([1, 2, 3, 4, 5]);
      const drawn = source.currentState();
      expect(drawn.world.players[0].pos.x).toBeGreaterThan(state.world.players[0].pos.x);
      expect(drawn.world.players[1].pos).toEqual(state.world.players[1].pos);
      expect(drawn.world.ball).toEqual(state.world.ball);
      expect(drawn.match).toEqual(state.match);

      const world = physicsStep(physicsStep(state.world, [inputs[0].actions.blue, IDLE]), [inputs[1].actions.blue, IDLE]);
      const next = { ...state, world, match: { ...state.match, tick: 2 } };
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(next)), acknowledgedSequence: 2 });
      expect(source.currentState().world.players[0].pos.x).toBeCloseTo(drawn.world.players[0].pos.x, 10);
      now.value += 1000;
      const sent = socket.messages.length;
      source.update(1000);
      expect(socket.messages.length).toBe(sent); // no catch-up input flood after a suspended tab
    } finally { source.stop(); }
  });

  it('can disable prediction and clears history when returning to the lobby or starting a new match', () => {
    const { source, socket, now, state, lobby } = setup(false);
    try {
      now.value = TICK_MS * 5;
      source.update(now.value);
      expect(source.currentState().world.players[0].pos).toEqual(state.world.players[0].pos);
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 2, started: false }, controlledPlayerIds: ['blue'] });
      expect(source.currentState().match.tick).toBe(0);
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 3 }, controlledPlayerIds: ['blue'] });
      const restarted = { ...state, world: { ...state.world, ball: { ...state.world.ball, pos: vec(1, 0.5) } } };
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(restarted)), acknowledgedSequence: 0 });
      expect(source.currentState().world.ball.pos.x).toBe(1);
      source.stop();
      expect(window.removeEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(socket.messages.filter(m => m.type === 'input').at(-1)!.actions.blue).toEqual(IDLE);
      expect(source.currentState().match.tick).toBe(0);
    } finally { source.stop(); }
  });
});
