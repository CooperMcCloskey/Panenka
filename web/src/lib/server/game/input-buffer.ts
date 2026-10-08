import { NETCODE_SETTINGS, type SequencedInput } from '$lib/shared/netcode';

// Consume at most one input frame per server tick, so input frequency cannot
// speed up physics and acknowledgements refer to simulated inputs, not received ones.
export class InputBuffer {
  private queue: SequencedInput[] = [];
  private receivedSequence = 0;
  acknowledgedSequence = 0;

  constructor(private maxQueuedInputs: number = NETCODE_SETTINGS.maxQueuedInputs) {}

  push(input: SequencedInput) {
    if (input.sequence <= this.receivedSequence) return;
    this.receivedSequence = input.sequence;
    this.queue.push(input);
    // Supersede old queued commands if a stalled client delivers a large burst.
    if (this.queue.length > this.maxQueuedInputs) this.queue.shift();
  }

  consume(): SequencedInput | undefined {
    const input = this.queue.shift();
    if (input) this.acknowledgedSequence = input.sequence;
    return input;
  }
}
