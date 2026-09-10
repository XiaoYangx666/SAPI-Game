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

export class TraceManager {
    private sink?: TraceSink;
    private readonly sessions = new Map<string, TraceSession>();
    private sessionCounter = 0;

    constructor(
        private readonly tick: () => number,
        private readonly options: TraceSessionOptions = {}
    ) {}

    setSink(sink?: TraceSink) {
        this.sink = sink;
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
        const session = new TraceSession(
            {
                sessionId,
                gameType: options.gameType,
                gameKey: options.gameKey,
                gameInstanceId: sessionId,
                startTick,
                startWallTime: Date.now(),
                ...(options.begameVersion ?? this.options.begameVersion
                    ? { begameVersion: options.begameVersion ?? this.options.begameVersion }
                    : {}),
                ...(options.packVersion ?? this.options.packVersion
                    ? { packVersion: options.packVersion ?? this.options.packVersion }
                    : {}),
                ...(initialConfig !== null ? { initialConfig } : {}),
            },
            this.tick,
            this.sink,
            this.options
        );
        this.sessions.set(options.gameKey, session);
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
        return session.end(status, reason, this.safeTick());
    }

    async settled() {
        await Promise.all([...this.sessions.values()].map((session) => session.settled()));
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
