export const TRACE_FORMAT_VERSION = 1;
export const TRACE_MAGIC = "BEGT";
export const TRACE_CHUNK_MAGIC = "BGTC";

export type TraceSessionStatus =
    | "running"
    | "completed"
    | "aborted"
    | "crashed"
    | "interrupted"
    | "reloaded";

export type TraceValue =
    | null
    | boolean
    | number
    | string
    | TraceValue[]
    | { [key: string]: TraceValue };

export interface TraceSessionHeader {
    readonly sessionId: string;
    readonly formatVersion: number;
    readonly gameType: string;
    readonly gameKey: string;
    readonly gameInstanceId: string;
    readonly begameVersion?: string;
    readonly packVersion?: string;
    readonly startTick: number;
    readonly startWallTime: number;
    readonly initialConfig?: TraceValue;
}

export interface TraceSessionEnd {
    readonly sessionId: string;
    readonly status: Exclude<TraceSessionStatus, "running">;
    readonly endTick: number;
    readonly endWallTime: number;
    readonly endReason?: string;
    readonly eventCount: number;
    readonly chunkCount: number;
}

export interface TraceChunk {
    readonly sessionId: string;
    readonly index: number;
    readonly firstSequence: number;
    readonly lastSequence: number;
    readonly startTick: number;
    readonly endTick: number;
    readonly eventCount: number;
    readonly bytes: Uint8Array;
}

export interface TraceSink {
    onSessionStart?(header: TraceSessionHeader): void | Promise<void>;
    onChunk(chunk: TraceChunk): void | Promise<void>;
    onSessionEnd?(end: TraceSessionEnd): void | Promise<void>;
}

export interface TraceSessionOptions {
    readonly maxChunkBytes?: number;
    readonly maxChunkTickSpan?: number;
    readonly begameVersion?: string;
    readonly packVersion?: string;
    readonly onInternalError?: (error: unknown) => void;
}

export type TraceSourceKind =
    | "game"
    | "state"
    | "component"
    | "runner"
    | "timer"
    | "participation"
    | "connection"
    | "system";

export interface TraceSource {
    readonly kind: TraceSourceKind;
    readonly ref?: number;
    readonly name?: string;
}

export enum BuiltinTraceEventType {
    GameCreated = 1,
    GameStarting = 2,
    GameStarted = 3,
    GameStartFailed = 4,
    GameStopping = 5,
    GameStopped = 6,
    GameDisposed = 7,

    StatePush = 16,
    StateEnter = 17,
    StateExit = 18,
    StateRemove = 19,
    StateTransition = 20,
    StateRootChanged = 21,
    StateEnterFailed = 22,

    ComponentAttachStarted = 32,
    ComponentAttached = 33,
    ComponentDetached = 34,
    ComponentAttachFailed = 35,
    ComponentError = 36,

    ParticipationAcquire = 48,
    ParticipationJoined = 49,
    ParticipationReleased = 50,
    ParticipationAcquireRejected = 51,

    PlayerConnected = 64,
    PlayerDisconnected = 65,
    PlayerReconnected = 66,

    DisconnectTimeoutStarted = 80,
    DisconnectTimeoutCancelled = 81,
    DisconnectTimeoutExpired = 82,

    RunnerUncaughtError = 96,
    RunnerCancelled = 97,

    TimerStarted = 112,
    TimerExpired = 113,
    TimerCancelled = 114,

    DebugMessage = 127,
}

