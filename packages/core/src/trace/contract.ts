/**
 * The trace contract owned by `@begame/core`.
 *
 * Core emits trace events on its hot path, but it does not own the trace
 * implementation and must not ship it: a game that never enables tracing would
 * otherwise pay for the session machinery, the binary codec and the world store.
 *
 * So core names exactly what it drives and nothing more. The vocabulary comes
 * from `@begame/trace-spec`, which both core and the codec depend on, and the
 * real implementation (`@begame/trace`) is injected at the consumer's
 * composition root. Until that happens, the inert implementations below are used.
 */
import type {
    BeginTraceSessionOptions,
    ConsoleTraceExportResult,
    StoredTraceSummary,
    TraceConnectionSource,
    TraceEventSchema,
    TraceInputValue,
    TracePayload,
    TracePlayerMarker,
    TraceSchemaShape,
    TraceSessionEnd,
    TraceSink,
    TraceSource,
    TraceSourceKind,
    TraceValue,
    TraceStoreOptions,
} from "@begame/trace-spec";

/**
 * The vocabulary lives in `@begame/trace-spec` so core and the codec read one
 * definition. Re-exported here because this is the module core's hot path
 * imports from.
 */
export {
    BuiltinTraceEventType,
    TRACE_ERROR_MARKER,
    isTraceErrorPayload,
    traceErrorValue,
    type TraceConnectionSource,
    type TraceInputValue,
    type TracePlayerMarker,
    type TraceValue,
} from "@begame/trace-spec";

/** The structured trace scope gameplay code talks to. */
export interface TraceScope {
    readonly enabled: boolean;
    readonly source: TraceSource;
    builtin(
        type: number,
        payload?: Record<string, TraceInputValue>
    ): void;
    emit<T extends TraceSchemaShape>(
        schema: TraceEventSchema<T>,
        payload: TracePayload<T>
    ): void;
    debug(message: string, fields?: Record<string, TraceInputValue>): void;
    // Falls back to the raw id when there is no session, hence the union.
    player(id: string, name?: string): TracePlayerMarker | string;
}

/** The per-game session handle core drives. */
export interface TraceSession {
    readonly game: TraceScope;
    readonly participation: TraceScope;
    createStateScope(state: object, name: string): TraceScope;
    createComponentScope(
        component: object,
        state: object,
        name: string,
        tag?: string
    ): TraceScope;
    createNamedScope(
        kind: Exclude<TraceSourceKind, "state" | "component">,
        name: string,
        ref?: number
    ): TraceScope;
    player(id: string, name?: string): TracePlayerMarker;
    registerPlayer(id: string, name?: string): void;
    noteConnection(id: string, name: string | undefined, online: boolean): void;
}

/** The history store, as far as core and tooling reach into it. */
export interface TraceStoreLike {
    readonly enabled: boolean;
    configure(options?: TraceStoreOptions): unknown;
    enable(): void;
    disable(): void;
    list(): StoredTraceSummary[];
    latest(): StoredTraceSummary | undefined;
    toBytes(sessionId: string): Uint8Array;
    delete(sessionId: string): boolean;
}

/**
 * The trace runtime injected into `@begame/core`.
 *
 * `@begame/trace`'s `TraceManager` satisfies this structurally, so injection
 * needs no adapter.
 */
export interface TraceRuntime {
    readonly enabled: boolean;
    readonly store: TraceStoreLike;
    readonly consoleExporter: {
        export(sessionId?: string): ConsoleTraceExportResult;
    };
    setSink(sink?: TraceSink): void;
    configureStore(options?: TraceStoreOptions): unknown;
    setStoreEnabled(enabled: boolean): unknown;
    exportToConsole(sessionId?: string): ConsoleTraceExportResult;
    bindConnectionSource(source?: TraceConnectionSource): void;
    beginSession(options: BeginTraceSessionOptions): TraceSession | undefined;
    getSession(gameKey: string): TraceSession | undefined;
    noteConnection(
        playerId: string,
        playerName: string | undefined,
        online: boolean
    ): void;
    endSession(
        gameKey: string,
        status: TraceSessionEnd["status"],
        reason?: string
    ): unknown;
    settled(): Promise<void>;
}

/** Used whenever no trace session exists; every method is intentionally empty. */
export const NOOP_TRACE_SCOPE: TraceScope = {
    enabled: false,
    source: { kind: "system" },
    builtin() {},
    emit() {},
    debug() {},
    player(id: string) {
        return id;
    },
};

const INERT_STORE: TraceStoreLike = {
    enabled: false,
    configure() {
        return INERT_STORE;
    },
    enable() {},
    disable() {},
    list() {
        return [];
    },
    latest() {
        return undefined;
    },
    toBytes() {
        return new Uint8Array();
    },
    delete() {
        return false;
    },
};

/**
 * Stand-in used until a runtime is injected.
 *
 * It is inert rather than throwing, so tracing stays strictly optional and can
 * never break gameplay. `initBEGame` reports the missing injection instead,
 * where the intent is known.
 */
export const NOOP_TRACE_RUNTIME: TraceRuntime = {
    enabled: false,
    store: INERT_STORE,
    consoleExporter: {
        export() {
            return { sessionId: "", binaryBytes: 0, base64Chars: 0, partCount: 0 };
        },
    },
    setSink() {},
    configureStore() {
        return undefined;
    },
    setStoreEnabled() {
        return undefined;
    },
    exportToConsole() {
        return { sessionId: "", binaryBytes: 0, base64Chars: 0, partCount: 0 };
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
