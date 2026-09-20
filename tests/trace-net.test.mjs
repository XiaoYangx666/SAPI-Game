import { expect, test } from "vitest";
import {
    parseTraceNetReply,
    parseTraceNetRequest,
    TRACE_NET_VERSION,
} from "../packages/trace/dist/index.js";

test("requests round-trip through the parser", () => {
    const cases = [
        { v: 1, kind: "request", id: "a", op: "list" },
        { v: 1, kind: "request", id: "b", op: "begin", sessionId: "s" },
        { v: 1, kind: "request", id: "c", op: "part", sessionId: "s", part: 3 },
        { v: 1, kind: "request", id: "d", op: "delete", sessionId: "s" },
        { v: 1, kind: "request", id: "e", op: "store", enabled: true },
    ];
    for (const value of cases) {
        expect(parseTraceNetRequest(value)).toEqual(value);
    }
});

test("malformed requests are rejected", () => {
    expect(parseTraceNetRequest(null)).toBeUndefined();
    expect(parseTraceNetRequest({ v: 2, kind: "request", id: "a", op: "list" })).toBeUndefined();
    expect(parseTraceNetRequest({ v: 1, kind: "request", op: "list" })).toBeUndefined();
    expect(parseTraceNetRequest({ v: 1, kind: "request", id: "a", op: "begin" })).toBeUndefined();
    expect(parseTraceNetRequest({ v: 1, kind: "request", id: "a", op: "part", sessionId: "s", part: -1 })).toBeUndefined();
    expect(parseTraceNetRequest({ v: 1, kind: "request", id: "a", op: "store" })).toBeUndefined();
    expect(parseTraceNetRequest({ v: 1, kind: "request", id: "a", op: "nope" })).toBeUndefined();
});

test("replies are recognized structurally", () => {
    expect(
        parseTraceNetReply({
            v: TRACE_NET_VERSION,
            kind: "ready",
            protocolVersion: 1,
            store: { enabled: true, acceptingSessions: true, count: 0, running: 0 },
        })?.kind
    ).toBe("ready");
    expect(
        parseTraceNetReply({
            v: 1,
            kind: "response",
            id: "a",
            op: "list",
            ok: true,
            result: { sessions: [] },
        })?.kind
    ).toBe("response");
    expect(parseTraceNetReply({ v: 1, kind: "response", id: "a", op: "list" })).toBeUndefined();
});
