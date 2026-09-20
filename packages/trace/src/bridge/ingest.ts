/**
 * Wire format for pushing traces to the Observatory over HTTP.
 *
 * `@minecraft/server-net` can only send string bodies, so a `.begtrace`
 * container is Base64-encoded and split into parts. The same envelope is
 * decoded by the observatory server, so both sides share this module instead of
 * duplicating constants.
 *
 * The protocol is deliberately transport-agnostic: it says nothing about HTTP,
 * auth or storage, only how one upload part looks.
 */
import { decodeBase64, encodeBase64 } from "../wire/base64";

export const TRACE_INGEST_VERSION = 1;
/** Default maximum Base64 characters per part (≈384 KiB of decoded bytes). */
export const TRACE_INGEST_PART_CHARS = 384 * 1024;

/** One uploaded slice of a session container. */
export interface TraceIngestPart {
    /** Protocol version. */
    readonly v: typeof TRACE_INGEST_VERSION;
    readonly sessionId: string;
    /** 0-based index of this part. */
    readonly part: number;
    /** Total number of parts in this upload. */
    readonly parts: number;
    /** Base64 of this part's slice of the container bytes. */
    readonly data: string;
}

/**
 * Splits a container into upload parts. Always returns at least one part so an
 * empty-but-valid session still uploads.
 */
export function encodeTraceIngestParts(
    sessionId: string,
    bytes: Uint8Array,
    partChars: number = TRACE_INGEST_PART_CHARS
): TraceIngestPart[] {
    const encoded = encodeBase64(bytes);
    const size = Math.max(1, Math.floor(partChars));
    const parts = Math.max(1, Math.ceil(encoded.length / size));
    const result: TraceIngestPart[] = [];
    for (let part = 0; part < parts; part++) {
        result.push({
            v: TRACE_INGEST_VERSION,
            sessionId,
            part,
            parts,
            data: encoded.slice(part * size, (part + 1) * size),
        });
    }
    return result;
}

/** Validates one decoded JSON value as an ingest part. */
export function parseTraceIngestPart(value: unknown): TraceIngestPart | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (record.v !== TRACE_INGEST_VERSION) return undefined;
    if (typeof record.sessionId !== "string" || record.sessionId.length === 0) {
        return undefined;
    }
    if (
        !Number.isSafeInteger(record.part) ||
        !Number.isSafeInteger(record.parts) ||
        (record.part as number) < 0 ||
        (record.parts as number) < 1 ||
        (record.part as number) >= (record.parts as number)
    ) {
        return undefined;
    }
    if (typeof record.data !== "string") return undefined;
    return {
        v: TRACE_INGEST_VERSION,
        sessionId: record.sessionId,
        part: record.part as number,
        parts: record.parts as number,
        data: record.data,
    };
}

/**
 * Reassembles a complete, ordered part set into container bytes. Throws when
 * the set is incomplete or internally inconsistent; callers treat that as a
 * rejected upload.
 */
export function decodeTraceIngestParts(
    parts: readonly TraceIngestPart[]
): Uint8Array {
    if (parts.length === 0) throw new Error("no ingest parts");
    const parts_ = parts[0].parts;
    if (parts.length !== parts_) {
        throw new Error(`ingest part count mismatch: ${parts.length}/${parts_}`);
    }
    const ordered = [...parts].sort((a, b) => a.part - b.part);
    for (let index = 0; index < ordered.length; index++) {
        if (ordered[index].part !== index) {
            throw new Error(`ingest part missing at ${index}`);
        }
    }
    return decodeBase64(ordered.map((part) => part.data).join(""));
}
