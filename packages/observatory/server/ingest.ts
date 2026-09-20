import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    decodeTraceIngestParts,
    parseTraceIngestPart,
    type TraceIngestPart,
} from "@begame/trace";
import { decodeTracePayload } from "../src/decode.mjs";

/** Reject an upload larger than this across all in-flight sessions. */
const MAX_PENDING_BYTES = 64 * 1024 * 1024;
/** Reject new session ids once this many uploads are in flight. */
const MAX_PENDING_SESSIONS = 64;
/** Abandon an incomplete upload that has not progressed for this long. */
const PENDING_TTL_MS = 5 * 60 * 1000;

interface PendingSession {
    readonly parts: Map<number, TraceIngestPart>;
    total: number;
    chars: number;
    updatedAt: number;
}

export interface IngestSessionSummary {
    readonly sessionId: string;
    readonly bytes: number;
    readonly storedAt: number;
}

export type IngestResult =
    | { readonly ok: true; readonly sessionId: string; readonly complete: boolean }
    | { readonly ok: false; readonly error: string; readonly code: 400 | 413 | 422 | 503 };

function safeId(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
}

/**
 * Receives pushed `.begtrace` uploads from Bedrock Dedicated Server packs.
 *
 * The wire format is shared with the game side through `@begame/trace`'s ingest
 * module; this class only handles reassembly, validation and on-disk retention.
 */
export class IngestStore {
    private readonly pending = new Map<string, PendingSession>();

    constructor(
        private readonly dir: string,
        private readonly token?: string
    ) {
        mkdirSync(dir, { recursive: true });
    }

    /** A missing token disables auth; otherwise the header must match. */
    authorize(provided: string | undefined): boolean {
        return !this.token || provided === this.token;
    }

    accept(value: unknown): IngestResult {
        const part = parseTraceIngestPart(value);
        if (!part) return { ok: false, error: "无效的上传分片", code: 400 };

        this.prune();
        let pending = this.pending.get(part.sessionId);
        if (!pending) {
            if (this.pending.size >= MAX_PENDING_SESSIONS) {
                return { ok: false, error: "上传会话过多，请稍后重试", code: 503 };
            }
            pending = { parts: new Map(), total: part.parts, chars: 0, updatedAt: Date.now() };
            this.pending.set(part.sessionId, pending);
        }
        if (pending.total !== part.parts) {
            this.pending.delete(part.sessionId);
            return { ok: false, error: "分片总数不一致", code: 400 };
        }
        if (!pending.parts.has(part.part)) {
            pending.chars += part.data.length;
            if (pending.chars > MAX_PENDING_BYTES) {
                this.pending.delete(part.sessionId);
                return { ok: false, error: "上传内容过大", code: 413 };
            }
        }
        pending.parts.set(part.part, part);
        pending.updatedAt = Date.now();

        if (pending.parts.size < pending.total) {
            return { ok: true, sessionId: part.sessionId, complete: false };
        }

        this.pending.delete(part.sessionId);
        let bytes: Uint8Array;
        try {
            bytes = decodeTraceIngestParts([...pending.parts.values()]);
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : "分片重组失败",
                code: 422,
            };
        }

        const decoded = decodeTracePayload(bytes);
        if (!decoded.ok || !decoded.selected) {
            return {
                ok: false,
                error: decoded.error ?? "无效的会话数据",
                code: 422,
            };
        }
        const sessionId = safeId(decoded.selected.sessionId);
        writeFileSync(join(this.dir, `${sessionId}.begtrace`), bytes);
        return { ok: true, sessionId, complete: true };
    }

    list(): IngestSessionSummary[] {
        const summaries: IngestSessionSummary[] = [];
        for (const name of readdirSync(this.dir)) {
            if (!name.endsWith(".begtrace")) continue;
            const full = join(this.dir, name);
            try {
                const stat = statSync(full);
                summaries.push({
                    sessionId: name.slice(0, -".begtrace".length),
                    bytes: stat.size,
                    storedAt: stat.mtimeMs,
                });
            } catch {
                // A file removed between readdir and stat is simply skipped.
            }
        }
        return summaries.sort((a, b) => b.storedAt - a.storedAt);
    }

    read(sessionId: string): Buffer | undefined {
        const id = safeId(sessionId);
        if (id !== sessionId) return undefined;
        try {
            return readFileSync(join(this.dir, `${id}.begtrace`));
        } catch {
            return undefined;
        }
    }

    private prune() {
        const cutoff = Date.now() - PENDING_TTL_MS;
        for (const [id, pending] of this.pending) {
            if (pending.updatedAt < cutoff) this.pending.delete(id);
        }
    }
}
