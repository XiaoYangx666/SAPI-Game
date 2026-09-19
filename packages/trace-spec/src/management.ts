/**
 * Management-side vocabulary of the trace subsystem.
 *
 * These are the shapes `@begame/core` has to name in order to drive a trace
 * runtime it does not own, and that `@begame/trace` has to implement. They live
 * here so both sides read one definition instead of two that can drift.
 */
import type { TraceSessionStatus } from "./types";

/** Everything needed to open one trace session. */
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

/** Retention policy for the world Dynamic Property history store. */
export interface WorldTraceStoreOptions {
    /** Maximum completed sessions retained in this world. */
    readonly maxSessions?: number;
    /** Approximate Base64 payload bytes retained by BEGame Trace. */
    readonly maxBytes?: number;
    /** Maximum age of a completed session. */
    readonly maxAgeMs?: number;
    /** Periodic cleanup cadence in Minecraft ticks. */
    readonly cleanupIntervalTicks?: number;
}

/** Metadata for one session held in the history store. */
export interface StoredTraceSummary {
    readonly sessionId: string;
    readonly gameType: string;
    readonly gameKey: string;
    readonly status: TraceSessionStatus;
    readonly startTick: number;
    readonly startWallTime: number;
    readonly endTick?: number;
    readonly endWallTime?: number;
    readonly endReason?: string;
    readonly eventCount: number;
    readonly chunkCount: number;
    readonly storedBytes: number;
}

/** Result of emitting one stored session to the Minecraft Content Log. */
export interface ConsoleTraceExportResult {
    readonly sessionId: string;
    readonly binaryBytes: number;
    readonly base64Chars: number;
    readonly partCount: number;
}
