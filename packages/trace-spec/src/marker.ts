/**
 * Marker used to hand errors across the runtime/trace boundary without
 * serializing them yet.
 *
 * `traceError` in `@begame/trace` recurses through `cause` chains and
 * `AggregateError.errors` under UTF-8 byte budgets. That is real work which must
 * not happen when no session is listening, so `@begame/core` emits the raw
 * thrown value wrapped in this marker and the trace implementation resolves it
 * during payload normalization.
 */
export const TRACE_ERROR_MARKER = "begame.trace.error";

export interface TraceErrorPayload {
    readonly marker: typeof TRACE_ERROR_MARKER;
    readonly error: unknown;
}

/** Marks a thrown value for lazy serialization by the trace implementation. */
export function traceErrorValue(error: unknown): TraceErrorPayload {
    return { marker: TRACE_ERROR_MARKER, error };
}

export function isTraceErrorPayload(value: unknown): value is TraceErrorPayload {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as TraceErrorPayload).marker === TRACE_ERROR_MARKER &&
        "error" in value
    );
}
