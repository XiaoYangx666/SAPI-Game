/**
 * Minecraft binding for BEGame Trace.
 *
 * This is the only module in the package that knows about Minecraft, and the
 * only one that depends on `@begame/core`. It supplies the three storage seams
 * — world dynamic properties, the tick scheduler and the worldLoad gate — and
 * assembles the runtime that `@begame/core` is handed.
 *
 * It is a separate entry rather than part of the root so that importing the
 * codec never pulls `@minecraft/server` or `@begame/core`.
 */
import { system, world } from "@minecraft/server";
import { isWorldLoaded, runAfterWorldLoad } from "@begame/core/world-ready";
import { TraceManager } from "./manager";
import type { TraceStorage, TraceStoredValue } from "./storage";
import type { TraceSessionOptions } from "./types";

export function createMinecraftTraceStorage(): TraceStorage {
    return {
        kv: {
            set(key, value) {
                world.setDynamicProperty(key, value);
            },
            get(key) {
                return world.getDynamicProperty(key) as TraceStoredValue;
            },
            keys() {
                return world.getDynamicPropertyIds();
            },
        },
        scheduler: {
            every: (ticks, callback) => system.runInterval(callback, ticks),
            cancel: (handle) => system.clearRun(handle),
        },
        gate: {
            isReady: () => isWorldLoaded(),
            afterReady: (callback) => runAfterWorldLoad(callback),
        },
    };
}

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
