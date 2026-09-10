import { BinaryReader, BinaryWriter, concatBytes, readRawValue, writeRawValue } from "./binary";
import {
    TRACE_FORMAT_VERSION,
    TRACE_MAGIC,
    type TraceChunk,
    type TraceSessionEnd,
    type TraceSessionHeader,
    type TraceSessionStatus,
} from "./types";

const statusCodes: Record<Exclude<TraceSessionStatus, "running">, number> = {
    completed: 0,
    aborted: 1,
    crashed: 2,
    interrupted: 3,
    reloaded: 4,
};
const statusNames = ["completed", "aborted", "crashed", "interrupted", "reloaded"] as const;

export interface BegTraceContainer {
    readonly header: TraceSessionHeader;
    readonly chunks: readonly Uint8Array[];
    readonly end: TraceSessionEnd;
}

export function encodeBegTrace(
    header: TraceSessionHeader,
    chunks: readonly Pick<TraceChunk, "bytes">[],
    end: TraceSessionEnd
) {
    const writer = new BinaryWriter();
    for (const char of TRACE_MAGIC) writer.writeByte(char.charCodeAt(0));
    writer.writeByte(TRACE_FORMAT_VERSION);
    writer.writeString(header.sessionId);
    writer.writeString(header.gameType);
    writer.writeString(header.gameKey);
    writer.writeString(header.gameInstanceId);
    let flags = 0;
    if (header.begameVersion !== undefined) flags |= 1;
    if (header.packVersion !== undefined) flags |= 2;
    if (header.initialConfig !== undefined) flags |= 4;
    writer.writeByte(flags);
    if (header.begameVersion !== undefined) writer.writeString(header.begameVersion);
    if (header.packVersion !== undefined) writer.writeString(header.packVersion);
    writer.writeVarUint(header.startTick);
    writer.writeVarUint(header.startWallTime);
    if (header.initialConfig !== undefined) writeRawValue(writer, header.initialConfig);

    writer.writeVarUint(chunks.length);
    for (const chunk of chunks) {
        writer.writeVarUint(chunk.bytes.length);
        writer.writeBytes(chunk.bytes);
    }

    writer.writeByte(statusCodes[end.status]);
    writer.writeVarUint(end.endTick);
    writer.writeVarUint(end.endWallTime);
    writer.writeByte(end.endReason === undefined ? 0 : 1);
    if (end.endReason !== undefined) writer.writeString(end.endReason);
    writer.writeVarUint(end.eventCount);
    writer.writeVarUint(end.chunkCount);
    return writer.toUint8Array();
}

export function decodeBegTraceContainer(bytes: Uint8Array): BegTraceContainer {
    const reader = new BinaryReader(bytes);
    const magic = String.fromCharCode(...reader.readBytes(TRACE_MAGIC.length));
    if (magic !== TRACE_MAGIC) throw new TypeError("Not a BEGame trace file");
    const formatVersion = reader.readByte();
    if (formatVersion !== TRACE_FORMAT_VERSION) {
        throw new TypeError(`Unsupported BEGame trace format: ${formatVersion}`);
    }

    const sessionId = reader.readString();
    const gameType = reader.readString();
    const gameKey = reader.readString();
    const gameInstanceId = reader.readString();
    const flags = reader.readByte();
    const begameVersion = flags & 1 ? reader.readString() : undefined;
    const packVersion = flags & 2 ? reader.readString() : undefined;
    const startTick = reader.readVarUint();
    const startWallTime = reader.readVarUint();
    const initialConfig = flags & 4 ? readRawValue(reader) : undefined;
    const header: TraceSessionHeader = {
        sessionId,
        formatVersion,
        gameType,
        gameKey,
        gameInstanceId,
        ...(begameVersion === undefined ? {} : { begameVersion }),
        ...(packVersion === undefined ? {} : { packVersion }),
        startTick,
        startWallTime,
        ...(initialConfig === undefined ? {} : { initialConfig }),
    };

    const chunkCount = reader.readVarUint();
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < chunkCount; i++) {
        chunks.push(Uint8Array.from(reader.readBytes(reader.readVarUint())));
    }

    const statusCode = reader.readByte();
    const status = statusNames[statusCode];
    if (status === undefined) throw new TypeError(`Unknown trace status: ${statusCode}`);
    const endTick = reader.readVarUint();
    const endWallTime = reader.readVarUint();
    const hasReason = reader.readByte() !== 0;
    const endReason = hasReason ? reader.readString() : undefined;
    const eventCount = reader.readVarUint();
    const encodedChunkCount = reader.readVarUint();
    if (reader.remaining !== 0) throw new TypeError("Trailing bytes in BEGame trace file");
    const end: TraceSessionEnd = {
        sessionId,
        status,
        endTick,
        endWallTime,
        ...(endReason === undefined ? {} : { endReason }),
        eventCount,
        chunkCount: encodedChunkCount,
    };
    return { header, chunks, end };
}
