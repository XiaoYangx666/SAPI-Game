import {
    TRACE_FORMAT_VERSION,
    type TraceSessionEnd,
    type TraceSessionOptions,
    type TraceSink,
    type TraceValue,
} from "./types";
import { snapshotTraceValue, TraceSession } from "./session";

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
    private sink?: TraceSink;
    private connectionSource?: TraceConnectionSource;
    private connectionSubscription?: TraceConnectionSubscription;
    private readonly sessions = new Map<string, TraceSession>();
    private readonly completedSessions = new Set<TraceSession>();
    private sessionCounter = 0;

    constructor(
        private readonly tick: () => number,
        private readonly options: TraceSessionOptions = {}
    ) {}

    setSink(sink?: TraceSink) {
        this.sink = sink;
        this.refreshConnectionSubscription();
    }

    bindConnectionSource(source?: TraceConnectionSource) {
        if (this.connectionSource === source) return;
        this.connectionSubscription?.unsubscribe();
        this.connectionSubscription = undefined;
        this.connectionSource = source;
        this.refreshConnectionSubscription();
    }

    get enabled() {
        return this.sink !== undefined;
    }

    beginSession(options: BeginTraceSessionOptions): TraceSession | undefined {
        if (!this.sink) return undefined;
        if (this.sessions.has(options.gameKey)) {
            this.reportInternalError(new Error(`Trace session already exists for ${options.gameKey}`));
            return this.sessions.get(options.gameKey);
        }

        const startTick = this.safeTick();
        const sessionId = this.buildSessionId(startTick);
        const initialConfig = snapshotTraceValue(options.initialConfig);
        const begameVersion = options.begameVersion ?? this.options.begameVersion;
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
            this.sink,
            this.options
        );
        this.sessions.set(options.gameKey, session);
        this.refreshConnectionSubscription();
        return session;
    }

    getSession(gameKey: string) {
        return this.sessions.get(gameKey);
    }

    noteConnection(playerId: string, playerName: string | undefined, online: boolean) {
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
            [...this.sessions.values(), ...this.completedSessions].map((session) =>
                session.settled()
            )
        );
        this.completedSessions.clear();
    }

    private refreshConnectionSubscription() {
        const shouldSubscribe = this.sink !== undefined && this.sessions.size > 0;
        if (shouldSubscribe && !this.connectionSubscription && this.connectionSource) {
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
