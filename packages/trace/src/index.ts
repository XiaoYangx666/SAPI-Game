/**
 * BEGame Trace for Minecraft.
 *
 * This package is the *binding*, not the logic. The sessions, the history store
 * and the codec all live in the platform-independent `@begame/trace-core`; all
 * that is Minecraft-specific is the storage substrate in `./minecraft.ts` and
 * the runtime assembly below.
 *
 * `@begame/core` carries no trace implementation: its hot path only needs the
 * vocabulary from `@begame/trace-spec` and an inert runtime. The consumer wires
 * the two together at its own composition root:
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
import { TraceManager, type TraceSessionOptions } from "@begame/trace-core";
import { createMinecraftTraceStorage } from "./minecraft";

export * from "@begame/trace-core";
export * from "./minecraft";

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
        storage: createMinecraftTraceStorage(),
    });
}
