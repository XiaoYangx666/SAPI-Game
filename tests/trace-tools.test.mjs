import { expect, test } from "vitest";
import {
    encodeBase64,
    encodeBegTrace,
} from "../packages/core/dist/trace/index.js";
import {
    collectTraceExports,
    decodeTraceLog,
    extractBegTraceBytes,
    extractTraceLogParts,
} from "../packages/trace-tools/dist/index.js";

function makeTraceBytes() {
    const header = {
        sessionId: "trace-export-test",
        formatVersion: 1,
        gameType: "parser-test",
        gameKey: "parser-test:0",
        gameInstanceId: "trace-export-test",
        startTick: 10,
        startWallTime: 1000,
    };
    const end = {
        sessionId: header.sessionId,
        status: "completed",
        endTick: 20,
        endWallTime: 1500,
        endReason: "test",
        eventCount: 0,
        chunkCount: 0,
    };
    return encodeBegTrace(header, [], end);
}

test("trace-tools extracts multipart warning records from a normal Minecraft Content Log", () => {
    const bytes = makeTraceBytes();
    const base64 = encodeBase64(bytes);
    const cut = Math.floor(base64.length / 2);
    const first = base64.slice(0, cut);
    const second = base64.slice(cut);

    const contentLog = `[Localization][warning]-Line: 565 - Invalid lang file format. New line character was found while parsing key: '#2026 drop 3'.\n\n` +
        `[Sound][inform]-No sound found for block type 'normal'\n\n` +
        `[Scripting][warning]-[BEGAME_TRACE:v1:trace-export-test:1/2]${first}\n\n` +
        `[Scripting][warning]-some unrelated warning\n\n` +
        `[Scripting][warning]-[BEGAME_TRACE:v1:trace-export-test:2/2]${second}\n`;

    const parts = extractTraceLogParts(contentLog);
    expect(parts).toHaveLength(2);
    expect(parts.map((part) => part.part)).toEqual([1, 2]);

    const exports = collectTraceExports(contentLog);
    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatchObject({
        sessionId: "trace-export-test",
        formatVersion: 1,
        partCount: 2,
        receivedParts: [1, 2],
        missingParts: [],
        complete: true,
    });

    expect(extractBegTraceBytes(contentLog)).toEqual(bytes);
    const decoded = decodeTraceLog(contentLog);
    expect(decoded.header.gameType).toBe("parser-test");
    expect(decoded.end.status).toBe("completed");
    expect(decoded.end.endReason).toBe("test");
});

test("trace-tools reports incomplete multipart exports", () => {
    const contentLog =
        "[Scripting][warning]-[BEGAME_TRACE:v1:missing-test:1/2]QUJD\n";
    const collected = collectTraceExports(contentLog);
    expect(collected[0].complete).toBe(false);
    expect(collected[0].missingParts).toEqual([2]);
    expect(() => extractBegTraceBytes(contentLog, "missing-test")).toThrow(
        /missing parts: 2/
    );
});