export const BUILTIN_TRACE_EVENT_NAMES: Readonly<Record<number, string>> = {
    [BuiltinTraceEventType.GameCreated]: "game.created",
    [BuiltinTraceEventType.GameStarting]: "game.starting",
    [BuiltinTraceEventType.GameStarted]: "game.started",
    [BuiltinTraceEventType.GameStartFailed]: "game.start_failed",
    [BuiltinTraceEventType.GameStopping]: "game.stopping",
    [BuiltinTraceEventType.GameStopped]: "game.stopped",
    [BuiltinTraceEventType.GameDisposed]: "game.disposed",
    [BuiltinTraceEventType.StatePush]: "state.push",
    [BuiltinTraceEventType.StateEnter]: "state.enter",
    [BuiltinTraceEventType.StateExit]: "state.exit",
    [BuiltinTraceEventType.StateRemove]: "state.remove",
    [BuiltinTraceEventType.StateTransition]: "state.transition",
    [BuiltinTraceEventType.StateRootChanged]: "state.root_changed",
    [BuiltinTraceEventType.StateEnterFailed]: "state.enter_failed",
    [BuiltinTraceEventType.ComponentAttachStarted]: "component.attach_started",
    [BuiltinTraceEventType.ComponentAttached]: "component.attached",
    [BuiltinTraceEventType.ComponentDetached]: "component.detached",
    [BuiltinTraceEventType.ComponentAttachFailed]: "component.attach_failed",
    [BuiltinTraceEventType.ComponentError]: "component.error",
    [BuiltinTraceEventType.ParticipationAcquire]: "participation.acquire",
    [BuiltinTraceEventType.ParticipationJoined]: "participation.joined",
    [BuiltinTraceEventType.ParticipationReleased]: "participation.released",
    [BuiltinTraceEventType.ParticipationAcquireRejected]: "participation.acquire_rejected",
    [BuiltinTraceEventType.PlayerConnected]: "player.connect",
    [BuiltinTraceEventType.PlayerDisconnected]: "player.disconnect",
    [BuiltinTraceEventType.PlayerReconnected]: "player.reconnect",
    [BuiltinTraceEventType.DisconnectTimeoutStarted]: "disconnect_timeout.started",
    [BuiltinTraceEventType.DisconnectTimeoutCancelled]: "disconnect_timeout.cancelled",
    [BuiltinTraceEventType.DisconnectTimeoutExpired]: "disconnect_timeout.expired",
    [BuiltinTraceEventType.RunnerUncaughtError]: "runner.uncaught_error",
    [BuiltinTraceEventType.RunnerCancelled]: "runner.cancelled",
    [BuiltinTraceEventType.TimerStarted]: "timer.started",
    [BuiltinTraceEventType.TimerExpired]: "timer.expired",
    [BuiltinTraceEventType.TimerCancelled]: "timer.cancelled",
    [BuiltinTraceEventType.DebugMessage]: "debug.message",
};

export type TraceFieldType =
    | "boolean"
    | "uint"
    | "int"
    | "number"
    | "string"
    | "player";

export interface TraceFieldDefinition<T extends TraceFieldType = TraceFieldType> {
    readonly type: T;
    readonly optional?: boolean;
}

export type TraceSchemaShape = Record<
    string,
    TraceFieldType | TraceFieldDefinition
>;

type NormalizeField<T> = T extends TraceFieldDefinition<infer U>
    ? U
    : T extends TraceFieldType
      ? T
      : never;

type FieldValue<T> = NormalizeField<T> extends "boolean"
    ? boolean
    : NormalizeField<T> extends "uint" | "int" | "number"
      ? number
      : string;

type RequiredFieldKeys<T extends TraceSchemaShape> = {
    [K in keyof T]-?: T[K] extends TraceFieldDefinition
        ? T[K]["optional"] extends true
            ? never
            : K
        : K;
}[keyof T];

type OptionalFieldKeys<T extends TraceSchemaShape> = Exclude<
    keyof T,
    RequiredFieldKeys<T>
>;

export type TracePayload<T extends TraceSchemaShape> = {
    [K in RequiredFieldKeys<T>]: FieldValue<T[K]>;
} & {
    [K in OptionalFieldKeys<T>]?: FieldValue<T[K]>;
};

export interface TraceEventSchema<T extends TraceSchemaShape = TraceSchemaShape> {
    readonly name: string;
    readonly fields: T;
}

export interface DecodedTraceEvent {
    readonly sequence: number;
    readonly tick: number;
    readonly typeId: number;
    readonly type: string;
    readonly source: TraceSource;
    readonly payload: TraceValue;
}

export interface DecodedTraceSession {
    readonly header: TraceSessionHeader;
    readonly end: TraceSessionEnd;
    readonly events: readonly DecodedTraceEvent[];
}
