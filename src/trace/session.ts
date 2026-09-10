import { BinaryWriter, concatBytes } from "./binary";
import {
    TraceFieldTypeCode,
    TraceRecordTag,
    TraceSourceKindCode,
    TraceValueTag,
} from "./format";
import { normalizeTraceField } from "./schema";
import {
    BuiltinTraceEventType,
    TRACE_CHUNK_MAGIC,
    TRACE_FORMAT_VERSION,
    type TraceChunk,
    type TraceEventSchema,
    type TracePayload,
    type TraceSchemaShape,
    type TraceSessionEnd,
    type TraceSessionHeader,
    type TraceSessionOptions,
    type TraceSink,
    type TraceSource,
    type TraceSourceKind,
    type TraceValue,
} from "./types";

const DEFAULT_MAX_CHUNK_BYTES = 20 * 1024;
const DEFAULT_MAX_CHUNK_TICK_SPAN = 1200;
const MAX_ERROR_STACK_LENGTH = 4096;
const playerMarker = Symbol("begame.trace.player");

interface TracePlayerMarker {
    readonly [playerMarker]: true;
    readonly id: string;
    readonly name?: string;
}

type TraceInputValue =
    | null
    | boolean
    | number
    | string
    | TracePlayerMarker
    | TraceInputValue[]
    | { [key: string]: TraceInputValue };

interface CustomSchemaRecord {
    readonly typeId: number;
    readonly schema: TraceEventSchema;
    readonly fields: readonly {
        readonly name: string;
        readonly type: ReturnType<typeof normalizeTraceField>["type"];
        readonly optional: boolean;
    }[];
}

interface ActiveChunk {
    readonly index: number;
    readonly payload: BinaryWriter;
    eventCount: number;
    firstSequence: number;
    lastSequence: number;
    startTick: number;
    endTick: number;
    previousTick: number;
}

function sourceKindCode(kind: TraceSourceKind) {
    switch (kind) {
        case "game":
            return TraceSourceKindCode.Game;
        case "state":
            return TraceSourceKindCode.State;
        case "component":
            return TraceSourceKindCode.Component;
        case "runner":
            return TraceSourceKindCode.Runner;
        case "timer":
            return TraceSourceKindCode.Timer;
        case "participation":
            return TraceSourceKindCode.Participation;
        case "connection":
            return TraceSourceKindCode.Connection;
        case "system":
            return TraceSourceKindCode.System;
    }
}

function fieldTypeCode(type: ReturnType<typeof normalizeTraceField>["type"]) {
    switch (type) {
        case "boolean":
            return TraceFieldTypeCode.Boolean;
        case "uint":
            return TraceFieldTypeCode.UInt;
        case "int":
            return TraceFieldTypeCode.Int;
        case "number":
            return TraceFieldTypeCode.Number;
        case "string":
            return TraceFieldTypeCode.String;
        case "player":
            return TraceFieldTypeCode.Player;
    }
}

export function traceError(error: unknown): TraceValue {
    if (error instanceof Error) {
        const result: Record<string, TraceValue> = {
            name: error.name,
            message: error.message,
        };
        if (error.stack) result.stack = error.stack.slice(0, MAX_ERROR_STACK_LENGTH);
        if (error.cause !== undefined) result.cause = traceError(error.cause);
        return result;
    }
    if (typeof error === "string") return { message: error };
    return { message: String(error) };
}

export function snapshotTraceValue(value: unknown, depth = 0, seen = new Set<object>()): TraceValue {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean" || typeof value === "string") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
    if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
        return String(value);
    }
    if (depth >= 5) return `[${(value as object).constructor?.name ?? "Object"}]`;
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";

    seen.add(value);
    try {
        if (Array.isArray(value)) {
            return value.slice(0, 128).map((entry) => snapshotTraceValue(entry, depth + 1, seen));
        }

        const record = value as Record<string, unknown>;
        const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
        const result: Record<string, TraceValue> = {};
        const entries = Object.entries(record).slice(0, 128);
        if (ctorName && ctorName !== "Object") result.$type = ctorName;
        for (const [key, entry] of entries) {
            result[key] = snapshotTraceValue(entry, depth + 1, seen);
        }
        return result;
    } finally {
        seen.delete(value);
    }
}

