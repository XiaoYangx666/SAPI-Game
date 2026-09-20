/**
 * Functional probe for the scoreboard bridge registry.
 *
 * Verifies one thing only: whether an external `/connect` client can observe
 * fake-player entries written into a scoreboard objective, which is how BEGame
 * packs advertise their custom-command namespace.
 *
 * It does NOT exercise the trace export pipeline.
 *
 * Run:  node experiments/scoreboard-registry-probe/probe-server.cjs
 * Then in Minecraft:  /connect ws://127.0.0.1:18789
 *
 * The script prints the RAW commandResponse payloads so the exact shape of
 * `/scoreboard players list` is visible. It also writes a self-test entry whose
 * name does not collide with the BEGame registry prefix.
 */
const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.PROBE_PORT || 18789);
const OBJECTIVE = "begame_bridge";
const PROBE_OBJECTIVE = "begame_probe";
const PROBE_ENTRY = "PROBE|selfcheck|v1";

function frame(text) {
    const body = Buffer.from(text);
    if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
}

const server = http.createServer((_req, res) => res.writeHead(404).end());

server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string") return socket.destroy();
    const accept = crypto
        .createHash("sha1")
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest("base64");
    socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    console.log(`\nCONNECTED ${req.socket.remoteAddress}`);

    let buffer = Buffer.alloc(0);
    const pending = new Map();

    function send(commandLine) {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`timeout: ${commandLine}`));
            }, 10000);
            pending.set(id, { resolve, reject, timer, commandLine });
            socket.write(
                frame(
                    JSON.stringify({
                        header: {
                            version: 1,
                            requestId: id,
                            messageType: "commandRequest",
                            messagePurpose: "commandRequest",
                        },
                        body: {
                            version: 1,
                            origin: { type: "player" },
                            overworld: "default",
                            commandLine,
                        },
                    })
                )
            );
        });
    }

    function handleMessage(text) {
        let packet;
        try {
            packet = JSON.parse(text);
        } catch {
            return;
        }
        if (packet.header?.messagePurpose !== "commandResponse") {
            console.log("EVENT", JSON.stringify(packet).slice(0, 300));
            return;
        }
        const item = pending.get(packet.header.requestId);
        if (!item) return;
        pending.delete(item.id ?? packet.header.requestId);
        clearTimeout(item.timer);
        item.resolve(packet);
    }

    socket.on("data", (data) => {
        buffer = Buffer.concat([buffer, data]);
        while (buffer.length >= 2) {
            const opcode = buffer[0] & 15;
            const lengthCode = buffer[1] & 127;
            const masked = Boolean(buffer[1] & 128);
            const extra = lengthCode === 126 ? 2 : lengthCode === 127 ? 8 : 0;
            if (buffer.length < 2 + extra + (masked ? 4 : 0)) break;
            const length =
                lengthCode < 126
                    ? lengthCode
                    : lengthCode === 126
                    ? buffer.readUInt16BE(2)
                    : Number(buffer.readBigUInt64BE(2));
            const start = 2 + extra + (masked ? 4 : 0);
            if (buffer.length < start + length) break;
            const payload = Buffer.from(buffer.subarray(start, start + length));
            if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buffer[2 + extra + i % 4];
            buffer = buffer.subarray(start + length);
            if (opcode === 1) handleMessage(payload.toString("utf8"));
            else if (opcode === 8) socket.end();
        }
    });
    socket.on("close", () => {
        for (const item of pending.values()) clearTimeout(item.timer);
        pending.clear();
        console.log("DISCONNECTED");
    });
    socket.on("error", (error) => console.error("SOCKET_ERROR", error.message));

    (async () => {
        const commands = [
            `/scoreboard objectives add ${PROBE_OBJECTIVE} dummy`,
            `/scoreboard players set "${PROBE_ENTRY}" ${PROBE_OBJECTIVE} 1`,
            `/scoreboard objectives list`,
            `/scoreboard players list`,
        ];
        for (const commandLine of commands) {
            try {
                const response = await send(commandLine);
                console.log("\n--------------------------------------------------");
                console.log("COMMAND", commandLine);
                console.log("RAW", JSON.stringify(response, null, 2));
                const message = response.body?.statusMessage ?? "";
                for (const marker of ["BEGAMEBRIDGE/1|", "PROBE|selfcheck"]) {
                    if (typeof message === "string" && message.includes(marker)) {
                        console.log(`FOUND ${marker}`);
                    }
                }
            } catch (error) {
                console.log("\n--------------------------------------------------");
                console.log("COMMAND", commandLine);
                console.log("FAILED", error.message);
            }
        }
        console.log(
            "\nDone. Share everything printed above: the key question is whether\n" +
                "`/scoreboard players list` returns a BEGAMEBRIDGE/1|... participant\n" +
                "(written by the pack) and the PROBE|selfcheck participant."
        );
    })();
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`Scoreboard registry probe listening on ws://127.0.0.1:${PORT}`);
    console.log(`Expected objective: ${OBJECTIVE} (written by the pack at worldLoad)`);
    console.log(`Self-test objective: ${PROBE_OBJECTIVE}`);
});
