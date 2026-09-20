import { beforeEach, expect, test } from "vitest";
import {
    decodeBegTrace,
    decodeTraceIngestParts,
    parseTraceIngestPart,
} from "../packages/trace/dist/index.js";
import { createServerNetTraceSink } from "../packages/trace/dist/serverNet.js";
import { requests, resetServerNet, responses } from "./fakes/serverNet.mjs";

const URL = "http://127.0.0.1:8787/api/ingest";

function header(sessionId) {
    return {
        sessionId,
        formatVersion: 1,
        gameType: "probe",
        gameKey: `probe:${sessionId}`,
        gameInstanceId: sessionId,
        startTick: 1,
        startWallTime: 1000,
    };
}

function end(sessionId) {
    return {
        sessionId,
        status: "completed",
        endTick: 2,
        endWallTime: 2000,
        eventCount: 0,
        chunkCount: 0,
    };
}

function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => resetServerNet());

test("a completed session is uploaded as ingest parts", async () => {
    const sink = createServerNetTraceSink({ url: URL });
    sink.onSessionStart(header("s1"));
    sink.onSessionEnd(end("s1"));
    await flush();

    expect(requests).toHaveLength(1);
    expect(requests[0].uri).toBe(URL);
    expect(requests[0].method).toBe("Post");

    const part = parseTraceIngestPart(JSON.parse(requests[0].body));
    expect(part.sessionId).toBe("s1");
    expect(part.part).toBe(0);
    expect(part.parts).toBe(1);
    expect(decodeBegTrace(decodeTraceIngestParts([part])).header.sessionId).toBe("s1");
});

test("the shared token is sent as a header", async () => {
    const sink = createServerNetTraceSink({ url: URL, token: "secret" });
    sink.onSessionStart(header("s2"));
    sink.onSessionEnd(end("s2"));
    await flush();

    expect(requests[0].headers).toContainEqual(["x-begame-token", "secret"]);
});

test("a non-2xx response is reported, not thrown", async () => {
    const errors = [];
    responses.push({ status: 500 });
    const sink = createServerNetTraceSink({
        url: URL,
        onError: (error) => errors.push(error),
    });
    sink.onSessionStart(header("s3"));
    sink.onSessionEnd(end("s3"));
    await flush();

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain("HTTP 500");
});

test("a rejected request does not stop later uploads", async () => {
    const errors = [];
    responses.push(new Error("network down"));
    const sink = createServerNetTraceSink({
        url: URL,
        onError: (error) => errors.push(error),
    });
    sink.onSessionStart(header("s4"));
    sink.onSessionEnd(end("s4"));
    sink.onSessionStart(header("s5"));
    sink.onSessionEnd(end("s5"));
    await flush();

    expect(errors).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(parseTraceIngestPart(JSON.parse(requests[1].body)).sessionId).toBe("s5");
});

test("a session without an end event is not uploaded", async () => {
    const sink = createServerNetTraceSink({ url: URL });
    sink.onSessionStart(header("s6"));
    await flush();
    expect(requests).toHaveLength(0);
});
