# BEGame Game Trace / Session Trace

## Scope

Game Trace is a structured, per-game execution history. It is not a console logger and it is not an event-sourcing API. One `GameEngine` instance owns one `TraceSession` from construction/start through stop/dispose. Core tracing is deliberately low-volume: lifecycle, participation, connection, timeout, runner/timer failures/cancellation, and developer business events.

High-frequency world activity (tick, position, block changes, effects, all Minecraft events) is not captured by default. A future diagnostic mode may add opt-in detail without changing the core format.

## Runtime architecture

```text
Game / State / Component / Participation / Runner / Timer
                    |
                    v
               TraceScope
                    |
                    v
               TraceSession
        sequence + tick + ref tables
                    |
                    v
          BinaryTraceEncoder
                    |
                    v
          active TraceChunk
         size / tick-span seal
                    |
                    v
                TraceSink
```

`TraceSession` owns ordering and encoding. Gameplay code only emits logical events through `TraceScope`. A Sink receives immutable binary chunks and session start/end metadata. Sink failures are caught by Trace Core and must never escape into game lifecycle execution.

The current phase ships `TestTraceSink` and Node-only `FileTraceSink` in `@begame/test`. Network and world persistence adapters are intentionally not dependencies of `@begame/core`.

## Session model

A session header contains:

- `sessionId`, `formatVersion`
- `gameType`, `gameKey`, `gameInstanceId`
- optional BEGame / pack version
- start tick and wall time
- a bounded structural snapshot of the initial config

A session footer contains:

- status: `completed | aborted | crashed | interrupted | reloaded`
- end tick and wall time
- end reason
- event and chunk counts

Every event has a strictly increasing `sequence`, a tick, a type, a source, and a structured payload. Sequence is the canonical within-session order; wall-clock time is not used to order same-tick events.

## Built-in event families

Core reserves type ids below 128. Current families are:

| Family | Events |
| --- | --- |
| Game | `game.created`, `game.starting`, `game.started`, `game.start_failed`, `game.stopping`, `game.stopped`, `game.disposed` |
| State | `state.push`, `state.enter`, `state.exit`, `state.remove`, `state.transition`, `state.root_changed`, `state.enter_failed` |
| Component | `component.attach_started`, `component.attached`, `component.detached`, `component.attach_failed`, `component.error` |
| Participation | `participation.acquire`, `participation.joined`, `participation.released`, `participation.acquire_rejected` |
| Connection | `player.connect`, `player.disconnect`, `player.reconnect` |
| Offline guard | `disconnect_timeout.started`, `disconnect_timeout.cancelled`, `disconnect_timeout.expired` |
| Runner | `runner.uncaught_error`, `runner.cancelled` |
| Timer | `timer.started`, `timer.expired`, `timer.cancelled` |
| Diagnostic | `debug.message` |

A connection event never implies participation release. `DisconnectTimeoutComponent` emits timeout lifecycle independently and, when configured to release, `GamePlayerManager.leave()` emits a separate `participation.released` with reason `disconnect-timeout`.

## Automatic emit points

| Owner | Emit point |
| --- | --- |
| `GameManager.startGame` | session begin, created, starting, started, start failure |
| `GameManager.stopGameByKey` | stopping, stopped, disposed, session final status/reason |
| `GameManager.disposeAll` | silent stopping/dispose and `reloaded`/`interrupted` classification |
| `GameEngine` | state push/enter/failure/exit/remove/transition/root changes |
| `GameState` | component attach start/success/failure, detach/error |
| `GamePlayerManager` | participation acquire/join/reject/release and player ref registration |
| connection signal bridge | connect/disconnect/reconnect for players already known to a session |
| `DisconnectTimeoutComponent` | timeout start/cancel/expire |
| `RunnerManager` | uncaught async runner error and explicit/lifecycle cancellation |
| `Timer` | start/expire/cancel only; never timer ticks |

The connection bridge remains lazy: it subscribes to Minecraft connection events only while a Trace Sink is configured and at least one Trace Session is active.

## Typed developer events

Developer business events use an event name plus an explicit field schema:

```ts
const eliminated = defineTraceEvent("pof.player.eliminated", {
    victim: "player",
    killer: optionalTraceField("player"),
    aliveCount: "uint",
    reason: "string",
});

this.trace.emit(eliminated, {
    victim: victim.id,
    killer: killer?.id,
    aliveCount: 2,
    reason: "entityDie",
});
```

