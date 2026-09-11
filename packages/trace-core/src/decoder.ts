import { BinaryReader } from "./binary";
import { decodeBegTraceContainer } from "./container";
import {
    TraceFieldTypeCode,
    TraceRecordTag,
    TraceSourceKindCode,
    TraceValueTag,
} from "./format";
import {
    BUILTIN_TRACE_EVENT_NAMES,
    TRACE_CHUNK_MAGIC,
    TRACE_FORMAT_VERSION,
    type DecodedTraceEvent,
    type DecodedTraceSession,
    type TraceSource,
    type TraceSourceKind,
    type TraceValue,
} from "./types";

interface PlayerDefinition {
    id: string;
    name?: string;
}

interface SchemaField {
    name: string;
    type: TraceFieldTypeCode;
    optional: boolean;
}

interface SchemaDefinition {
    name: string;
    fields: SchemaField[];
}

interface DecodeTables {
    strings: Map<number, string>;
    players: Map<number, PlayerDefinition>;
    states: Map<number, string>;
    components: Map<number, { stateRef: number; name: string; tag?: string }>;
    schemas: Map<number, SchemaDefinition>;
}

export function decodeBegTrace(bytes: Uint8Array): DecodedTraceSession {
    const container = decodeBegTraceContainer(bytes);
    const tables: DecodeTables = {
        strings: new Map(),
        players: new Map(),
        states: new Map(),
        components: new Map(),
        schemas: new Map(),
    };
    const events: DecodedTraceEvent[] = [];
    for (const chunk of container.chunks) decodeChunk(chunk, tables, events);
    if (events.length !== container.end.eventCount) {
        throw new TypeError(
            `Trace event count mismatch: decoded=${events.length}, expected=${container.end.eventCount}`
        );
    }
    return { header: container.header, end: container.end, events };
}

function decodeChunk(
    bytes: Uint8Array,
    tables: DecodeTables,
    output: DecodedTraceEvent[]
) {
    const reader = new BinaryReader(bytes);
    const magic = String.fromCharCode(...reader.readBytes(TRACE_CHUNK_MAGIC.length));
    if (magic !== TRACE_CHUNK_MAGIC) throw new TypeError("Invalid BEGame trace chunk");
    const version = reader.readByte();
    if (version !== TRACE_FORMAT_VERSION) {
        throw new TypeError(`Unsupported BEGame trace chunk format: ${version}`);
    }
    reader.readVarUint(); // chunk index
    const firstSequence = reader.readVarUint();
    const baseTick = reader.readVarUint();
    const expectedEventCount = reader.readVarUint();
    let eventIndex = 0;
    let previousTick = baseTick;

    while (reader.remaining > 0) {
        const tag = reader.readByte() as TraceRecordTag;
        switch (tag) {
            case TraceRecordTag.StringDefinition: {
                tables.strings.set(reader.readVarUint(), reader.readString());
                break;
            }
            case TraceRecordTag.PlayerDefinition: {
                const ref = reader.readVarUint();
                const id = getString(tables, reader.readVarUint());
                const nameRef = reader.readVarUint();
                tables.players.set(ref, {
                    id,
                    ...(nameRef === 0 ? {} : { name: getString(tables, nameRef - 1) }),
                });
                break;
            }
            case TraceRecordTag.StateDefinition: {
                tables.states.set(reader.readVarUint(), getString(tables, reader.readVarUint()));
                break;
            }
            case TraceRecordTag.ComponentDefinition: {
                const ref = reader.readVarUint();
                const stateRef = reader.readVarUint();
                const name = getString(tables, reader.readVarUint());
                const tagRef = reader.readVarUint();
                tables.components.set(ref, {
                    stateRef,
                    name,
                    ...(tagRef === 0 ? {} : { tag: getString(tables, tagRef - 1) }),
                });
                break;
            }
            case TraceRecordTag.SchemaDefinition: {
                const typeId = reader.readVarUint();
                const name = getString(tables, reader.readVarUint());
                const fieldCount = reader.readVarUint();
                const fields: SchemaField[] = [];
                for (let i = 0; i < fieldCount; i++) {
                    fields.push({
                        name: getString(tables, reader.readVarUint()),
                        type: reader.readByte() as TraceFieldTypeCode,
                        optional: reader.readByte() !== 0,
                    });
                }
                tables.schemas.set(typeId, { name, fields });
                break;
            }
            case TraceRecordTag.Event: {
                const tick = previousTick + reader.readVarUint();
                previousTick = tick;
                const typeId = reader.readVarUint();
                const source = readSource(reader, tables);
                const schema = tables.schemas.get(typeId);
                const payload = schema
                    ? readCustomPayload(reader, tables, schema)
                    : readValue(reader, tables);
                const type = schema?.name ?? BUILTIN_TRACE_EVENT_NAMES[typeId] ?? `unknown.${typeId}`;
                output.push({
                    sequence: firstSequence + eventIndex,
                    tick,
                    typeId,
                    type,
                    source,
                    payload,
                });
                eventIndex++;
                break;
            }
            default:
                throw new TypeError(`Unknown BEGame trace record: ${tag}`);
        }
    }

    if (eventIndex !== expectedEventCount) {
        throw new TypeError(
            `Trace chunk event count mismatch: decoded=${eventIndex}, expected=${expectedEventCount}`
        );
    }
}

