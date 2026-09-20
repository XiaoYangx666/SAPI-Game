import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { decodeTracePayload } from "../src/decode.mjs";

const WS_PORT = Number(process.env.BEGAME_WS_PORT ?? 18789);
const PREFIX = "BGTRACE1:";
const MAX_FRAME = 64 * 1024;
const MAX_TRACE_BYTES = 64 * 1024 * 1024;
const PAGE_SIZE = 10;

export interface LiveSummary {
    sessionId: string;
    gameType: string;
    gameKey: string;
    status: string;
    startWallTime: number;
    eventCount: number;
    chunkCount: number;
    storedBytes: number;
}

interface Pending {
    id: string;
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
}

function frame(opcode: number, payload: Buffer): Buffer {
    if (payload.length < 126) return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
    const head = Buffer.alloc(4);
    head[0] = 0x80 | opcode;
    head[1] = 126;
    head.writeUInt16BE(payload.length, 2);
    return Buffer.concat([head, payload]);
}

class BedrockConnection {
    private buffer = Buffer.alloc(0);
    private readonly pending = new Map<string, Pending>();
    private fragmentOpcode = 0;
    private fragments: Buffer[] = [];

    constructor(readonly socket: Socket, initial: Buffer, readonly onClose: () => void) {
        socket.on("data", (data) => this.receive(data));
        socket.on("end", () => console.log("Minecraft WebSocket: 对端结束 TCP 连接"));
        socket.on("close", (hadError) => { console.log(`Minecraft WebSocket: 已断开 (hadError=${hadError})`); this.close(); });
        socket.on("error", (error) => { console.error("Minecraft WebSocket 错误:", error.message); this.close(); });
        if (initial.length) this.receive(initial);
    }

    private close() {
        for (const item of this.pending.values()) {
            clearTimeout(item.timer);
            item.reject(new Error("Minecraft 已断开连接"));
        }
        this.pending.clear();
        this.onClose();
    }

    private receive(data: Buffer) {
        this.buffer = Buffer.concat([this.buffer, data]);
        if (this.buffer.length > MAX_FRAME * 2) { console.error("Minecraft WebSocket: 缓冲区超过上限"); return this.socket.destroy(); }
        while (this.buffer.length >= 2) {
            const first = this.buffer[0];
            const second = this.buffer[1];
            const opcode = first & 15;
            const masked = Boolean(second & 128);
            const code = second & 127;
            const extra = code === 126 ? 2 : code === 127 ? 8 : 0;
            if (this.buffer.length < 2 + extra + (masked ? 4 : 0)) return;
            const size = code < 126 ? code : code === 126 ? this.buffer.readUInt16BE(2) : Number(this.buffer.readBigUInt64BE(2));
            if (!Number.isSafeInteger(size) || size > MAX_FRAME) { console.error(`Minecraft WebSocket: 帧过大 (${size})`); return this.socket.destroy(); }
            const start = 2 + extra + (masked ? 4 : 0);
            if (this.buffer.length < start + size) return;
            const payload = Buffer.from(this.buffer.subarray(start, start + size));
            if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= this.buffer[2 + extra + i % 4];
            this.buffer = this.buffer.subarray(start + size);
            if (opcode === 8) {
                const code = payload.length >= 2 ? payload.readUInt16BE(0) : undefined;
                console.log(`Minecraft WebSocket: 对端发送关闭帧 code=${code ?? "none"} reason=${payload.subarray(2).toString("utf8")}`);
                return this.socket.end(frame(8, payload));
            }
            if (opcode === 9) { this.socket.write(frame(10, payload)); continue; }
            if (opcode === 10) continue;
            if (opcode === 1 && !(first & 128)) {
                this.fragmentOpcode = 1;
                this.fragments = [payload];
                continue;
            }
            if (opcode === 0 && this.fragmentOpcode === 1) {
                this.fragments.push(payload);
                if (this.fragments.reduce((sum, part) => sum + part.length, 0) > MAX_FRAME) return this.socket.destroy();
                if (!(first & 128)) continue;
                this.fragmentOpcode = 0;
                this.handle(Buffer.concat(this.fragments).toString("utf8"));
                this.fragments = [];
                continue;
            }
            if (opcode === 1) this.handle(payload.toString("utf8"));
        }
    }

