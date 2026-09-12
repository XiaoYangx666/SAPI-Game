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
          immutable TraceChunk
                    |
             session sink set
              /          \
             v            v
      TestTraceSink   WorldTraceStore
       (@begame/test)   (World DP)
                            |
                            v
                    ConsoleTraceExporter
                            |
                            v
                Minecraft Content Log / GUI
                            |
                            v
                  @begame/trace-tools
```

`TraceSession` owns ordering and encoding. Gameplay code emits logical events through `TraceScope`. Sink membership is snapshotted when the session starts, so a runtime storage toggle cannot create a deliberately truncated stored session. Sink failures are isolated from game execution.

`@begame/trace-core` holds the platform-independent part of the subsystem: vocabulary, binary codec, chunk container, decoder, schema/session primitives and the console exporter. `@begame/core` adds the Minecraft adapters (`WorldTraceStore`, `TraceManager`) and re-exports trace-core through `@begame/core/trace`, so existing deep imports keep working. `WorldTraceStore` is a history store, not an export transport. `ConsoleTraceExporter` reads a completed history session and emits a copyable Base64 representation on demand. `@begame/trace-tools` is the offline parsing/tooling package and depends only on `@begame/trace-core`.

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
| Event callback | `event.callback_error` |
| Participation | `participation.acquire`, `participation.joined`, `participation.released`, `participation.acquire_rejected` |
| Connection | `player.connect`, `player.disconnect`, `player.reconnect` |
| Offline guard | `disconnect_timeout.started`, `disconnect_timeout.cancelled`, `disconnect_timeout.expired` |
| Runner | `runner.uncaught_error`, `runner.cancelled` |
| Timer | `timer.started`, `timer.expired`, `timer.cancelled` |
| Diagnostic | `debug.message` |

A connection event never implies participation release. `DisconnectTimeoutComponent` emits timeout lifecycle independently and, when configured to release, `GamePlayerManager.leave()` emits a separate `participation.released` with reason `disconnect-timeout`.

`state.subscribe` / `component.subscribe` callbacks are a synchronous contract. Async work belongs in `runner.run(...)`, where failures become `runner.uncaught_error`. A callback that returns a thenable triggers a one-time `debugMode` warning; its Promise rejection is not captured by the Trace Session. An `event.callback_error` marks that an issue happened and turns the event red in the viewer, but it never by itself flips the session status to `crashed`; only a failed game lifecycle does that.

## Automatic emit points

| Owner | Emit point |
| --- | --- |
| `GameManager.startGame` | session begin, created, starting, started, start failure |
| `GameManager.stopGameByKey` | stopping, stopped, disposed, session final status/reason |
| `GameManager.disposeAll` | silent stopping/dispose and `reloaded`/`interrupted` classification |
| `GameEngine` | state push/enter/failure/exit/remove/transition/root changes |
| `GameState` | component attach start/success/failure, detach/error |
| `GamePlayerManager` | participation acquire/join/reject/release and player ref registration |
| `EventManager` | `event.callback_error` when a State/Component subscription callback throws (payload carries the signal name); emitted before the error is rethrown to the underlying signal |
| connection signal bridge | connect/disconnect/reconnect for players already known to a session |
| `DisconnectTimeoutComponent` | timeout start/cancel/expire |
| `RunnerManager` | uncaught async runner error and explicit/lifecycle cancellation |
| `Timer` | start/expire/cancel only; never timer ticks |

The connection bridge is active only while at least one Trace Session exists. This remains true if World DP storage is disabled during an already-running stored session.

## Typed developer events

Developer business events use an event name plus an explicit field schema:

```ts
import { defineTraceEvent, optionalTraceField } from "@begame/core";

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

The session maintains dictionaries/ref tables for strings, players, state instances, component instances and custom event schemas. Custom event ids start at 128. State/component refs are instance refs rather than only class names, so repeated instances of one state/component type remain distinguishable.

Integers use unsigned varint; signed integers use zigzag + varint; floating-point fields use little-endian float64. Event ticks are stored as deltas inside a chunk. Event sequence numbers are implicit from `firstSequence + eventIndex`.

A chunk is immutable after sealing. The default binary target is 20 KiB. A chunk may also rotate when the tick span exceeds the configured threshold. The encoder does not schedule per-tick work solely for tracing.

