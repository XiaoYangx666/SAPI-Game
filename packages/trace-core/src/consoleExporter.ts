import { encodeBase64 } from "./base64";
import { TRACE_FORMAT_VERSION } from "./types";

export const TRACE_CONSOLE_MARKER = "BEGAME_TRACE";
export const DEFAULT_TRACE_CONSOLE_PAYLOAD_CHARS = 24_000;

/** Minimal history source required by the console export channel. */
export interface TraceExportStore {
    latest(): { readonly sessionId: string } | undefined;
    toBytes(sessionId: string): Uint8Array;
}

export interface ConsoleTraceExporterOptions {
    /** Base64 payload characters per console.warn call. */
    readonly maxPayloadChars?: number;
}

export interface ConsoleTraceExportResult {
    readonly sessionId: string;
    readonly binaryBytes: number;
    readonly base64Chars: number;
    readonly partCount: number;
}

/**
 * Human-copyable export channel for Minecraft Content Log / Content Log GUI.
 * The Minecraft log prefix is intentionally not part of the format; parsers scan
 * for the BEGAME_TRACE marker anywhere in a line.
 */
export class ConsoleTraceExporter {
    private maxPayloadChars = DEFAULT_TRACE_CONSOLE_PAYLOAD_CHARS;

    constructor(
        private readonly store: TraceExportStore,
        options: ConsoleTraceExporterOptions = {}
    ) {
        this.configure(options);
    }

    configure(options: ConsoleTraceExporterOptions = {}) {
        if (options.maxPayloadChars !== undefined) {
            if (
                !Number.isSafeInteger(options.maxPayloadChars) ||
                options.maxPayloadChars <= 0
            ) {
                throw new TypeError("maxPayloadChars must be a positive integer");
            }
            this.maxPayloadChars = options.maxPayloadChars;
        }
        return this;
    }

    /** Export the requested stored session, or the latest completed session. */
    export(sessionId?: string): ConsoleTraceExportResult {
        const resolvedSessionId = sessionId ?? this.store.latest()?.sessionId;
        if (!resolvedSessionId) {
            throw new Error("No completed stored Trace Session is available");
        }

        const bytes = this.store.toBytes(resolvedSessionId);
        const base64 = encodeBase64(bytes);
        const partCount = Math.max(
            1,
            Math.ceil(base64.length / this.maxPayloadChars)
        );

        for (let index = 0; index < partCount; index++) {
            const payload = base64.slice(
                index * this.maxPayloadChars,
                (index + 1) * this.maxPayloadChars
            );
            console.warn(
                `[${TRACE_CONSOLE_MARKER}:v${TRACE_FORMAT_VERSION}:${resolvedSessionId}:${index + 1}/${partCount}]${payload}`
            );
        }

        return {
            sessionId: resolvedSessionId,
            binaryBytes: bytes.length,
            base64Chars: base64.length,
            partCount,
        };
    }
}