    private handle(text: string) {
        let packet: any;
        try { packet = JSON.parse(text); } catch { return; }
        if (packet.header?.messagePurpose !== "commandResponse") return;
        const item = this.pending.get(packet.header.requestId);
        if (!item) return;
        this.pending.delete(item.id);
        clearTimeout(item.timer);
        const message = packet.body?.statusMessage;
        if (typeof message !== "string" || !message.startsWith(PREFIX)) {
            item.reject(new Error(message || "游戏没有返回 BEGame trace 数据；请确认行为包已注册连接命令"));
            return;
        }
        try {
            const value = JSON.parse(message.slice(PREFIX.length));
            if (value?.error) item.reject(new Error(String(value.error)));
            else item.resolve(value);
        } catch { item.reject(new Error("无效的 trace 响应")); }
    }

    request(commandLine: string): Promise<any> {
        if (this.socket.destroyed) return Promise.reject(new Error("Minecraft 已断开连接"));
        const id = randomUUID();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`命令超时：${commandLine.split(" ")[0]}`));
            }, 10000);
            this.pending.set(id, { id, resolve, reject, timer });
            this.socket.write(frame(1, Buffer.from(JSON.stringify({
                header: { version: 1, requestId: id, messageType: "commandRequest", messagePurpose: "commandRequest" },
                body: { version: 1, origin: { type: "player" }, overworld: "default", commandLine },
            }))));
        });
    }
}

export class ConnectBridge {
    private client?: BedrockConnection;
    private queue = Promise.resolve();
    private readonly server = createServer((_req, response) => response.writeHead(404).end());

    constructor() {
        this.server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
            console.log(`Bedrock WebSocket upgrade: path=${request.url} remote=${socket.remoteAddress}`);
            const key = request.headers["sec-websocket-key"];
            if (typeof key !== "string") { console.error("Bedrock WebSocket: 缺少握手密钥"); return socket.destroy(); }
            if (this.client) { console.error("Bedrock WebSocket: 已有客户端连接"); return socket.destroy(); }
            const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
            socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
            const client = new BedrockConnection(socket, head, () => { if (this.client === client) this.client = undefined; });
            this.client = client;
            console.log("Minecraft /connect 已连接");
        });
        this.server.listen(WS_PORT, "127.0.0.1", () => console.log(`Bedrock /connect: ws://127.0.0.1:${WS_PORT}`));
        this.server.on("error", (error) => console.error("Bedrock WebSocket 启动失败:", error));
    }

    get connected() { return Boolean(this.client); }
    get url() { return `ws://127.0.0.1:${WS_PORT}`; }

    private serial<T>(operation: (client: BedrockConnection) => Promise<T>): Promise<T> {
        const run = this.queue.then(() => {
            if (!this.client) throw new Error("Minecraft 尚未连接；请在游戏中执行 /connect " + this.url);
            return operation(this.client);
        });
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }

    list(): Promise<LiveSummary[]> {
        return this.serial(async (client) => {
            const all: LiveSummary[] = [];
            for (let page = 0; page < 1000; page++) {
                const response = await client.request(`/begame:tracelist ${page}`);
                if (response.kind !== "list" || response.page !== page || !Array.isArray(response.sessions)) throw new Error("无效的会话列表");
                all.push(...response.sessions);
                if (all.length >= response.total || response.sessions.length < PAGE_SIZE) return all;
            }
            throw new Error("会话列表超过安全上限");
        });
    }

    download(id: string): Promise<Buffer> {
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) return Promise.reject(new Error("无效的会话 ID"));
        return this.serial(async (client) => {
            const info = await client.request(`/begame:traceinfo ${id}`);
            if (info.kind !== "info" || info.id !== id || !Number.isSafeInteger(info.parts) || info.parts < 1 || info.parts > 11000 || !Number.isSafeInteger(info.chars) || info.chars < 1 || info.chars > MAX_TRACE_BYTES * 4 / 3 + 4 || info.parts !== Math.ceil(info.chars / 8192)) throw new Error("无效的 trace 信息");
            let encoded = "";
            for (let part = 0; part < info.parts; part++) {
                const response = await client.request(`/begame:tracepart ${id} ${part}`);
                if (response.kind !== "part" || response.id !== id || response.part !== part || typeof response.data !== "string" || response.data.length > 8192) throw new Error(`trace 分片 ${part} 无效`);
                encoded += response.data;
            }
            if (encoded.length !== info.chars) throw new Error("trace 分片不完整");
            const bytes = Buffer.from(encoded, "base64");
            const parsed = decodeTracePayload(bytes);
            if (!parsed.ok || parsed.selected?.sessionId !== id) throw new Error("trace 校验失败");
            return bytes;
        });
    }
}