Error payloads are byte-budgeted because sessions are stored in World Dynamic Properties: `traceError` caps each message (512 B top-level, 256 B nested) and stack (4 KiB top-level, 256 B nested), shares one 8 KiB UTF-8 text budget per error value, limits a serialized error tree to 16 entries and 6 levels, and reports excess `AggregateError.errors` as an `omitted` count. Child errors are serialized before wrapper stacks, so leaf/root-cause stacks win the shared budget. Truncated nodes carry `truncated: true`. `traceError` is also total: hostile thrown values (throwing getters, proxies, throwing `toString`) can never make it throw and replace the original exception at a catch boundary.

The decoder reconstructs session-wide dictionaries in chunk order and exposes logical events. JSON/JSONL is a derived representation only.

## Sink contract

```ts
interface TraceSink {
    onSessionStart?(header: TraceSessionHeader): void | Promise<void>;
    onChunk(chunk: TraceChunk): void | Promise<void>;
    onSessionEnd?(end: TraceSessionEnd): void | Promise<void>;
}
```

Core never awaits a Sink on the gameplay path. Promise rejection and synchronous Sink errors are caught and reported through trace-internal diagnostics only. `TraceManager.setSink()` remains available primarily for test/custom consumers; production world history is exposed separately as `Game.trace.store`.

## Test / file sink

`BEGameTestEngine` installs an in-memory `TestTraceSink` as `env.gameTrace`. The existing `env.trace` remains the harness action trace and is intentionally separate.

`TestTraceSink` can return raw `.begtrace` bytes or decode them for assertions. `FileTraceSink` is Node-only and writes completed `.begtrace` sessions for CI artifacts.

## WorldTraceStore

`WorldTraceStore` persists history directly to Minecraft World Dynamic Properties. It does not depend on SAPI-Pro `DPDataBase`.

Storage is **disabled by default**. Developers can opt in during initialization:

```ts
import { initBEGame } from "@begame/core";

initBEGame({
    traceStore: {
        enabled: true,
        maxSessions: 50,
        maxBytes: 2 * 1024 * 1024,
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
        cleanupIntervalTicks: 6000,
    },
});
```

A boolean is also accepted:

```ts
initBEGame({ traceStore: true });
initBEGame({ traceStore: false });
```

Runtime control is available without reinitializing BEGame:

```ts
Game.trace.store.enable();
Game.trace.store.disable();
Game.trace.store.configure({ maxSessions: 20 });

console.log(Game.trace.store.enabled);
const sessions = Game.trace.store.list();
const latest = Game.trace.store.latest();
```

Runtime toggle semantics are intentionally session-safe:

- disabling stops **new** sessions from being persisted;
- a session accepted before disable continues through its final chunk/footer;
- enabling does not attach storage halfway through a game that already started;
- disabling never deletes existing history.

Reserved DP namespace:

```text
begame.trace.v1.<session>.meta
begame.trace.v1.<session>.0
begame.trace.v1.<session>.1
begame.trace.v1.<session>.2
...
```

Sealed chunk values are Base64. Session metadata records the header, current/final status, committed chunk/event counts and final footer. A stale `running` record discovered when the store is enabled is finalized as `interrupted` with reason `runtime-recovered`, preserving all chunks that had already been sealed.

Retention works at whole-session granularity. Cleanup runs periodically while storage is enabled and after a session completes. Current limits are age, completed-session count and approximate stored Base64 payload bytes. Active sessions are never collected.

Default retention values are 50 sessions, approximately 2 MiB of Base64 chunk payloads, seven days, and a 6000-tick cleanup cadence.

## Console export

Console export is an on-demand transport over stored history:

```ts
// latest completed stored session
Game.trace.exportToConsole();

// explicit historical session
Game.trace.exportToConsole(sessionId);
```

The exporter reconstructs the complete `.begtrace`, Base64-encodes it, and writes warning-level records. The default maximum payload is 24,000 Base64 characters per warning, so ordinary sessions usually fit in one record while larger sessions are automatically split.

Machine marker:

```text
[BEGAME_TRACE:v1:<sessionId>:<part>/<partCount>]<base64>
```

Minecraft Content Log normally wraps that as, for example:

```text
[Scripting][warning]-[BEGAME_TRACE:v1:abc123:1/1]QkVHVAE...
```

The marker deliberately does not depend on Minecraft's surrounding log prefix, because Content Log can contain Localization, Sound and unrelated Scripting messages around it.

