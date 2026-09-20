import { expect, test } from "vitest";
import {
    decodeTraceIngestParts,
    encodeTraceIngestParts,
    parseTraceIngestPart,
    TRACE_INGEST_VERSION,
} from "../packages/trace/dist/index.js";

test("ingest parts round-trip arbitrary bytes", () => {
    // 3000 bytes encode to exactly 4000 Base64 characters.
    const bytes = Uint8Array.from({ length: 3000 }, (_, index) => index % 251);
    const parts = encodeTraceIngestParts("session-1", bytes, 1000);

    expect(parts.length).toBe(4);
    expect(parts.every((part) => part.v === TRACE_INGEST_VERSION)).toBe(true);
    expect(parts.map((part) => part.part)).toEqual([0, 1, 2, 3]);
    expect(parts.every((part) => part.sessionId === "session-1")).toBe(true);
    expect(decodeTraceIngestParts(parts)).toEqual(bytes);
});

test("an empty container still produces one part", () => {
    const parts = encodeTraceIngestParts("empty", new Uint8Array());
    expect(parts).toHaveLength(1);
    expect(decodeTraceIngestParts(parts)).toEqual(new Uint8Array());
});

test("malformed parts are rejected", () => {
    expect(parseTraceIngestPart(null)).toBeUndefined();
    expect(parseTraceIngestPart({})).toBeUndefined();
    expect(parseTraceIngestPart({ v: 2, sessionId: "a", part: 0, parts: 1, data: "" })).toBeUndefined();
    expect(parseTraceIngestPart({ v: 1, sessionId: "", part: 0, parts: 1, data: "" })).toBeUndefined();
    expect(parseTraceIngestPart({ v: 1, sessionId: "a", part: 2, parts: 1, data: "" })).toBeUndefined();
});

test("incomplete part sets are rejected", () => {
    const parts = encodeTraceIngestParts("session-2", Uint8Array.from([1, 2, 3, 4]), 2);
    expect(parts.length).toBeGreaterThan(1);
    expect(() => decodeTraceIngestParts(parts.slice(0, -1))).toThrow();
});
