const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.PROBE_PORT || 18789);
const lengths = [64, 512, 2048, 8192];
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function makePayload(length) {
  let state = 0x6b65_6761;
  let result = "";
  for (let index = 0; index < length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    result += alphabet[state & 63];
  }
  return result;
}

function frame(text) {
  const body = Buffer.from(text);
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  if (body.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  throw new Error("Probe request is unexpectedly large");
}

const server = http.createServer((_req, res) => res.writeHead(404).end());

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (typeof key !== "string") return socket.destroy();
  const accept = crypto.createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  console.log(`CONNECTED ${req.socket.remoteAddress}`);

  const commands = ["/begame:probe", ...lengths.map((n) => `/begame:chunk ${n}`)];
  let commandIndex = 0;
  let pendingId;
  let timeout;
  let buffer = Buffer.alloc(0);
  const results = [];

  function finish() {
    clearTimeout(timeout);
    console.log("RESULTS", JSON.stringify(results));
    console.log("Observe in Minecraft whether any test payload appeared in chat.");
  }

  function next() {
    clearTimeout(timeout);
    if (commandIndex >= commands.length) return finish();
    const commandLine = commands[commandIndex++];
    pendingId = crypto.randomUUID();
    socket.write(frame(JSON.stringify({
      header: {
        version: 1,
        requestId: pendingId,
        messageType: "commandRequest",
        messagePurpose: "commandRequest",
      },
      body: { version: 1, origin: { type: "player" }, overworld: "default", commandLine },
    })));
    console.log("REQUEST", commandLine);
    timeout = setTimeout(() => {
      results.push({ commandLine, verdict: "TIMEOUT" });
      next();
    }, 5000);
  }

  function handleMessage(text) {
    let message;
    try { message = JSON.parse(text); } catch { return console.log("NON_JSON", text.slice(0, 200)); }
    if (message.header?.messagePurpose !== "commandResponse") {
      return console.log("EVENT", JSON.stringify(message).slice(0, 250));
    }
    if (message.header.requestId !== pendingId) return;
    const commandLine = commands[commandIndex - 1];
    const status = message.body?.statusMessage ?? message.body?.message ?? "";
    const length = Number(commandLine.match(/\d+$/)?.[0]);
    const expected = commandLine === "/begame:probe"
      ? "BGPROBE:READY:0.1.0"
      : `BGPROBE:CHUNK:${length}:${makePayload(length)}:END`;
    const exact = status === expected;
    const verdict = exact ? "PASS" : status.includes(expected) ? "WRAPPED" : "FAIL";
    results.push({ commandLine, verdict, statusCode: message.body?.statusCode, receivedChars: status.length, expectedChars: expected.length, sample: status.slice(0, 100) });
    console.log("RESPONSE", commandLine, verdict, `received=${status.length}`, `expected=${expected.length}`, `statusCode=${message.body?.statusCode}`, `sample=${JSON.stringify(status.slice(0, 80))}`);
    next();
  }

  socket.on("data", (data) => {
    buffer = Buffer.concat([buffer, data]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 15;
      const lengthCode = buffer[1] & 127;
      const masked = Boolean(buffer[1] & 128);
      const extra = lengthCode === 126 ? 2 : lengthCode === 127 ? 8 : 0;
      if (buffer.length < 2 + extra + (masked ? 4 : 0)) break;
      const length = lengthCode < 126 ? lengthCode : lengthCode === 126
        ? buffer.readUInt16BE(2) : Number(buffer.readBigUInt64BE(2));
      const start = 2 + extra + (masked ? 4 : 0);
      if (buffer.length < start + length) break;
      const payload = Buffer.from(buffer.subarray(start, start + length));
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buffer[2 + extra + (i % 4)];
      buffer = buffer.subarray(start + length);
      if (opcode === 1) handleMessage(payload.toString("utf8"));
    }
  });
  socket.on("close", () => { clearTimeout(timeout); console.log("DISCONNECTED"); });
  socket.on("error", (error) => console.error("SOCKET_ERROR", error.message));
  setTimeout(next, 1000);
});

server.listen(PORT, "127.0.0.1", () => console.log(`READY ws://127.0.0.1:${PORT}`));