export class TraceScope {
    constructor(
        private readonly session?: TraceSession,
        readonly source: TraceSource = { kind: "system" }
    ) {}

    get enabled() {
        return this.session !== undefined && !this.session.ended;
    }

    emit<T extends TraceSchemaShape>(schema: TraceEventSchema<T>, payload: TracePayload<T>) {
        this.session?.emitCustom(schema, payload, this.source);
    }

    debug(message: string, fields?: Record<string, TraceValue>) {
        this.session?.emitBuiltin(
            BuiltinTraceEventType.DebugMessage,
            { message, ...(fields ? { fields } : {}) },
            this.source
        );
    }

    /** @internal */
    builtin(type: BuiltinTraceEventType, payload: Record<string, TraceInputValue> = {}) {
        this.session?.emitBuiltin(type, payload, this.source);
    }

    /** @internal */
    player(id: string, name?: string) {
        return this.session?.player(id, name) ?? id;
    }
}

export const NOOP_TRACE_SCOPE = new TraceScope();

export class TraceSession {
    readonly header: TraceSessionHeader;
    readonly game = new TraceScope(this, { kind: "game" });
    readonly participation = new TraceScope(this, { kind: "participation" });
    readonly connection = new TraceScope(this, { kind: "connection" });

    private readonly maxChunkBytes: number;
    private readonly maxChunkTickSpan: number;
    private readonly stringIds = new Map<string, number>();
    private readonly playerIds = new Map<string, number>();
    private readonly playerNames = new Map<string, string | undefined>();
    private readonly stateIds = new WeakMap<object, number>();
    private readonly componentIds = new WeakMap<object, number>();
    private readonly schemaIds = new Map<string, CustomSchemaRecord>();
    private readonly pendingSinkOperations = new Set<Promise<unknown>>();
    private active: ActiveChunk;
    private nextStringId = 0;
    private nextPlayerId = 0;
    private nextStateId = 0;
    private nextComponentId = 0;
    private nextCustomTypeId = 128;
    private sequence = 0;
    private chunkCount = 0;
    private _ended = false;

    constructor(
        header: Omit<TraceSessionHeader, "formatVersion">,
        private readonly tick: () => number,
        private readonly sink: TraceSink,
        private readonly options: TraceSessionOptions = {}
    ) {
        this.header = { ...header, formatVersion: TRACE_FORMAT_VERSION };
        this.maxChunkBytes = options.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
        this.maxChunkTickSpan = options.maxChunkTickSpan ?? DEFAULT_MAX_CHUNK_TICK_SPAN;
        this.active = this.newChunk();
        this.safeSink(() => this.sink.onSessionStart?.(this.header));
    }

    get ended() {
        return this._ended;
    }

    get eventCount() {
        return this.sequence;
    }

    get sealedChunkCount() {
        return this.chunkCount;
    }

    player(id: string, name?: string): TracePlayerMarker {
        return { [playerMarker]: true, id, ...(name ? { name } : {}) };
    }

    registerPlayer(id: string, name?: string) {
        this.safe(() => this.ensurePlayer(id, name));
    }

    hasPlayer(id: string) {
        return this.playerIds.has(id);
    }

    createStateScope(state: object, name: string) {
        if (this._ended) return NOOP_TRACE_SCOPE;
        const ref = this.safe(() => this.ensureState(state, name));
        return ref === undefined
            ? NOOP_TRACE_SCOPE
            : new TraceScope(this, { kind: "state", ref, name });
    }

    createComponentScope(component: object, state: object, name: string, tag?: string) {
        if (this._ended) return NOOP_TRACE_SCOPE;
        const ref = this.safe(() => this.ensureComponent(component, state, name, tag));
        return ref === undefined
            ? NOOP_TRACE_SCOPE
            : new TraceScope(this, { kind: "component", ref, name });
    }