Supported first-phase scalar field types are `boolean`, `uint`, `int`, `number`, `string`, and `player`. Optional fields are encoded with a bitset. Schema name collisions with a different shape are rejected inside Trace Core and reported as an internal trace error rather than breaking game execution.

`trace.debug(message, fields)` remains available for occasional diagnostics, but business semantics should use typed events.

## Binary format

`.begtrace` and `TraceChunk` are binary, not JSON.

The session maintains dictionaries/ref tables for:

- strings
- players
- state instances
- component instances
- custom event schemas

Custom event ids start at 128. State/component refs are instance refs rather than only class names, so repeated instances of one state/component type remain distinguishable.

Integers use unsigned varint; signed integers use zigzag + varint; floating-point fields use little-endian float64. Event ticks are stored as deltas inside a chunk. Event sequence numbers are implicit from `firstSequence + eventIndex`.

A chunk is immutable after sealing. The default binary target is 20 KiB, deliberately below the eventual world-DP binary budget. A chunk may also rotate when the tick span exceeds the configured threshold. The encoder does not schedule per-tick work solely for tracing.

The decoder reconstructs session-wide dictionaries in chunk order and exposes logical events. JSON/JSONL is a derived export only.

## Sink contract

```ts
interface TraceSink {
    onSessionStart?(header: TraceSessionHeader): void | Promise<void>;
    onChunk(chunk: TraceChunk): void | Promise<void>;
    onSessionEnd?(end: TraceSessionEnd): void | Promise<void>;
}
```

Core never awaits a Sink on the game path. Promise rejection and synchronous Sink errors are caught and reported through trace-internal diagnostics only. Future network adapters must provide their own bounded queue/batching and must not block gameplay.

## Test / file sink

`BEGameTestEngine` installs an in-memory `TestTraceSink` as `env.gameTrace`. The existing `env.trace` remains the harness action trace and is intentionally separate.

`TestTraceSink` can return the raw `.begtrace` bytes or decode them for assertions. `FileTraceSink` is Node-only and writes completed `.begtrace` sessions for CI artifacts. A future Vitest helper can automatically save a session on failed E2E tests without changing Core.

## World Persistent Sink design (next phase)

World persistence will be implemented as a dedicated append-only `WorldTraceStore`; it will not use SAPI-Pro `DPDataBase`.

Core hands a sealed `Uint8Array` chunk to the adapter. The adapter Base64-encodes it and writes ASCII to Dynamic Properties. The target encoded value is about 28–30 KiB maximum; the current 20 KiB default binary chunk encodes to roughly 26.7 KiB, leaving margin below the observed ~32767-byte DP string ceiling.

Reserved namespace:

```text
begame.trace.v1.<session>.meta
begame.trace.v1.<session>.0
begame.trace.v1.<session>.1
begame.trace.v1.<session>.2
...
```

The small `meta` record stores format version, status, chunk count, game identity, start/end tick and wall time, and end reason. Sealed chunk properties are never rewritten. Only the session meta advances as chunks are committed and when status changes.

On world load, the store scans `world.getDynamicPropertyIds()` for `begame.trace.v1.*.meta`. A previous `running` session is classified as interrupted before new sessions start. This supports BDS crash, watchdog kill, script reload, and forced shutdown diagnosis while preserving every already sealed chunk.

GC will operate at whole-session granularity, not individual chunk mutation. Planned policy inputs are recent-session count, total stored bytes, age, and a `pinned/bugReport` marker. Pinned sessions are never automatically collected.

## Deferred adapters

The following are intentionally outside phase 1:

- `/connect` development bridge
- `@minecraft/server-net` HTTP/WebSocket adapter
- Trace Viewer UI
- diagnostic high-frequency mode
- rich Agent analyzer/query API

They consume the same `TraceSink` / decoder contracts and therefore do not require Trace Core lifecycle changes.

## Agent-facing evolution

The decoder is the stable base for later APIs such as `getSessionSummary`, state/player/component timelines, error lookup, events-around-sequence, and normal-vs-failed session comparison. These APIs query `.begtrace` directly; they do not require materializing an entire JSON document first.
