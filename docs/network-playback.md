# Network playback and prediction

The server remains the authority and runs the existing 60 Hz engine. No physics
constants, match rules, state codec, hosting, or transport have changed. New
features live in small modules around the existing input and snapshot paths.

## Research and design

Research was completed before implementation:

- [Gabriel Gambetta: prediction and reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html): identify inputs, restore an authoritative state, and replay inputs not yet acknowledged.
- [Glenn Fiedler: networked physics](https://gafferongames.com/post/networked_physics_2004/): physics prediction needs input history and correction; interacting dynamic bodies make independent character prediction insufficient.
- [Glenn Fiedler: state synchronization](https://gafferongames.com/post/state_synchronization/): include held inputs, restore exact physics state, and apply correction smoothing only when drawing.

Panenka predicts **all players and the ball together**, rather than inserting a
predicted local player into a delayed opponent/ball world. Every predicted tick
uses `physicsStep`, including its substeps, collision order, impulses, mass changes,
kick cooldowns and kick rearming. Remote players use their latest server-reported
held actions. They are estimates: a remote turn or kick that has not arrived yet
can cause a correction. Prediction cannot guarantee identical future results.

## Input and acknowledgement path

1. Keyboard changes enter local prediction immediately, including changes waiting
   for a send slot. Prediction reads held keys independently of the sender's kick
   latch, so drawing cannot consume a short tap before transmission.
2. Successful input sends receive increasing sequence numbers. Each number is
   associated locally with the input changes it covers.
3. `InputAcknowledgements` records accepted messages but acknowledges them only
   after a server simulation tick consumes the input buffer. Newer coalesced inputs
   acknowledge earlier messages too. Duplicate and stale sequences are ignored.
4. Snapshots carry the recipient's last applied sequence, applied tick, server
   queue duration, RTT, held actions in player order and server frame/timer timing.
   Session tokens are never included. The numeric physics codec stays unchanged.
5. `ClientPrediction` restores the complete snapshot, drops acknowledged local
   changes, and replays the remaining changes at fixed simulation ticks. Short
   kicks use the same `InputBuffer` latch as the server. Releases accompanying a
   coalesced transport kick stay pending until the release packet is acknowledged.

The snapshot arrival clock trails simulation by downstream delivery time. Adding
the measured RTT gives an estimate of the tick at which a new local input will
reach the server (including an upstream lead). This assumes the recent path is
representative; a new snapshot corrects estimation errors. Prediction is bounded
to 250 ms beyond the latest snapshot, then holds the world. Input history is also
bounded; overflow falls back to interpolation until acknowledged.

## Collision-safe presentation

Reconciliation compares old and corrected predictions at the same tick. Small
position differences become drawing offsets, decaying with a 40 ms half-life.
Errors over 0.12 world units snap. Velocities and kick state always come directly
from the resimulated physics. Fractional render ticks blend positions between
predicted fixed ticks. The existing contact guard corrects contacts after blending
and drawing offsets, including posts and walls. Its results never enter replay.

Scores and phase transitions come from the latest server snapshot. Countdown
physics stays frozen. A predicted goal is never committed; goal-pause prediction
stops before kickoff, and actual kickoff/lineup resets clear obsolete prediction.
Spectators and snapshots without metadata use authoritative interpolation.

## Adaptive fallback buffer

- Adaptive startup: 25 ms. Minimum: one snapshot interval, currently 16.7 ms.
- Delivery clock baseline: earliest offset in the rolling two-second window.
- Buffer jitter budget: 95th percentile offset minus the baseline. Raw max/min
  jitter is still available separately in diagnostics.
- Maximum target: 100 ms. Recovery: 30 ms per second.
- Each new underrun adds one interval of reserve. Reserve is held for one second
  and then decays. Frequent gaps keep reserve elevated.
- Actual interpolation playback corrects speed by at most 5%, never rewinds, and
  holds when it exhausts snapshots. A percentile budget deliberately permits rare
  gaps instead of preserving every isolated spike for several seconds.

## Diagnostics

`NetworkSource.diagnostics` returns measurements without adding UI:

| Field | Meaning |
| --- | --- |
| `rttMs` | Server WebSocket ping RTT; input-confirmation timing minus server queue is the initial fallback until a ping measurement is available. Ping cadence remains 15 seconds. |
| `inputSendDelayMs` | First coalesced key change to successful transmission. |
| `inputAckMs` | Successful send to snapshot confirming server consumption, including server queue and any skipped snapshots. |
| `serverInputQueueMs` | Receipt to consumption of the latest acknowledged message, measured on the server. |
| `inputToAuthoritativeMs` | Key change to the reference interpolation timeline reaching its acknowledged tick. This is distinct from predicted local response. |
| `localResponseMs` | Latest local change to the frame rendering its predicted physics tick; this measures presentation sampling, not physical monitor scanout. |
| `snapshotGapMs` | Interval between accepted snapshots. |
| `frameMs` | Interval between browser playback samples. |
| `serverFrameMs` / `serverTickDelayMs` | Room update interval / scheduler lateness. |
| `targetDelayMs` / `playbackDelayMs` | Target and actual delay of the authoritative fallback timeline. |
| `jitterMs` / `bufferJitterMs` | Raw delivery spread / percentile delivery budget. |
| `predictionLeadMs` / `predictedTick` | Prediction horizon and drawn simulation tick. |
| `predictionError` | Maximum body-position difference at the most recent reconciliation, in world units. |
| `reconciliations` / `pendingInputChanges` | Correction count / retained local input changes. |
| `underruns` / `queuedInputBytes` | Fallback buffer exhaustion episodes / browser WebSocket send queue. |

All elapsed durations are computed on one machine's monotonic clock. Client and
server absolute timestamps are never subtracted. Input confirmation includes
snapshot delivery; it cannot isolate one-way network latency without additional
clock synchronization. Heartbeat input sends do not overwrite key-change metrics.

## Configuration and validation

The optional sixth argument to `NetworkSource` accepts interpolation settings and
`prediction: false | Partial<PredictionSettings>`. To compare the previous fixed
playback path, use `{ prediction: false, adaptiveDelay: false }`. An explicit
`delayMs` sets fixed buffering unless adaptive delay is also explicitly enabled.

Tests exercise the shared engine's player/player, player/ball, wall and post
impulses; short taps and release acknowledgement; rollback and held inputs;
multiple controlled players; late, bunched and skipped snapshots; crowded maximum
teams; countdowns and kickoff resets; bounded outages/history; metrics and the
keyboard-to-prediction path. These are deterministic simulations, not a claim
about measured production RTT or performance on every browser/device.
