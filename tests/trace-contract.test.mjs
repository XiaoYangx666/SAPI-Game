import { expect, test } from "vitest";
// Core's own copy of the wire vocabulary. It exists so the runtime never has to
// import @begame/trace-core; these assertions are what make that duplication safe.
import {
    BuiltinTraceEventType as CoreEventType,
    TRACE_ERROR_MARKER,
    isTraceErrorPayload,
    traceErrorValue,
} from "../packages/core/dist/trace/contract.js";
import { BuiltinTraceEventType as TraceCoreEventType } from "../packages/trace-core/dist/types.js";

test("core's trace event ids match @begame/trace-core exactly", () => {
    const coreKeys = Object.keys(CoreEventType).sort();
    // A TypeScript enum also carries reverse numeric keys; compare names only.
    const traceCoreKeys = Object.keys(TraceCoreEventType)
        .filter((key) => Number.isNaN(Number(key)))
        .sort();

    expect(coreKeys).toEqual(traceCoreKeys);
    // Guard against the comparison passing vacuously if both sides ever end up
    // empty (a bad import would otherwise look like agreement).
    expect(coreKeys.length).toBeGreaterThan(30);

    const mismatched = coreKeys.filter(
        (key) => CoreEventType[key] !== TraceCoreEventType[key]
    );
    expect(mismatched).toEqual([]);
});

test("core's error marker is what the trace implementation resolves", () => {
    // The literal is duplicated between core and trace-core because neither may
    // import the other; pinning it here fails CI if either side drifts.
    expect(TRACE_ERROR_MARKER).toBe("begame.trace.error");

    const thrown = new Error("contract-boom");
    const marker = traceErrorValue(thrown);
    expect(isTraceErrorPayload(marker)).toBe(true);
    expect(marker.marker).toBe(TRACE_ERROR_MARKER);
    expect(marker.error).toBe(thrown);

    // Lookalikes must not be mistaken for deferred errors.
    expect(isTraceErrorPayload(undefined)).toBe(false);
    expect(isTraceErrorPayload(null)).toBe(false);
    expect(isTraceErrorPayload("begame.trace.error")).toBe(false);
    expect(isTraceErrorPayload({ marker: "other" })).toBe(false);
    expect(isTraceErrorPayload({ error: thrown })).toBe(false);
    expect(isTraceErrorPayload([{ marker: TRACE_ERROR_MARKER }])).toBe(false);
});

test("traceErrorValue stays synchronous and total", () => {
    // Core calls this on catch boundaries, so it must never throw and must never
    // touch the thrown value beyond holding a reference to it.
    const hostile = new Proxy(
        {},
        {
            get() {
                throw new Error("hostile getter");
            },
        }
    );
    for (const value of [hostile, undefined, null, "plain", 42, Symbol("s")]) {
        expect(() => traceErrorValue(value)).not.toThrow();
    }
});
