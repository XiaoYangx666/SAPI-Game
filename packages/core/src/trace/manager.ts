import { ConsoleTraceExporter } from "./consoleExporter";
import { snapshotTraceValue, TraceSession } from "./session";
import {
    TRACE_FORMAT_VERSION,
    type TraceSessionEnd,
    type TraceSessionOptions,
    type TraceSink,
    type TraceValue,
} from "./types";
import {
    WorldTraceStore,
    type WorldTraceStoreOptions,
} from "./worldStore";

export interface BeginTraceSessionOptions {
    readonly gameType: string;
    readonly gameKey: string;
    readonly initialConfig?: unknown;
    readonly begameVersion?: string;
    readonly packVersion?: string;
}

export interface TraceConnectionEvent {
    readonly type: "online" | "offline";
    readonly playerId: string;
    readonly playerName?: string;
}

export interface TraceConnectionSubscription {
    unsubscribe(): void;
}

export interface TraceConnectionSource {
    subscribe(callback: (event: TraceConnectionEvent) => void): TraceConnectionSubscription;
}

export class TraceManager {
    /** Optional compatibility/testing sink. Production history uses `store`. */
    private sink?: TraceSink;
    private connectionSource?: TraceConnectionSource;
    private connectionSubscription?: TraceConnectionSubscription;
    private readonly sessions = new Map<string, TraceSession>();
    private readonly completedSessions = new Set<TraceSession>();
    private sessionCounter = 0;

    /** World Dynamic Property history store. Disabled by default. */
    readonly store: WorldTraceStore;
    /** Console/Content Log export channel backed by the world history store. */
    readonly consoleExporter: ConsoleTraceExporter;

    constructor(
        private readonly tick: () => number,
        private readonly options: TraceSessionOptions = {}
    ) {
        this.store = new WorldTraceStore({}, (error) =>
            this.reportInternalError(error)
        );
        this.consoleExporter = new ConsoleTraceExporter(this.store);
    }

    /**
     * Compatibility/testing sink. It is combined with the WorldTraceStore when
     * persistent storage is enabled.
     */
    setSink(sink?: TraceSink) {
        this.sink = sink;
        this.refreshConnectionSubscription();
    }

    configureStore(options: WorldTraceStoreOptions = {}) {
        this.store.configure(options);
        return this;
    }

    setStoreEnabled(enabled: boolean) {
        if (enabled) this.store.enable();
        else this.store.disable();
        return this;
    }

    /** Export a stored session through warning-level Minecraft Content Log output. */
    exportToConsole(sessionId?: string) {
        return this.consoleExporter.export(sessionId);
    }

    bindConnectionSource(source?: TraceConnectionSource) {
        if (this.connectionSource === source) return;
        this.connectionSubscription?.unsubscribe();
        this.connectionSubscription = undefined;
        this.connectionSource = source;
        this.refreshConnectionSubscription();
    }

    /** True while new sessions can be traced or an already-started session is active. */
    get enabled() {
        return (
            this.sink !== undefined ||
            this.store.enabled ||
            this.sessions.size > 0
        );
    }

    beginSession(options: BeginTraceSessionOptions): TraceSession | undefined {
        const sink = this.createSessionSink();
        if (!sink) return undefined;
        try {
            if (this.sessions.has(options.gameKey)) {
                this.reportInternalError(
                    new Error(`Trace session already exists for ${options.gameKey}`)
                );
                return this.sessions.get(options.gameKey);
            }

            const startTick = this.safeTick();
            const sessionId = this.buildSessionId(startTick);
            const initialConfig = snapshotTraceValue(options.initialConfig);
            const begameVersion =
                options.begameVersion ?? this.options.begameVersion;
            const packVersion = options.packVersion ?? this.options.packVersion;
            const session = new TraceSession(
                {
                    sessionId,
                    gameType: options.gameType,
                    gameKey: options.gameKey,
                    gameInstanceId: sessionId,
                    startTick,
                    startWallTime: Date.now(),
                    ...(begameVersion === undefined ? {} : { begameVersion }),
                    ...(packVersion === undefined ? {} : { packVersion }),
                    ...(initialConfig === null ? {} : { initialConfig }),
                },
                this.tick,
                sink,
                this.options
            );
            this.sessions.set(options.gameKey, session);
            this.refreshConnectionSubscription();
            return session;
        } catch (error) {
            this.reportInternalError(error);
            return undefined;
        }
    }

