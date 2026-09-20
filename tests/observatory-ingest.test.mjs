import { expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    decodeBegTrace,
    encodeBegTrace,
    encodeTraceIngestParts,
} from "../packages/trace/dist/index.js";
import { createApp } from "../packages/observatory/server/app.ts";
import { IngestStore } from "../packages/observatory/server/ingest.ts";

function makeTraceBytes(sessionId) {
    return encodeBegTrace(
        {
            sessionId,
            formatVersion: 1,
            gameType: "ingest-test",
            gameKey: `ingest-test:${sessionId}`,
            gameInstanceId: sessionId,
            startTick: 0,
            startWallTime: 0,
        },
        [],
        {
            sessionId,
            status: "completed",
            endTick: 10,
            endWallTime: 100,
            endReason: "test",
            eventCount: 0,
            chunkCount: 0,
        }
    );
}

async function withStore(token, run) {
    const dir = mkdtempSync(join(tmpdir(), "begame-ingest-"));
    try {
        return await run(createApp(undefined, new IngestStore(dir, token)), dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

async function upload(app, sessionId, bytes, token) {
    const headers = { "content-type": "application/json" };
    if (token) headers["x-begame-token"] = token;
    const parts = encodeTraceIngestParts(sessionId, bytes, 64);
    let status = 0;
    for (const part of parts) {
        const response = await app.request("/api/ingest", {
            method: "POST",
            headers,
            body: JSON.stringify(part),
        });
        status = response.status;
        if (!response.ok) return response;
    }
    return { status };
}

test("a pushed session is stored and can be read back", async () => {
    await withStore(undefined, async (app) => {
        const bytes = makeTraceBytes("pushed-1");
        const response = await upload(app, "pushed-1", bytes);
        expect(response.status).toBe(202);

        const listed = await (await app.request("/api/ingest/sessions")).json();
        expect(listed.sessions.map((entry) => entry.sessionId)).toContain("pushed-1");

        const downloaded = await app.request("/api/ingest/session/pushed-1");
        expect(downloaded.status).toBe(200);
        const stored = new Uint8Array(await downloaded.arrayBuffer());
        expect(decodeBegTrace(stored).header.sessionId).toBe("pushed-1");
    });
});

test("an incomplete upload is not stored until all parts arrive", async () => {
    await withStore(undefined, async (app) => {
        const bytes = makeTraceBytes("pushed-2");
        const parts = encodeTraceIngestParts("pushed-2", bytes, 64);
        expect(parts.length).toBeGreaterThan(1);

        const partial = await app.request("/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parts[0]),
        });
        expect(partial.status).toBe(202);
        expect((await partial.json()).complete).toBe(false);

        const listed = await (await app.request("/api/ingest/sessions")).json();
        expect(listed.sessions.map((entry) => entry.sessionId)).not.toContain("pushed-2");
    });
});

test("a token-protected ingest rejects missing or wrong tokens", async () => {
    await withStore("s3cret", async (app) => {
        const bytes = makeTraceBytes("pushed-3");
        const denied = await upload(app, "pushed-3", bytes);
        expect(denied.status).toBe(401);

        const allowed = await upload(app, "pushed-3", bytes, "s3cret");
        expect(allowed.status).toBe(202);
    });
});

test("malformed parts are rejected with 400", async () => {
    await withStore(undefined, async (app) => {
        const response = await app.request("/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ v: 1, sessionId: "x", part: 5, parts: 1, data: "" }),
        });
        expect(response.status).toBe(400);
    });
});
