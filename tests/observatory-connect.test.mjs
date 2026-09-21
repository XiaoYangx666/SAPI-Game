import { createHash } from "node:crypto";
import { connect } from "node:net";
import { expect, test } from "vitest";
import { encodeBase64, encodeBegTrace } from "../packages/trace/dist/index.js";
import { ConnectBridge } from "../packages/observatory/server/connect.ts";

/**
 * Minimal Bedrock `/connect` peer: performs the WebSocket handshake, then
 * answers `commandRequest` frames with `commandResponse` frames, recording the
 * command lines it received.
 */
class FakeGame {
    commands = [];
    socket;
    buffer = Buffer.alloc(0);
    openWaiters = [];

    constructor(port, respond) {
        this.respond = respond;
        this.socket = connect(port, "127.0.0.1");
        this.socket.on("data", (data) => this.receive(data));
        return new Promise((resolve, reject) => {
            this.socket.once("error", reject);
            this.socket.once("connect", () => {
                const key = createHash("sha1").update(String(Math.random())).digest("base64");
                this.socket.write(
                    `GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
                        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
                );
                this.once("open", () => resolve(this));
            });
        });
    }

    once(event, callback) {
        if (event === "open") this.openWaiters.push(callback);
    }

    receive(data) {
        this.buffer = Buffer.concat([this.buffer, data]);
        if (this.buffer.includes(Buffer.from("101 Switching Protocols"))) {
            const end = this.buffer.indexOf("\r\n\r\n");
            if (end !== -1) this.buffer = this.buffer.subarray(end + 4);
            else return;
            const waiters = this.openWaiters;
            this.openWaiters = [];
            for (const waiter of waiters) waiter();
        }
        while (this.buffer.length >= 2) {
            const first = this.buffer[0];
            const opcode = first & 15;
            const masked = Boolean(this.buffer[1] & 128);
            let length = this.buffer[1] & 127;
            let offset = 2;
            if (length === 126) {
                length = this.buffer.readUInt16BE(2);
                offset = 4;
            } else if (length === 127) {
                length = Number(this.buffer.readBigUInt64BE(2));
                offset = 10;
            }
            if (masked) offset += 4;
            if (this.buffer.length < offset + length) return;
            const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
            if (masked) {
                const mask = this.buffer.subarray(offset - 4, offset);
                for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            }
            this.buffer = this.buffer.subarray(offset + length);
            if (opcode !== 1) continue;
            this.handle(JSON.parse(payload.toString("utf8")));
        }
    }

    handle(packet) {
        const commandLine = packet.body.commandLine;
        this.commands.push(commandLine);
        const message = this.respond(commandLine);
        if (message === undefined) return;
        const body = JSON.stringify({
            header: {
                version: 1,
                requestId: packet.header.requestId,
                messageType: "commandResponse",
                messagePurpose: "commandResponse",
            },
            body: { statusCode: 0, statusMessage: "BGTRACE1:" + JSON.stringify(message) },
        });
        const payload = Buffer.from(body);
        const mask = Buffer.from([1, 2, 3, 4]);
        const masked = Buffer.from(payload);
        for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
        // Trace payloads exceed 125 bytes, so the extended length form is
        // required; without it the peer misparses the frame.
        let header;
        if (payload.length < 126) {
            header = Buffer.from([0x81, 0x80 | payload.length]);
        } else {
            header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(payload.length, 2);
        }
        this.socket.write(Buffer.concat([header, mask, masked]));
    }

    close() {
        this.socket.destroy();
    }
}

function traceBytes(sessionId) {
    return encodeBegTrace(
        {
            sessionId,
            formatVersion: 1,
            gameType: "connect-test",
            gameKey: "connect-test:0",
            gameInstanceId: sessionId,
            startTick: 0,
            startWallTime: 0,
        },
        [],
        {
            sessionId,
            status: "completed",
            endTick: 1,
            endWallTime: 1,
            endReason: "test",
            eventCount: 0,
            chunkCount: 0,
        }
    );
}

function summary(sessionId) {
    return {
        sessionId,
        gameType: "connect-test",
        gameKey: "connect-test:0",
        status: "completed",
        startWallTime: 0,
        eventCount: 0,
        chunkCount: 0,
        storedBytes: 0,
    };
}

/** Picks a free port by letting the OS assign one, then closing it. */
async function freePort() {
    const { createServer } = await import("node:http");
    const server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    await new Promise((resolve) => server.close(resolve));
    return port;
}

async function withBridge(targets, respond, run) {
    const port = await freePort();
    const bridge = new ConnectBridge(port, "127.0.0.1", targets);
    const game = await new FakeGame(port, respond);
    try {
        await run(bridge, game);
    } finally {
        game.close();
        bridge.close();
    }
}

test("each configured pack is queried under its own namespace", async () => {
    const targets = [
        { namespace: "ddz", packName: "Dou Dizhu" },
        { namespace: "game", packName: "PartyGames" },
    ];
    const respond = (line) => {
        const [command] = line.replace(/^\//, "").split(" ");
        const [namespace] = command.split(":");
        const sessions = namespace === "ddz" ? [summary("ddz-1")] : [summary("pg-1"), summary("pg-2")];
        return { kind: "list", page: 0, total: sessions.length, sessions };
    };

    await withBridge(targets, respond, async (bridge, game) => {
        const { sessions, errors } = await bridge.list();

        expect(errors).toEqual([]);
        // Sessions carry their origin pack so the UI can group them.
        expect(sessions.filter((session) => session.pack === "ddz").map((s) => s.sessionId)).toEqual(["ddz-1"]);
        expect(sessions.filter((session) => session.pack === "game").map((s) => s.sessionId)).toEqual(["pg-1", "pg-2"]);
        expect(sessions.find((s) => s.pack === "ddz").packName).toBe("Dou Dizhu");

        // The commands themselves must use the pack namespace, never a fixed one.
        expect(game.commands).toContain("/ddz:tracelist 0");
        expect(game.commands).toContain("/game:tracelist 0");
        expect(game.commands.some((line) => line.includes("begame:"))).toBe(false);
    });
});

test("one unreachable pack does not hide the others", async () => {
    const targets = [{ namespace: "ddz" }, { namespace: "broken" }];
    const respond = (line) => {
        if (line.includes("/broken:")) return { error: "store_unavailable" };
        return { kind: "list", page: 0, total: 1, sessions: [summary("ddz-1")] };
    };

    await withBridge(targets, respond, async (bridge) => {
        const { sessions, errors } = await bridge.list();
        expect(sessions.map((session) => session.sessionId)).toEqual(["ddz-1"]);
        expect(errors).toEqual([{ pack: "broken", error: "store_unavailable" }]);
    });
});

test("an unconfigured namespace is rejected instead of guessed", async () => {
    await withBridge([{ namespace: "ddz" }], () => undefined, async (bridge) => {
        await expect(bridge.listPack("nope")).rejects.toThrow(/未配置的 namespace/);
        await expect(bridge.download("s-1", "nope")).rejects.toThrow(/未配置的 namespace/);
    });
});

test("download reads traceinfo and tracepart from the right namespace", async () => {
    const bytes = traceBytes("ddz-1");
    const base64 = encodeBase64(bytes);
    const respond = (line) => {
        if (line.includes(":traceinfo")) {
            return { kind: "info", id: "ddz-1", chars: base64.length, parts: 1 };
        }
        if (line.includes(":tracepart")) {
            return { kind: "part", id: "ddz-1", part: 0, data: base64 };
        }
        return undefined;
    };

    await withBridge([{ namespace: "ddz" }], respond, async (bridge, game) => {
        const downloaded = await bridge.download("ddz-1", "ddz");
        expect(downloaded.equals(bytes)).toBe(true);
        expect(game.commands).toEqual(["/ddz:traceinfo ddz-1", "/ddz:tracepart ddz-1 0"]);
    });
});

test("a duplicate namespace is queried once", async () => {
    const targets = [{ namespace: "ddz" }, { namespace: "ddz", packName: "again" }];
    await withBridge(targets, () => ({ kind: "list", page: 0, total: 0, sessions: [] }), async (bridge, game) => {
        await bridge.list();
        expect(game.commands.filter((line) => line.includes("tracelist"))).toHaveLength(1);
        expect(bridge.configuredTargets).toHaveLength(1);
    });
});

test("no configured pack means no commands are sent", async () => {
    await withBridge([], () => undefined, async (bridge, game) => {
        const { sessions, errors } = await bridge.list();
        expect(sessions).toEqual([]);
        expect(errors).toEqual([]);
        expect(game.commands).toEqual([]);
    });
});
