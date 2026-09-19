export interface TraceSessionHeader {
    sessionId: string;
    formatVersion: number;
    gameType: string;
    gameKey: string;
    gameInstanceId: string;
    begameVersion?: string;
    packVersion?: string;
    startTick: number;
    startWallTime: number;
    initialConfig?: unknown;
}

export interface TraceSessionEnd {
    sessionId: string;
    status: string;
    endTick: number;
    endWallTime: number;
    endReason?: string;
    eventCount: number;
    chunkCount: number;
}

export interface TraceSource {
    kind: string;
    ref?: number;
    name?: string;
}

export interface TraceEvent {
    sequence: number;
    tick: number;
    typeId: number;
    type: string;
    source: TraceSource;
    payload: unknown;
}

export interface StateSpan {
    ref: number;
    name: string;
    depth: number | null;
    enterTick: number;
    enterSequence: number;
    exitTick: number;
    exitSequence: number;
}

export interface TraceStats {
    tickSpan: number;
    wallSpanMs: number;
    eventCount: number;
    chunkCount: number;
    typeCounts: Record<string, number>;
    sourceCounts: Record<string, number>;
    stateSpans: StateSpan[];
}

export interface ContextNode {
    key: string;
    ref: number | null;
    name: string;
    depth: number | null;
    parentKey: string | null;
    children: string[];
    enterTick: number;
    exitTick: number | null;
    enterSequence: number;
    exitSequence: number | null;
    pushSequence: number | null;
    removeSequence: number | null;
    eventCount: number;
    errorCount: number;
}

export interface PlayerEntry {
    id: string;
    name?: string;
    seats: number[];
    firstSequence: number;
    lastSequence: number;
}

export interface SeatChange {
    sequence: number;
    tick: number;
    kind?: string;
    name?: string;
    participantId?: string;
}

export interface SeatEntry {
    seat: number;
    name?: string;
    kind?: string;
    participantId?: string;
    firstSequence: number;
    lastSequence: number;
    changes: SeatChange[];
}

export interface ContextIssue {
    eventIndex: number;
    nodeKey: string;
    type: string;
}

export interface TraceContext {
    nodes: ContextNode[];
    eventOwners: string[];
    players: PlayerEntry[];
    seats: SeatEntry[];
    errors: ContextIssue[];
}

export interface TraceExportMeta {
    sessionId: string;
    formatVersion: number;
    partCount: number;
    receivedParts: number[];
    missingParts: number[];
    complete: boolean;
    lastOffset: number;
}

export interface SelectedSession {
    sessionId: string;
    header: TraceSessionHeader;
    end: TraceSessionEnd;
    events: TraceEvent[];
    stats: TraceStats;
    context: TraceContext;
}

export interface DecodeResponse {
    ok: boolean;
    source?: "log" | "begtrace";
    error?: string;
    warnings?: string[];
    exports?: TraceExportMeta[];
    selectedSessionId?: string;
    requestedSessionId?: string;
    selected?: SelectedSession;
}
