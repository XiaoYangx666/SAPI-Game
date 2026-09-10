import {
    decodeBase64,
    decodeBegTrace,
    type DecodedTraceSession,
} from "@begame/core/trace";

export const TRACE_LOG_MARKER = "BEGAME_TRACE";

const tracePartPattern =
    /\[BEGAME_TRACE:v(\d+):([^:\]\r\n]+):(\d+)\/(\d+)\]([A-Za-z0-9+/=]+)/g;

export interface TraceLogPart {
    readonly formatVersion: number;
    readonly sessionId: string;
    readonly part: number;
    readonly partCount: number;
    readonly payload: string;
    readonly offset: number;
}

export interface CollectedTraceExport {
    readonly formatVersion: number;
    readonly sessionId: string;
    readonly partCount: number;
    readonly receivedParts: readonly number[];
    readonly missingParts: readonly number[];
    readonly complete: boolean;
    readonly base64?: string;
    readonly lastOffset: number;
}

/** Extract BEGame trace parts from an otherwise arbitrary Minecraft Content Log. */
export function extractTraceLogParts(content: string): TraceLogPart[] {
    const parts: TraceLogPart[] = [];
    tracePartPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = tracePartPattern.exec(content))) {
        const formatVersion = Number(match[1]);
        const part = Number(match[3]);
        const partCount = Number(match[4]);
        if (
            !Number.isSafeInteger(formatVersion) ||
            !Number.isSafeInteger(part) ||
            !Number.isSafeInteger(partCount) ||
            part <= 0 ||
            partCount <= 0 ||
            part > partCount
        ) {
            continue;
        }
        parts.push({
            formatVersion,
            sessionId: match[2],
            part,
            partCount,
            payload: match[5],
            offset: match.index,
        });
    }
    return parts;
}

/**
 * Group repeated/multipart log records. Duplicate identical parts are tolerated;
 * conflicting duplicates are rejected instead of silently corrupting a trace.
 */
export function collectTraceExports(content: string): CollectedTraceExport[] {
    interface MutableGroup {
        formatVersion: number;
        sessionId: string;
        partCount: number;
        parts: Map<number, string>;
        lastOffset: number;
    }

    const groups = new Map<string, MutableGroup>();
    for (const entry of extractTraceLogParts(content)) {
        const key = `${entry.formatVersion}:${entry.sessionId}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                formatVersion: entry.formatVersion,
                sessionId: entry.sessionId,
                partCount: entry.partCount,
                parts: new Map(),
                lastOffset: entry.offset,
            };
            groups.set(key, group);
        }
        if (group.partCount !== entry.partCount) {
            throw new TypeError(
                `Conflicting Trace part count for ${entry.sessionId}`
            );
        }
        const previous = group.parts.get(entry.part);
        if (previous !== undefined && previous !== entry.payload) {
            throw new TypeError(
                `Conflicting duplicate Trace part ${entry.sessionId}:${entry.part}`
            );
        }
        group.parts.set(entry.part, entry.payload);
        group.lastOffset = Math.max(group.lastOffset, entry.offset);
    }

    return [...groups.values()]
        .map((group): CollectedTraceExport => {
            const receivedParts = [...group.parts.keys()].sort((a, b) => a - b);
            const missingParts: number[] = [];
            for (let part = 1; part <= group.partCount; part++) {
                if (!group.parts.has(part)) missingParts.push(part);
            }
            const complete = missingParts.length === 0;
            return {
                formatVersion: group.formatVersion,
                sessionId: group.sessionId,
                partCount: group.partCount,
                receivedParts,
                missingParts,
                complete,
                ...(complete
                    ? {
                          base64: Array.from(
                              { length: group.partCount },
                              (_, index) => group.parts.get(index + 1)!
                          ).join(""),
                      }
                    : {}),
                lastOffset: group.lastOffset,
            };
        })
        .sort((a, b) => a.lastOffset - b.lastOffset);
}

/** Extract raw .begtrace bytes. Without an id, the latest complete export is used. */
export function extractBegTraceBytes(
    content: string,
    sessionId?: string
): Uint8Array {
    const exports = collectTraceExports(content);
    const selected = sessionId
        ? exports.find(
              (entry) => entry.sessionId === sessionId && entry.complete
          )
        : [...exports].reverse().find((entry) => entry.complete);

    if (!selected?.base64) {
        if (sessionId) {
            const incomplete = exports.find(
                (entry) => entry.sessionId === sessionId
            );
            if (incomplete) {
                throw new Error(
                    `Trace export ${sessionId} is incomplete; missing parts: ${incomplete.missingParts.join(", ")}`
                );
            }
            throw new Error(`Trace export not found: ${sessionId}`);
        }
        throw new Error("No complete BEGame Trace export found in Content Log");
    }
    return decodeBase64(selected.base64);
}

/** Parse Content Log text all the way into the logical BEGame Trace session. */
export function decodeTraceLog(
    content: string,
    sessionId?: string
): DecodedTraceSession {
    return decodeBegTrace(extractBegTraceBytes(content, sessionId));
}