## @begame/trace-core

`@begame/trace-core` is the platform-independent Trace package shared by the runtime and tooling:

- vocabulary and constants: session header/end/chunk types, built-in event ids, source kinds;
- codec: varint/zigzag, UTF-8, `BinaryReader`/`BinaryWriter`, `.begtrace` container, chunk encoder/decoder;
- session primitives: `TraceScope`, `TraceSession`, `defineTraceEvent`, `ConsoleTraceExporter`.

It has no `@minecraft/server` dependency and no runtime dependencies at all. `@begame/core` owns the Minecraft adapters (`WorldTraceStore`, `TraceManager`) and re-exports trace-core from `@begame/core/trace`, so `@begame/core/trace/*` deep imports remain valid.

Consumers that install `@begame/core` from a local checkout (`"@begame/core": "file:../begame/packages/core"`) must also declare `@begame/trace-core` with the same version (`file:../begame/packages/trace-core` or the packed tarball). Like all npm `file:` dependencies, the packages are copied into `node_modules`, so re-run `npm install` after rebuilding BEGame.

## @begame/trace-tools

`@begame/trace-tools` is the offline parsing/diagnostic package. Its first feature is extracting Console Trace exports from raw Minecraft Content Log text. It depends only on `@begame/trace-core`, so plain Node.js can import it without installing `@minecraft/server`.

```ts
import {
    collectTraceExports,
    decodeTraceLog,
    extractBegTraceBytes,
} from "@begame/trace-tools";

const sessions = collectTraceExports(contentLogText);
const bytes = extractBegTraceBytes(contentLogText); // latest complete export
const trace = decodeTraceLog(contentLogText);
```

The parser:

- ignores unrelated log lines;
- finds the `BEGAME_TRACE` marker anywhere in the text;
- rejoins multipart exports in order;
- tolerates repeated identical parts;
- rejects conflicting duplicate parts/part counts;
- reports exactly which parts are missing from an incomplete export;
- can select a specific `sessionId` or default to the latest complete export;
- can return raw `.begtrace` bytes or a fully decoded logical session.

Future viewer, summary, timeline, comparison and Agent-facing analysis helpers belong in this package rather than in the Minecraft runtime package.

## Trace Viewer

`packages/trace-viewer` is a local web viewer with a built-in HTTP server. One command starts both:

```shell
npm run viewer
```

Then open `http://127.0.0.1:8787` (override with `PORT=xxxx npm run viewer`). It currently provides decoding and preview only. The UI is a React app (React 19, bundled by rolldown into `packages/trace-viewer/public/build/app.js`). The API is a Hono app (`packages/trace-viewer/server/`, TypeScript) bundled by rolldown into `packages/trace-viewer/dist/server.js` with Hono inlined, so running it still needs no installed dependencies:

- **故事线** (default): the decoded session is grouped into consecutive state phases; events are translated into readable titles, seat/player ids are resolved to names with stable colors, component attach pairs are merged, and times are shown relative to session start.
- **概览**: session cards, participant/seat cards with change history, failure/error events, state timeline and event-type histogram.
- **原始事件**: the full event table with owning-state scope, text filter, source-kind filter and payload inspector.
- paste a Content Log, or drop a `.log` / `.txt` / raw `.begtrace` file; multiple exports in the same log can be switched with missing parts reported;
- every view can be exported as JSON.

Server API:

```text
GET  /api/health            → { ok, name, version }
POST /api/decode            → decoded session JSON; body is log text or raw .begtrace bytes
POST /api/decode?session=ID → select a specific export
```

Routes reserved for the future live pipeline are marked in `server/app.ts`:

```text
POST /api/ingest            → Minecraft pushes trace data
GET  /api/live              → browser subscribes via SSE
```

Real-time Minecraft connections, live streaming and analysis are intentionally not implemented yet. The viewer imports only `@begame/trace-tools` and `@begame/trace-core`, so the future live adapter can feed the same decode endpoint without changing the UI.

## Deferred adapters / tools

Still deferred:

- `/connect` development bridge
- `@minecraft/server-net` HTTP/WebSocket upload adapter
- live/real-time Trace Viewer updates
- diagnostic high-frequency mode
- rich Agent analyzer/query API
- pin/bug-report retention policy

They can build on the existing `.begtrace`, Store and decoder contracts without changing gameplay lifecycle tracing.