    getSession(gameKey: string) {
        return this.sessions.get(gameKey);
    }

    noteConnection(
        playerId: string,
        playerName: string | undefined,
        online: boolean
    ) {
        for (const session of this.sessions.values()) {
            session.noteConnection(playerId, playerName, online);
        }
    }

    endSession(
        gameKey: string,
        status: TraceSessionEnd["status"],
        reason?: string
    ): TraceSessionEnd | undefined {
        const session = this.sessions.get(gameKey);
        if (!session) return undefined;
        this.sessions.delete(gameKey);
        const end = session.end(status, reason, this.safeTick());
        this.completedSessions.add(session);
        this.refreshConnectionSubscription();
        return end;
    }

    async settled() {
        await Promise.all(
            [...this.sessions.values(), ...this.completedSessions].map(
                (session) => session.settled()
            )
        );
        this.completedSessions.clear();
    }

    /**
     * Sink membership is snapshotted when a session begins. This is deliberate:
     * disabling DP storage at runtime stops new sessions from being persisted but
     * allows already-started stored sessions to receive all remaining chunks/footer.
     */
    private createSessionSink(): TraceSink | undefined {
        const sinks = [
            ...new Set<TraceSink>([
                ...(this.sink ? [this.sink] : []),
                ...(this.store.enabled ? [this.store] : []),
            ]),
        ];
        if (sinks.length === 0) return undefined;
        if (sinks.length === 1) return sinks[0];

        return {
            onSessionStart: (header) =>
                this.dispatchSinks(sinks, (sink) =>
                    sink.onSessionStart?.(header)
                ),
            onChunk: (chunk) =>
                this.dispatchSinks(sinks, (sink) => sink.onChunk(chunk)),
            onSessionEnd: (end) =>
                this.dispatchSinks(sinks, (sink) => sink.onSessionEnd?.(end)),
        };
    }

    private dispatchSinks(
        sinks: readonly TraceSink[],
        operation: (sink: TraceSink) => void | Promise<void> | undefined
    ): void | Promise<void> {
        const pending: Promise<void>[] = [];
        for (const sink of sinks) {
            try {
                const result = operation(sink);
                if (result !== undefined) {
                    pending.push(
                        Promise.resolve(result).catch((error) => {
                            this.reportInternalError(error);
                        })
                    );
                }
            } catch (error) {
                this.reportInternalError(error);
            }
        }
        if (pending.length === 0) return;
        return Promise.all(pending).then(() => undefined);
    }

    private refreshConnectionSubscription() {
        // Sessions hold their own sink snapshot, so a runtime store/sink toggle must
        // not disconnect connection tracing for sessions that are already active.
        const shouldSubscribe = this.sessions.size > 0;
        if (
            shouldSubscribe &&
            !this.connectionSubscription &&
            this.connectionSource
        ) {
            this.connectionSubscription = this.connectionSource.subscribe((event) =>
                this.noteConnection(
                    event.playerId,
                    event.playerName,
                    event.type === "online"
                )
            );
        } else if (!shouldSubscribe && this.connectionSubscription) {
            this.connectionSubscription.unsubscribe();
            this.connectionSubscription = undefined;
        }
    }

    private buildSessionId(tick: number) {
        this.sessionCounter++;
        return `${Date.now().toString(36)}-${tick.toString(36)}-${this.sessionCounter.toString(36)}`;
    }

    private safeTick() {
        try {
            const tick = this.tick();
            return Number.isSafeInteger(tick) && tick >= 0 ? tick : 0;
        } catch {
            return 0;
        }
    }

    private reportInternalError(error: unknown) {
        try {
            this.options.onInternalError?.(error);
        } catch {
            // Never leak trace failures into game execution.
        }
    }
}

/** Useful for tools that need to refer to the trace format without importing internals. */
export const traceFormatVersion = TRACE_FORMAT_VERSION;
export type TraceMetadataValue = TraceValue;
