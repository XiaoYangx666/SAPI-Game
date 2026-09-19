/**
 * Storage seams for the trace history store.
 *
 * The store's job — chunking sessions, enforcing retention, recovering after a
 * script reload — is pure bookkeeping. Only the substrate is platform-specific,
 * so it is injected rather than imported. `@begame/trace` supplies Minecraft
 * dynamic properties, a `system.runInterval` scheduler and the worldLoad gate;
 * tests supply an in-memory map and can then exercise the logic directly.
 */

/** A value Minecraft dynamic properties can hold. */
export type TraceStoredValue = string | number | boolean | undefined;

/**
 * Key-value storage.
 *
 * The value type deliberately mirrors dynamic properties: they hold no binary
 * and no nested structure, which is why chunk bytes are Base64 encoded before
 * they reach the store. Widening this to arbitrary values would silently drop
 * that constraint.
 */
export interface TraceKeyValueStore {
    set(key: string, value: TraceStoredValue): void;
    get(key: string): TraceStoredValue;
    /** All keys this store owns, used for enumeration and cleanup. */
    keys(): string[];
}

/** Repeating timer, matching Minecraft's tick-based `system.runInterval`. */
export interface TraceScheduler {
    every(ticks: number, callback: () => void): number;
    cancel(handle: number): void;
}

/**
 * World readiness.
 *
 * Dynamic property access before `worldLoad` is unsafe, so the store refuses to
 * accept sessions until the substrate says it is ready. Keeping this behind a
 * seam stops that Minecraft-specific rule from living in the store.
 */
export interface TraceWorldGate {
    isReady(): boolean;
    /** Runs now when already ready, otherwise once readiness arrives. */
    afterReady(callback: () => void): () => void;
}

export interface TraceStorage {
    readonly kv: TraceKeyValueStore;
    readonly scheduler: TraceScheduler;
    readonly gate: TraceWorldGate;
}

/** Map-backed storage, used as the default and by tests. */
export function createInMemoryStorage(): TraceStorage {
    const values = new Map<string, TraceStoredValue>();
    const timers = new Map<number, ReturnType<typeof setInterval>>();
    let nextHandle = 1;

    return {
        kv: {
            set(key, value) {
                if (value === undefined) values.delete(key);
                else values.set(key, value);
            },
            get(key) {
                return values.get(key);
            },
            keys() {
                return [...values.keys()];
            },
        },
        scheduler: {
            every(ticks, callback) {
                const handle = nextHandle++;
                // One tick is 50 ms; approximate so in-memory use does not need
                // a real tick source. Minecraft never takes this path.
                timers.set(
                    handle,
                    setInterval(callback, Math.max(1, ticks) * 50)
                );
                return handle;
            },
            cancel(handle) {
                const timer = timers.get(handle);
                if (timer !== undefined) {
                    clearInterval(timer);
                    timers.delete(handle);
                }
            },
        },
        gate: {
            isReady: () => true,
            afterReady(callback) {
                callback();
                return () => undefined;
            },
        },
    };
}
