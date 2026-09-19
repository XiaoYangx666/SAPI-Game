/**
 * Runtime trace registry.
 *
 * `@begame/core` never imports the trace implementation directly. The real
 * `TraceManager` (which needs `@begame/trace-core`) installs itself here when an
 * entry that explicitly opts into tracing is imported — currently
 * `@begame/core/trace`. A game that never imports that entry bundles no trace
 * code at all and gets the inert runtime below.
 *
 * This is deliberately not a dynamic `import()`: installation happens at module
 * evaluation of an explicit opt-in entry, so it is synchronous, order-stable and
 * works on runtimes without a module loader.
 */
import type { TraceManager } from "./manager";

export type TraceRuntimeFactory = (
    tick: () => number,
    onInternalError: (error: unknown) => void
) => TraceManager;

let factory: TraceRuntimeFactory | undefined;

/** Called by the opt-in trace entry. Re-installing replaces the previous factory. */
export function installTraceRuntime(next: TraceRuntimeFactory): void {
    factory = next;
}

export function isTraceRuntimeInstalled(): boolean {
    return factory !== undefined;
}

/** @internal Returns the installed runtime, or an inert stand-in when absent. */
export function createTraceRuntime(
    tick: () => number,
    onInternalError: (error: unknown) => void
): TraceManager {
    if (factory) return factory(tick, onInternalError);
    return createInertTraceRuntime() as unknown as TraceManager;
}

const INERT_STORE = {
    enabled: false,
    enable() {},
    disable() {},
    configure() {
        return INERT_STORE;
    },
    list() {
        return [];
    },
    toBytes() {
        return undefined;
    },
    delete() {
        return false;
    },
    clear() {},
} as const;

/**
 * Structurally partial on purpose: it covers every member core calls, and the
 * single cast above carries the rest. Keeping it inert (rather than throwing)
 * means tracing stays strictly optional and can never break gameplay.
 */
function createInertTraceRuntime() {
    return {
        enabled: false,
        store: INERT_STORE,
        consoleExporter: { export: () => undefined },
        setSink() {},
        configureStore() {
            return this;
        },
        setStoreEnabled() {
            return this;
        },
        exportToConsole() {
            return undefined;
        },
        bindConnectionSource() {},
        beginSession() {
            return undefined;
        },
        getSession() {
            return undefined;
        },
        noteConnection() {},
        endSession() {
            return undefined;
        },
        async settled() {},
    };
}