    createNamedScope(kind: Exclude<TraceSourceKind, "state" | "component">, name: string, ref?: number) {
        return new TraceScope(this, { kind, name, ...(ref === undefined ? {} : { ref }) });
    }

    emitBuiltin(
        type: BuiltinTraceEventType,
        payload: Record<string, TraceInputValue> = {},
        source: TraceSource = { kind: "game" }
    ) {
        if (this._ended) return;
        this.safe(() => this.emitBuiltinUnsafe(type, payload, source));
    }

    emitCustom<T extends TraceSchemaShape>(
        schema: TraceEventSchema<T>,
        payload: TracePayload<T>,
        source: TraceSource = { kind: "game" }
    ) {
        if (this._ended) return;
        this.safe(() => this.emitCustomUnsafe(schema, payload, source));
    }

    noteConnection(id: string, name: string | undefined, online: boolean) {
        if (!this.hasPlayer(id)) return;
        const marker = this.player(id, name);
        const previousName = this.playerNames.get(id);
        this.ensurePlayer(id, name ?? previousName);
        const stateKey = `@connection:${id}`;
        const onlineMap = this.connectionState;
        const previous = onlineMap.get(stateKey);
        if (online) {
            this.emitBuiltin(
                previous === false
                    ? BuiltinTraceEventType.PlayerReconnected
                    : BuiltinTraceEventType.PlayerConnected,
                { player: marker },
                this.connection.source
            );
        } else if (previous !== false) {
            this.emitBuiltin(
                BuiltinTraceEventType.PlayerDisconnected,
                { player: marker },
                this.connection.source
            );
        }
        onlineMap.set(stateKey, online);
    }

    end(
        status: TraceSessionEnd["status"],
        endReason?: string,
        endTick = this.currentTick()
    ): TraceSessionEnd {
        if (this._ended) {
            return {
                sessionId: this.header.sessionId,
                status,
                endTick,
                endWallTime: Date.now(),
                ...(endReason ? { endReason } : {}),
                eventCount: this.sequence,
                chunkCount: this.chunkCount,
            };
        }
        this._ended = true;
        this.sealChunk();
        const end: TraceSessionEnd = {
            sessionId: this.header.sessionId,
            status,
            endTick,
            endWallTime: Date.now(),
            ...(endReason ? { endReason } : {}),
            eventCount: this.sequence,
            chunkCount: this.chunkCount,
        };
        this.safeSink(() => this.sink.onSessionEnd?.(end));
        return end;
    }

    async settled() {
        while (this.pendingSinkOperations.size > 0) {
            await Promise.allSettled([...this.pendingSinkOperations]);
        }
    }

    private readonly connectionState = new Map<string, boolean>();

    private emitBuiltinUnsafe(
        type: BuiltinTraceEventType,
        payload: Record<string, TraceInputValue>,
        source: TraceSource
    ) {
        const eventTick = this.currentTick();
        this.rotateByTick(eventTick);
        this.prepareSource(source);
        this.prepareValue(payload);
        this.appendEvent(type, eventTick, source, (writer) => this.writeValue(writer, payload));
    }

    private emitCustomUnsafe<T extends TraceSchemaShape>(
        schema: TraceEventSchema<T>,
        payload: TracePayload<T>,
        source: TraceSource
    ) {
        const eventTick = this.currentTick();
        this.rotateByTick(eventTick);
        this.prepareSource(source);
        const record = this.ensureSchema(schema);
        const values = payload as Record<string, unknown>;
        for (const field of record.fields) {
            const value = values[field.name];
            if (value === undefined) {
                if (!field.optional) throw new TypeError(`Missing trace field ${schema.name}.${field.name}`);
                continue;
            }
            this.prepareCustomField(field.type, value);
        }
        this.appendEvent(record.typeId, eventTick, source, (writer) => {
            const optionalFields = record.fields.filter((field) => field.optional);
            const bitset = new Uint8Array(Math.ceil(optionalFields.length / 8));
            optionalFields.forEach((field, index) => {
                if (values[field.name] !== undefined) bitset[Math.floor(index / 8)] |= 1 << (index % 8);
            });
            writer.writeVarUint(bitset.length);
            writer.writeBytes(bitset);
            for (const field of record.fields) {
                const value = values[field.name];
                if (value === undefined && field.optional) continue;
                this.writeCustomField(writer, field.type, value);
            }
        });
    }

