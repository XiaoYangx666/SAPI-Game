import {
    decodeBegTrace,
    encodeBegTrace,
    type DecodedTraceSession,
    type TraceChunk,
    type TraceSessionEnd,
    type TraceSessionHeader,
    type TraceSink,
} from "@begame/core/trace";
// @ts-expect-error @begame/test is Node-only, while the shared tsconfig intentionally omits Node types.
import { writeFileSync } from "node:fs";

export interface TestTraceRecord {
    readonly header: TraceSessionHeader;
    readonly chunks: TraceChunk[];
    end?: TraceSessionEnd;
}

/** In-memory sink used by headless tests and CI assertions. */
export class TestTraceSink implements TraceSink {
    private readonly sessions = new Map<string, TestTraceRecord>();
    private readonly order: string[] = [];

    onSessionStart(header: TraceSessionHeader) {
        this.sessions.set(header.sessionId, { header, chunks: [] });
        this.order.push(header.sessionId);
    }

    onChunk(chunk: TraceChunk) {
        const record = this.sessions.get(chunk.sessionId);
        if (!record) throw new Error(`Unknown trace session ${chunk.sessionId}`);
        record.chunks.push({ ...chunk, bytes: Uint8Array.from(chunk.bytes) });
    }

    onSessionEnd(end: TraceSessionEnd) {
        const record = this.sessions.get(end.sessionId);
        if (!record) throw new Error(`Unknown trace session ${end.sessionId}`);
        record.end = end;
    }

    get size() {
        return this.sessions.size;
    }

    getAll(): readonly TestTraceRecord[] {
        return this.order.map((id) => this.sessions.get(id)!).filter(Boolean);
    }

    get(sessionId: string) {
        return this.sessions.get(sessionId);
    }

    getLatest() {
        const id = this.order.at(-1);
        return id === undefined ? undefined : this.sessions.get(id);
    }

    toBytes(sessionId?: string): Uint8Array {
        const record = sessionId ? this.sessions.get(sessionId) : this.getLatest();
        if (!record) throw new Error("No trace session available");
        if (!record.end) throw new Error(`Trace session ${record.header.sessionId} is still running`);
        return encodeBegTrace(record.header, record.chunks, record.end);
    }

    decode(sessionId?: string): DecodedTraceSession {
        return decodeBegTrace(this.toBytes(sessionId));
    }

    clear() {
        this.sessions.clear();
        this.order.length = 0;
    }
}

/** Node-only sink for @begame/test / CI. Core never imports node:fs. */
export class FileTraceSink extends TestTraceSink {
    constructor(
        private readonly filePath: string | ((header: TraceSessionHeader) => string)
    ) {
        super();
    }

    override onSessionEnd(end: TraceSessionEnd) {
        super.onSessionEnd(end);
        const record = this.get(end.sessionId)!;
        const path =
            typeof this.filePath === "function"
                ? this.filePath(record.header)
                : this.filePath;
        writeFileSync(path, this.toBytes(end.sessionId));
    }
}
