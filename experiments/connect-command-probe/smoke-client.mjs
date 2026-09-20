/** Local protocol smoke test against a running Observatory (no Minecraft needed). */
import { encodeBase64, encodeBegTrace } from "@begame/trace";

const id = "connect-smoke-1";
const bytes = encodeBegTrace({ sessionId: id, formatVersion: 1, gameType: "smoke", gameKey: "smoke:1", gameInstanceId: id, startTick: 1, startWallTime: 1000 }, [], { sessionId: id, status: "completed", endTick: 2, endWallTime: 2000, eventCount: 0, chunkCount: 0 });
const encoded = encodeBase64(bytes);
// Bedrock sends // as the WebSocket request path for /connect.
const ws = new WebSocket(process.env.SMOKE_WS_URL ?? "ws://127.0.0.1:18789//");
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
ws.onmessage = (event) => {
    const request = JSON.parse(event.data);
    const command = request.body.commandLine;
    const page = Number(command.split(" ").at(-1));
    const value = command.startsWith("/begame:tracelist")
        ? { kind: "list", page, total: 1, sessions: page === 0 ? [{ sessionId: id, gameType: "smoke", gameKey: "smoke:1", status: "completed", startWallTime: 1000, eventCount: 0, chunkCount: 0, storedBytes: 0 }] : [] }
        : command.startsWith("/begame:traceinfo")
        ? { kind: "info", id, chars: encoded.length, parts: 1 }
        : { kind: "part", id, part: page, data: encoded };
    ws.send(JSON.stringify({ header: { requestId: request.header.requestId, messagePurpose: "commandResponse" }, body: { statusCode: 0, statusMessage: "BGTRACE1:" + JSON.stringify(value) } }));
};
const base = process.env.SMOKE_HTTP_URL ?? "http://127.0.0.1:8787";
const list = await (await fetch(base + "/api/connect/sessions")).json();
if (list.sessions?.[0]?.sessionId !== id) throw new Error("list failed");
const downloaded = new Uint8Array(await (await fetch(base + `/api/connect/session/${id}`)).arrayBuffer());
if (downloaded.length !== bytes.length || downloaded.some((byte, index) => byte !== bytes[index])) throw new Error("download failed");
const exported = await fetch(base + "/api/connect/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
const zip = new Uint8Array(await exported.arrayBuffer());
if (!exported.ok || zip[0] !== 0x50 || zip[1] !== 0x4b) throw new Error("batch ZIP failed");
console.log("PASS: list, validated .begtrace download, batch ZIP");
ws.close();
