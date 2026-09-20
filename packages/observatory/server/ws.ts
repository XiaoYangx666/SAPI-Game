import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** Matches the trace part size; a single JSON frame never needs to be larger. */
const MAX_FRAME = 2 * 1024 * 1024;

function frame(opcode: number, payload: Buffer): Buffer {
    if (payload.length < 126) {
        return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
    }
    if (payload.length < 65536) {
        const head = Buffer.alloc(4);
        head[0] = 0x80 | opcode;
        head[1] = 126;
        head.writeUInt16BE(payload.length, 2);
        return Buffer.concat([head, payload]);
    }
    const head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(payload.length), 2);
    return Buffer.concat([head, payload]);
}

/** Completes the server side of the WebSocket handshake. */
export function acceptWebSocket(request: IncomingMessage, socket: Duplex): boolean {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") {
        socket.destroy();
        return false;
    }
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    return true;
}

/**
 * Minimal RFC 6455 text-frame transport. Enough for the trace bridge: text
 * frames, ping/pong, close and fragmentation, with client masking.
 */
export class RawWebSocketConnection {
    private buffer = Buffer.alloc(0);
    private fragmentOpcode = 0;
    private fragments: Buffer[] = [];
    private closed = false;

    constructor(
        private readonly socket: Duplex,
        initial: Buffer,
        private readonly onMessage: (text: string) => void,
        private readonly onClose: () => void
    ) {
        socket.on("data", (data) => this.receive(data));
        // A peer that vanishes without a close frame (crash, kill, network
        // drop) only ends its read side. Without this, the connection would
        // linger as "connected" forever and count against the source limit.
        socket.on("end", () => {
            this.socket.end();
            this.finish();
        });
        socket.on("close", () => this.finish());
        socket.on("error", () => this.finish());
        if (initial.length > 0) this.receive(initial);
    }

    get isOpen() {
        return !this.closed;
    }

    send(text: string) {
        if (this.closed) return;
        try {
            this.socket.write(frame(1, Buffer.from(text)));
        } catch {
            this.finish();
        }
    }

    close() {
        if (this.closed) return;
        try {
            const payload = Buffer.alloc(2);
            payload.writeUInt16BE(1000, 0);
            this.socket.write(frame(8, payload));
        } catch {
            // The peer may already be gone.
        }
        this.socket.end();
        this.finish();
    }

    private finish() {
        if (this.closed) return;
        this.closed = true;
        this.onClose();
    }

    private receive(data: Buffer) {
        this.buffer = Buffer.concat([this.buffer, data]);
        if (this.buffer.length > MAX_FRAME * 2) {
            this.socket.destroy();
            this.finish();
            return;
        }
        while (this.buffer.length >= 2) {
            const first = this.buffer[0];
            const second = this.buffer[1];
            const opcode = first & 15;
            const masked = Boolean(second & 128);
            const lengthCode = second & 127;
            const extra = lengthCode === 126 ? 2 : lengthCode === 127 ? 8 : 0;
            if (this.buffer.length < 2 + extra + (masked ? 4 : 0)) return;
            const size =
                lengthCode < 126
                    ? lengthCode
                    : lengthCode === 126
                    ? this.buffer.readUInt16BE(2)
                    : Number(this.buffer.readBigUInt64BE(2));
            if (!Number.isSafeInteger(size) || size > MAX_FRAME) {
                this.socket.destroy();
                this.finish();
                return;
            }
            const start = 2 + extra + (masked ? 4 : 0);
            if (this.buffer.length < start + size) return;
            const payload = Buffer.from(this.buffer.subarray(start, start + size));
            if (masked) {
                for (let index = 0; index < payload.length; index++) {
                    payload[index] ^= this.buffer[2 + extra + (index % 4)];
                }
            }
            this.buffer = this.buffer.subarray(start + size);

            if (opcode === 8) {
                this.socket.end(frame(8, payload));
                this.finish();
                return;
            }
            if (opcode === 9) {
                this.socket.write(frame(10, payload));
                continue;
            }
            if (opcode === 10) continue;
            if (opcode === 1 && !(first & 128)) {
                this.fragmentOpcode = 1;
                this.fragments = [payload];
                continue;
            }
            if (opcode === 0 && this.fragmentOpcode === 1) {
                this.fragments.push(payload);
                const total = this.fragments.reduce((sum, part) => sum + part.length, 0);
                if (total > MAX_FRAME) {
                    this.socket.destroy();
                    this.finish();
                    return;
                }
                if (!(first & 128)) continue;
                this.fragmentOpcode = 0;
                const text = Buffer.concat(this.fragments).toString("utf8");
                this.fragments = [];
                this.onMessage(text);
                continue;
            }
            if (opcode === 1) this.onMessage(payload.toString("utf8"));
        }
    }
}