    private appendEvent(
        typeId: number,
        tick: number,
        source: TraceSource,
        writePayload: (writer: BinaryWriter) => void
    ) {
        const nextSequence = this.sequence + 1;
        if (this.active.eventCount === 0) {
            this.active.firstSequence = nextSequence;
            this.active.startTick = tick;
            this.active.previousTick = tick;
        }

        const writer = new BinaryWriter();
        writer.writeByte(TraceRecordTag.Event);
        writer.writeVarUint(tick - this.active.previousTick);
        writer.writeVarUint(typeId);
        this.writeSource(writer, source);
        writePayload(writer);
        this.active.payload.writeBytes(writer.toUint8Array());

        this.sequence = nextSequence;
        this.active.eventCount++;
        this.active.lastSequence = nextSequence;
        this.active.endTick = tick;
        this.active.previousTick = tick;

        if (this.active.payload.length >= this.maxChunkBytes) this.sealChunk();
    }

    private prepareSource(source: TraceSource) {
        if (source.name !== undefined) this.ensureString(source.name);
    }

    private writeSource(writer: BinaryWriter, source: TraceSource) {
        writer.writeByte(sourceKindCode(source.kind));
        writer.writeVarUint(source.ref === undefined ? 0 : source.ref + 1);
        writer.writeVarUint(source.name === undefined ? 0 : this.ensureString(source.name) + 1);
    }

    private prepareValue(value: TraceInputValue): void {
        if (isPlayerMarker(value)) {
            this.ensurePlayer(value.id, value.name);
            return;
        }
        if (typeof value === "string") {
            this.ensureString(value);
            return;
        }
        if (Array.isArray(value)) {
            for (const entry of value) this.prepareValue(entry);
            return;
        }
        if (value && typeof value === "object") {
            for (const [key, entry] of Object.entries(value)) {
                this.ensureString(key);
                this.prepareValue(entry);
            }
        }
    }

    private writeValue(writer: BinaryWriter, value: TraceInputValue): void {
        if (value === null) {
            writer.writeByte(TraceValueTag.Null);
        } else if (value === false) {
            writer.writeByte(TraceValueTag.False);
        } else if (value === true) {
            writer.writeByte(TraceValueTag.True);
        } else if (typeof value === "number") {
            if (Number.isSafeInteger(value)) {
                if (value >= 0) {
                    writer.writeByte(TraceValueTag.UInt);
                    writer.writeVarUint(value);
                } else {
                    writer.writeByte(TraceValueTag.Int);
                    writer.writeVarInt(value);
                }
            } else {
                writer.writeByte(TraceValueTag.Number);
                writer.writeFloat64(value);
            }
        } else if (typeof value === "string") {
            writer.writeByte(TraceValueTag.StringRef);
            writer.writeVarUint(this.ensureString(value));
        } else if (isPlayerMarker(value)) {
            writer.writeByte(TraceValueTag.PlayerRef);
            writer.writeVarUint(this.ensurePlayer(value.id, value.name));
        } else if (Array.isArray(value)) {
            writer.writeByte(TraceValueTag.Array);
            writer.writeVarUint(value.length);
            for (const entry of value) this.writeValue(writer, entry);
        } else {
            writer.writeByte(TraceValueTag.Object);
            const entries = Object.entries(value);
            writer.writeVarUint(entries.length);
            for (const [key, entry] of entries) {
                writer.writeVarUint(this.ensureString(key));
                this.writeValue(writer, entry);
            }
        }
    }

