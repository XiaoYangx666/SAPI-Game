/**
 * Trace contract owned by @begame/core.
 *
 * Core emits trace events on its hot path, but it must not import
 * `@begame/trace-core` to do so: that package carries the session machinery,
 * the binary codec and the world store, and a game that never enables tracing
 * would pay for all of it. Everything here is dependency-free (type-only
 * imports are erased at build time), so importing the runtime never pulls the
 * trace implementation.
 *
 * The numeric ids below are the wire format. They MUST stay identical to
 * `BuiltinTraceEventType` in @begame/trace-core; tests/trace-contract.test.mjs
 * asserts that, so drift fails CI instead of silently corrupting traces.
 */
import type {
    TraceEventSchema,
    TraceInputValue,
    TracePayload,
    TraceSchemaShape,
    TraceSource,
} from "@begame/trace-core";

export type { TraceInputValue };

export const BuiltinTraceEventType = {
    GameCreated: 1,
    GameStarting: 2,
    GameStarted: 3,
    GameStartFailed: 4,
    GameStopping: 5,
    GameStopped: 6,
    GameDisposed: 7,

    StatePush: 16,
    StateEnter: 17,
    StateExit: 18,
    StateRemove: 19,
    StateTransition: 20,
    StateRootChanged: 21,
    StateEnterFailed: 22,

    ComponentAttachStarted: 32,
    ComponentAttached: 33,
    ComponentDetached: 34,
    ComponentAttachFailed: 35,
    ComponentError: 36,

    EventCallbackError: 40,

    ParticipationAcquire: 48,
    ParticipationJoined: 49,
    ParticipationReleased: 50,
    ParticipationAcquireRejected: 51,

    PlayerConnected: 64,
    PlayerDisconnected: 65,
    PlayerReconnected: 66,

    DisconnectTimeoutStarted: 80,
    DisconnectTimeoutCancelled: 81,
    DisconnectTimeoutExpired: 82,

    RunnerUncaughtError: 96,
    RunnerCancelled: 97,

    TimerStarted: 112,
    TimerExpired: 113,
    TimerCancelled: 114,

    DebugMessage: 127,
} as const;

export type BuiltinTraceEventType =
    (typeof BuiltinTraceEventType)[keyof typeof BuiltinTraceEventType];

/**
 * The structured trace scope core talks to. `@begame/trace-core`'s `TraceScope`
 * satisfies this structurally, so the real implementation needs no adapter.
 */
export interface TraceScopeLike {
    readonly enabled: boolean;
    readonly source: TraceSource;
    builtin(
        type: BuiltinTraceEventType,
        payload?: Record<string, TraceInputValue>
    ): void;
    emit<T extends TraceSchemaShape>(
        schema: TraceEventSchema<T>,
        payload: TracePayload<T>
    ): void;
    debug(message: string, fields?: Record<string, TraceInputValue>): void;
    // Returns trace-core's branded player reference, which is part of
    // TraceInputValue; using that here avoids naming an unexportable internal.
    player(id: string, name?: string): TraceInputValue;
}

/** Used whenever no trace session exists; every method is intentionally empty. */
export const NOOP_TRACE_SCOPE: TraceScopeLike = {
    enabled: false,
    source: { kind: "system" },
    builtin() {},
    emit() {},
    debug() {},
    player(id: string) {
        return id;
    },
};

/**
 * Error payloads are marked, not serialized, on the emitting side.
 *
 * `traceError` recurses through `cause` chains and `AggregateError.errors`
 * under UTF-8 byte budgets, which is real work that must not happen when no
 * session is listening. Core therefore hands over the raw thrown value and lets
 * the trace implementation serialize it, so the no-trace path pays nothing.
 *
 * The marker is a plain string key rather than a shared class because core and
 * trace-core must agree on it without either importing the other.
 */
export const TRACE_ERROR_MARKER = "begame.trace.error";

export interface TraceErrorPayload {
    readonly marker: typeof TRACE_ERROR_MARKER;
    readonly error: unknown;
}

/**
 * Marks a thrown value for lazy serialization by the trace implementation.
 *
 * The return type is `TraceInputValue` because the marker travels inside a
 * normal payload; no payload value type can describe an opaque deferred value,
 * so the cast is deliberate and evaluated only by `@begame/trace-core`.
 */
export function traceErrorValue(error: unknown): TraceInputValue {
    return { marker: TRACE_ERROR_MARKER, error } as unknown as TraceInputValue;
}

export function isTraceErrorPayload(value: unknown): value is TraceErrorPayload {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as TraceErrorPayload).marker === TRACE_ERROR_MARKER &&
        "error" in value
    );
}
