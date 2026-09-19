/**
 * BEGame Trace runtime.
 *
 * `@begame/core` carries no trace implementation: its hot path only needs the
 * vocabulary from `@begame/trace-spec` and an inert runtime. This package
 * provides the real one, and the consumer wires the two together at its own
 * composition root:
 *
 * ```ts
 * import { initBEGame } from "@begame/core";
 * import { createTraceRuntime } from "@begame/trace";
 *
 * initBEGame({ trace: createTraceRuntime(), traceStore: true });
 * ```
 *
 * That is a value call rather than a module-level side effect on purpose. A
 * bundler cannot eliminate it, so "I want tracing" is stated where the consumer
 * can read it, `@begame/core` needs no `sideEffects` allowance to keep it alive,
 * and installation does not depend on which module was evaluated first.
 */
import { system } from "@minecraft/server";
import type { TraceSessionOptions } from "@begame/trace-core";
import { TraceManager } from "./manager";

export * from "@begame/trace-core";
export * from "./manager";
export * from "./worldStore";

export interface CreateTraceRuntimeOptions extends TraceSessionOptions {
    /** Tick source used to stamp events. Defaults to `system.currentTick`. */
    readonly tick?: () => number;
}

/**
 * Builds the trace runtime to hand to `@begame/core`.
 *
 * Internal trace failures are reported through `onInternalError` and never
 * propagate into gameplay; the default writes to the Content Log so a broken
 * sink is visible during development.
 */
export function createTraceRuntime(
    options: CreateTraceRuntimeOptions = {}
): TraceManager {
    const { tick, ...sessionOptions } = options;
    return new TraceManager(tick ?? (() => system.currentTick), {
        onInternalError(error) {
            console.error("[BEGame] Trace internal error:", error);
        },
        ...sessionOptions,
    });
}