    private prepareCustomField(type: ReturnType<typeof normalizeTraceField>["type"], value: unknown) {
        switch (type) {
            case "string":
                if (typeof value !== "string") throw new TypeError("Trace string field must be a string");
                this.ensureString(value);
                break;
            case "player":
                if (typeof value !== "string") throw new TypeError("Trace player field must be a player id string");
                this.ensurePlayer(value);
                break;
            case "boolean":
                if (typeof value !== "boolean") throw new TypeError("Trace boolean field must be a boolean");
                break;
            case "uint":
                if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
                    throw new TypeError("Trace uint field must be a non-negative safe integer");
                }
                break;
            case "int":
                if (typeof value !== "number" || !Number.isSafeInteger(value)) {
                    throw new TypeError("Trace int field must be a safe integer");
                }
                break;
            case "number":
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    throw new TypeError("Trace number field must be finite");
                }
                break;
        }
    }

    private writeCustomField(
        writer: BinaryWriter,
        type: ReturnType<typeof normalizeTraceField>["type"],
        value: unknown
    ) {
        switch (type) {
            case "boolean":
                writer.writeByte(value ? 1 : 0);
                break;
            case "uint":
                writer.writeVarUint(value as number);
                break;
            case "int":
                writer.writeVarInt(value as number);
                break;
            case "number":
                writer.writeFloat64(value as number);
                break;
            case "string":
                writer.writeVarUint(this.ensureString(value as string));
                break;
            case "player":
                writer.writeVarUint(this.ensurePlayer(value as string));
                break;
        }
    }

    private ensureString(value: string) {
        const existing = this.stringIds.get(value);
        if (existing !== undefined) return existing;
        const id = this.nextStringId++;
        this.stringIds.set(value, id);
        const writer = new BinaryWriter();
        writer.writeByte(TraceRecordTag.StringDefinition);
        writer.writeVarUint(id);
        writer.writeString(value);
        this.active.payload.writeBytes(writer.toUint8Array());
        return id;
    }

    private ensurePlayer(id: string, name?: string) {
        const existing = this.playerIds.get(id);
        const knownName = this.playerNames.get(id);
        if (existing !== undefined && (name === undefined || name === knownName)) return existing;

        const ref = existing ?? this.nextPlayerId++;
        if (existing === undefined) this.playerIds.set(id, ref);
        this.playerNames.set(id, name ?? knownName);
        const idRef = this.ensureString(id);
        const nameRef = name ?? knownName;
        const writer = new BinaryWriter();
        writer.writeByte(TraceRecordTag.PlayerDefinition);
        writer.writeVarUint(ref);
        writer.writeVarUint(idRef);
        writer.writeVarUint(nameRef === undefined ? 0 : this.ensureString(nameRef) + 1);
        this.active.payload.writeBytes(writer.toUint8Array());
        return ref;
    }

    private ensureState(state: object, name: string) {
        const existing = this.stateIds.get(state);
        if (existing !== undefined) return existing;
        const ref = this.nextStateId++;
        this.stateIds.set(state, ref);
        const nameRef = this.ensureString(name);
        const writer = new BinaryWriter();
        writer.writeByte(TraceRecordTag.StateDefinition);
        writer.writeVarUint(ref);
        writer.writeVarUint(nameRef);
        this.active.payload.writeBytes(writer.toUint8Array());
        return ref;
    }

    private ensureComponent(component: object, state: object, name: string, tag?: string) {
        const existing = this.componentIds.get(component);
        if (existing !== undefined) return existing;
        const stateRef = this.stateIds.get(state);
        if (stateRef === undefined) throw new Error("Trace component registered before its state");
        const ref = this.nextComponentId++;
        this.componentIds.set(component, ref);
        const nameRef = this.ensureString(name);
        const writer = new BinaryWriter();
        writer.writeByte(TraceRecordTag.ComponentDefinition);
        writer.writeVarUint(ref);
        writer.writeVarUint(stateRef);
        writer.writeVarUint(nameRef);
        writer.writeVarUint(tag === undefined ? 0 : this.ensureString(tag) + 1);
        this.active.payload.writeBytes(writer.toUint8Array());
        return ref;
    }

    private ensureSchema(schema: TraceEventSchema): CustomSchemaRecord {
        const existing = this.schemaIds.get(schema.name);
        const fields = Object.entries(schema.fields).map(([name, field]) => {
            const normalized = normalizeTraceField(field);
            return { name, type: normalized.type, optional: normalized.optional };
        });
        if (existing) {
            if (schemaSignature(existing.fields) !== schemaSignature(fields)) {
                throw new TypeError(`Trace schema name collision: ${schema.name}`);
            }
            return existing;
        }

        const typeId = this.nextCustomTypeId++;
        const record: CustomSchemaRecord = { typeId, schema, fields };
        this.schemaIds.set(schema.name, record);
        const nameRef = this.ensureString(schema.name);
        for (const field of fields) this.ensureString(field.name);

        const writer = new BinaryWriter();
        writer.writeByte(TraceRecordTag.SchemaDefinition);
        writer.writeVarUint(typeId);
        writer.writeVarUint(nameRef);
        writer.writeVarUint(fields.length);
        for (const field of fields) {
            writer.writeVarUint(this.ensureString(field.name));
            writer.writeByte(fieldTypeCode(field.type));
            writer.writeByte(field.optional ? 1 : 0);
        }
        this.active.payload.writeBytes(writer.toUint8Array());
        return record;
    }

    private rotateByTick(tick: number) {
        if (
            this.active.eventCount > 0 &&
            tick - this.active.startTick >= this.maxChunkTickSpan
        ) {
            this.sealChunk();
        }
    }

    private sealChunk() {
        if (this.active.eventCount === 0) return;
        const header = new BinaryWriter();
        for (const char of TRACE_CHUNK_MAGIC) header.writeByte(char.charCodeAt(0));
        header.writeByte(TRACE_FORMAT_VERSION);
        header.writeVarUint(this.active.index);
        header.writeVarUint(this.active.firstSequence);
        header.writeVarUint(this.active.startTick);
        header.writeVarUint(this.active.eventCount);
        const bytes = concatBytes([header.toUint8Array(), this.active.payload.toUint8Array()]);
        const chunk: TraceChunk = {
            sessionId: this.header.sessionId,
            index: this.active.index,
            firstSequence: this.active.firstSequence,
            lastSequence: this.active.lastSequence,
            startTick: this.active.startTick,
            endTick: this.active.endTick,
            eventCount: this.active.eventCount,
            bytes,
        };
        this.chunkCount++;
        this.safeSink(() => this.sink.onChunk(chunk));
        this.active = this.newChunk();
    }

    private newChunk(): ActiveChunk {
        return {
            index: this.chunkCount,
            payload: new BinaryWriter(),
            eventCount: 0,
            firstSequence: 0,
            lastSequence: 0,
            startTick: 0,
            endTick: 0,
            previousTick: 0,
        };
    }

    private currentTick() {
        const tick = this.tick();
        return Number.isSafeInteger(tick) && tick >= 0 ? tick : 0;
    }

    private safe<T>(operation: () => T): T | undefined {
        try {
            return operation();
        } catch (error) {
            this.reportInternalError(error);
            return undefined;
        }
    }

    private safeSink(operation: () => void | Promise<void> | undefined) {
        try {
            const result = operation();
            if (result && typeof result.then === "function") {
                const promise = Promise.resolve(result)
                    .catch((error) => this.reportInternalError(error))
                    .finally(() => this.pendingSinkOperations.delete(promise));
                this.pendingSinkOperations.add(promise);
            }
        } catch (error) {
            this.reportInternalError(error);
        }
    }

    private reportInternalError(error: unknown) {
        try {
            this.options.onInternalError?.(error);
        } catch {
            // Trace diagnostics are deliberately firewalled from game execution.
        }
    }
}

function isPlayerMarker(value: TraceInputValue): value is TracePlayerMarker {
    return typeof value === "object" && value !== null && !Array.isArray(value) && playerMarker in value;
}

function schemaSignature(
    fields: readonly { name: string; type: string; optional: boolean }[]
) {
    return fields.map((field) => `${field.name}:${field.type}:${field.optional ? 1 : 0}`).join("|");
}
