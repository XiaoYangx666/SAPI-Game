/**
 * Minecraft binding for the trace history store.
 *
 * This is the only place in the trace subsystem that knows about Minecraft. It
 * supplies the three storage seams — world dynamic properties, the tick
 * scheduler, and the worldLoad gate — so `@begame/trace-core` can keep the
 * bookkeeping platform-independent.
 */
import { system, world } from "@minecraft/server";
import { isWorldLoaded, runAfterWorldLoad } from "@begame/core/world-ready";
import type { TraceStorage, TraceStoredValue } from "@begame/trace-core";

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