function readSource(reader: BinaryReader, tables: DecodeTables): TraceSource {
    const kind = sourceKind(reader.readByte() as TraceSourceKindCode);
    const refPlusOne = reader.readVarUint();
    const namePlusOne = reader.readVarUint();
    return {
        kind,
        ...(refPlusOne === 0 ? {} : { ref: refPlusOne - 1 }),
        ...(namePlusOne === 0 ? {} : { name: getString(tables, namePlusOne - 1) }),
    };
}

function sourceKind(code: TraceSourceKindCode): TraceSourceKind {
    switch (code) {
        case TraceSourceKindCode.Game:
            return "game";
        case TraceSourceKindCode.State:
            return "state";
        case TraceSourceKindCode.Component:
            return "component";
        case TraceSourceKindCode.Runner:
            return "runner";
        case TraceSourceKindCode.Timer:
            return "timer";
        case TraceSourceKindCode.Participation:
            return "participation";
        case TraceSourceKindCode.Connection:
            return "connection";
        case TraceSourceKindCode.System:
            return "system";
        default:
            throw new TypeError(`Unknown trace source kind: ${code}`);
    }
}

function readValue(reader: BinaryReader, tables: DecodeTables): TraceValue {
    const tag = reader.readByte() as TraceValueTag;
    switch (tag) {
        case TraceValueTag.Null:
            return null;
        case TraceValueTag.False:
            return false;
        case TraceValueTag.True:
            return true;
        case TraceValueTag.UInt:
            return reader.readVarUint();
        case TraceValueTag.Int:
            return reader.readVarInt();
        case TraceValueTag.Number:
            return reader.readFloat64();
        case TraceValueTag.StringRef:
            return getString(tables, reader.readVarUint());
        case TraceValueTag.PlayerRef:
            return getPlayer(tables, reader.readVarUint()).id;
        case TraceValueTag.Array: {
            const length = reader.readVarUint();
            const values: TraceValue[] = [];
            for (let i = 0; i < length; i++) values.push(readValue(reader, tables));
            return values;
        }
        case TraceValueTag.Object: {
            const length = reader.readVarUint();
            const value: Record<string, TraceValue> = {};
            for (let i = 0; i < length; i++) {
                value[getString(tables, reader.readVarUint())] = readValue(reader, tables);
            }
            return value;
        }
        default:
            throw new TypeError(`Unknown trace value tag: ${tag}`);
    }
}

function readCustomPayload(
    reader: BinaryReader,
    tables: DecodeTables,
    schema: SchemaDefinition
): TraceValue {
    const bitset = reader.readBytes(reader.readVarUint());
    let optionalIndex = 0;
    const result: Record<string, TraceValue> = {};
    for (const field of schema.fields) {
        let present = true;
        if (field.optional) {
            present = (bitset[Math.floor(optionalIndex / 8)] & (1 << (optionalIndex % 8))) !== 0;
            optionalIndex++;
        }
        if (!present) continue;
        result[field.name] = readCustomField(reader, tables, field.type);
    }
    return result;
}

function readCustomField(
    reader: BinaryReader,
    tables: DecodeTables,
    type: TraceFieldTypeCode
): TraceValue {
    switch (type) {
        case TraceFieldTypeCode.Boolean:
            return reader.readByte() !== 0;
        case TraceFieldTypeCode.UInt:
            return reader.readVarUint();
        case TraceFieldTypeCode.Int:
            return reader.readVarInt();
        case TraceFieldTypeCode.Number:
            return reader.readFloat64();
        case TraceFieldTypeCode.String:
            return getString(tables, reader.readVarUint());
        case TraceFieldTypeCode.Player:
            return getPlayer(tables, reader.readVarUint()).id;
        default:
            throw new TypeError(`Unknown trace schema field type: ${type}`);
    }
}

function getString(tables: DecodeTables, ref: number) {
    const value = tables.strings.get(ref);
    if (value === undefined) throw new TypeError(`Unknown trace string ref: ${ref}`);
    return value;
}

function getPlayer(tables: DecodeTables, ref: number) {
    const value = tables.players.get(ref);
    if (value === undefined) throw new TypeError(`Unknown trace player ref: ${ref}`);
    return value;
}
