import { expect, test } from "vitest";
import {
    encodeBase64,
    encodeBegTrace,
    TRACE_NET_VERSION,
} from "../packages/trace/dist/index.js";
import { TraceNetBridge } from "../packages/observatory/server/net.ts";

async function listening(bridge) {
    for (let attempt = 0; attempt < 200; attempt++) {
        const port = bridge.boundPort;
        if (port > 0) return port;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("bridge did not start listening");
}

async function waitFor(predicate) {
    for (let attempt = 0; attempt < 200; attempt++) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("condition not met");
}

function traceBytes(sessionId) {
    return Buffer.from(
        encodeBegTrace(
            {
                sessionId,
                formatVersion: 1,
                gameType: "net-test",
                gameKey: `net-test:${sessionId}`,
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
                eventCount: 0,
                chunkCount: 0,
            }
        )
    );
}

/** A scripted stand-in for one BDS pack. */
function fakeGame(socket, sessionId) {
    const bytes = traceBytes(sessionId);
    const encoded = encodeBase64(new Uint8Array(bytes));
    const state = { deleted: false, enabled: true };
    socket.onmessage = (event) => {
        const request = JSON.parse(event.data);
        const reply = (result) =>
            socket.send(
                JSON.stringify({
                    v: TRACE_NET_VERSION,
                    kind: "response",
                    id: request.id,
                    op: request.op,
                    ok: true,
                    result,
                })
            );
        const summary = {
            sessionId,
            gameType: "net-test",
            gameKey: `net-test:${sessionId}`,
            status: "completed",
            startTick: 0,
            startWallTime: 0,
            eventCount: 0,
            chunkCount: 0,
            storedBytes: bytes.length,
        };
        switch (request.op) {
            case "list":
                return reply({ sessions: state.deleted ? [] : [summary] });
            case "begin":
                return reply({ sessionId: request.sessionId, parts: 1, chars: encoded.length });
            case "part":
                return reply({ sessionId: request.sessionId, part: request.part, data: encoded });
            case "delete":
                state.deleted = true;
                return reply({ sessionId: request.sessionId, deleted: true });
            case "clear":
                state.deleted = true;
                return reply({ removed: 1 });
            case "store":
                state.enabled = request.enabled;
                return reply({ enabled: state.enabled, acceptingSessions: state.enabled, count: 1, running: 0 });
            case "status":
                return reply({ enabled: state.enabled, acceptingSessions: state.enabled, count: 1, running: 0 });
            default:
                return;
        }
    };
    return bytes;
}

async function openPack(bridge, packId, sessionId, packName) {
    const socket = new WebSocket(`ws://127.0.0.1:${await listening(bridge)}/`);
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
    });
    const bytes = fakeGame(socket, sessionId);
    socket.send(
        JSON.stringify({
            v: TRACE_NET_VERSION,
            kind: "ready",
            protocolVersion: 1,
            packId,
            packName,
            store: { enabled: true, acceptingSessions: true, count: 1, running: 0 },
        })
    );
    return { socket, bytes };
}

async function withBridge(run, token) {
    const bridge = new TraceNetBridge(0, "127.0.0.1", token);
    try {
        await run(bridge);
    } finally {
        bridge.close();
    }
}

test("multiple packs connect at once and requests route by source", async () => {
    await withBridge(async (bridge) => {
        const pg = await openPack(bridge, "partygames", "pg-1", "小游戏行为包");
        const ddz = await openPack(bridge, "ddz", "ddz-1", "MCBE Dou Dizhu");
        await waitFor(() => bridge.sources().length === 2);

        expect(bridge.sources().map((entry) => entry.source).sort()).toEqual(["ddz", "partygames"]);

        const sources = await bridge.listAll();
        expect(sources).toHaveLength(2);
        const pgSource = sources.find((entry) => entry.source === "partygames");
        const ddzSource = sources.find((entry) => entry.source === "ddz");
        expect(pgSource.sessions.map((entry) => entry.sessionId)).toEqual(["pg-1"]);
        expect(ddzSource.sessions.map((entry) => entry.sessionId)).toEqual(["ddz-1"]);

        expect((await bridge.download("partygames", "pg-1")).equals(pg.bytes)).toBe(true);
        expect((await bridge.download("ddz", "ddz-1")).equals(ddz.bytes)).toBe(true);

        expect(await bridge.remove("ddz", "ddz-1")).toBe(true);
        expect((await bridge.listAll()).find((entry) => entry.source === "ddz").sessions).toEqual([]);
        // The other pack is unaffected.
        expect((await bridge.listAll()).find((entry) => entry.source === "partygames").sessions).toHaveLength(1);

        expect(await bridge.clear("partygames")).toBe(1);
        expect((await bridge.setStore("partygames", false)).enabled).toBe(false);
        expect((await bridge.status("partygames")).enabled).toBe(false);

        pg.socket.close();
        ddz.socket.close();
    });
});

test("a reconnecting pack replaces its stale socket", async () => {
    await withBridge(async (bridge) => {
        const first = await openPack(bridge, "ddz", "ddz-1", "DDZ");
        await waitFor(() => bridge.sources().length === 1);
        const second = await openPack(bridge, "ddz", "ddz-2", "DDZ");

        // The second handshake replaces the first socket, so keep polling until
        // the new session id is the one being served.
        let sessions = [];
        for (let attempt = 0; attempt < 100; attempt++) {
            const list = await bridge.listAll();
            sessions = list[0]?.sessions.map((entry) => entry.sessionId) ?? [];
            if (sessions.includes("ddz-2")) break;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(bridge.sources()).toHaveLength(1);
        expect(sessions).toEqual(["ddz-2"]);
        first.socket.close();
        second.socket.close();
    });
});

test("unknown sources fail cleanly", async () => {
    await withBridge(async (bridge) => {
        expect(await bridge.listAll()).toEqual([]);
        await expect(bridge.download("nope", "x")).rejects.toThrow("数据源未连接");
    });
});

test("a token-protected bridge refuses a client without the token", async () => {
    await withBridge(async (bridge) => {
        const socket = new WebSocket(`ws://127.0.0.1:${await listening(bridge)}/`);
        const outcome = await new Promise((resolve) => {
            socket.onopen = () => resolve("open");
            socket.onerror = () => resolve("error");
            socket.onclose = () => resolve("close");
            setTimeout(() => resolve("timeout"), 2000);
        });
        expect(outcome).not.toBe("open");
        expect(bridge.connected).toBe(false);
    }, "secret");
});
