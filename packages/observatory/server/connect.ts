import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { decodeTracePayload } from "../src/decode.mjs";
import { RawWebSocketConnection, acceptWebSocket } from "./ws";

const PREFIX = "BGTRACE1:";
const MAX_TRACE_BYTES = 64 * 1024 * 1024;
const PAGE_SIZE = 10;
/** Command timeout: a missing response must not wedge the serial queue. */
const REQUEST_TIMEOUT_MS = 10_000;

export interface LiveSummary {
    sessionId: string;
    gameType: string;
    gameKey: string;
    status: string;
    startWallTime: number;
    eventCount: number;
    chunkCount: number;
    storedBytes: number;
    /** Command namespace of the pack that produced this session. */
    pack: string;
    /** Human label of that pack, when configured. */
    packName: string;
}

/** One configured pack the bridge queries. */
export interface ConnectTarget {
    readonly namespace: string;
    readonly packName?: string;
    readonly games?: readonly string[];
}

interface Pending {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
}

/**
 * Adds Bedrock command request/response semantics on top of the shared
 * WebSocket transport.
 *
 * Frame handling lives in `./ws`, which the BDS `server-net` bridge uses too;
 * this class only correlates `commandRequest` with `commandResponse` by
 * requestId and decodes the `BGTRACE1:` payload.
 */
class CommandChannel {
    private readonly pending = new Map<string, Pending>();

    constructor(private readonly socket: RawWebSocketConnection) {}

    /** Rejects every in-flight request; called when the peer goes away. */
    release(reason: string) {
        for (const item of this.pending.values()) {
            clearTimeout(item.timer);
            item.reject(new Error(reason));
        }
        this.pending.clear();
    }

    /** Feeds one inbound text frame; returns silently for unrelated packets. */
    accept(text: string) {
        let packet: any;
        try {
            packet = JSON.parse(text);
        } catch {
            return;
        }
        if (packet.header?.messagePurpose !== "commandResponse") return;
        const item = this.pending.get(packet.header.requestId);
        if (!item) return;
        this.pending.delete(packet.header.requestId);
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
        } catch {
            item.reject(new Error("无效的 trace 响应"));
        }
    }

    request(commandLine: string): Promise<any> {
        const id = randomUUID();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`命令超时：${commandLine.split(" ")[0]}`));
            }, REQUEST_TIMEOUT_MS);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(
                JSON.stringify({
                    header: {
                        version: 1,
                        requestId: id,
                        messageType: "commandRequest",
                        messagePurpose: "commandRequest",
                    },
                    body: { version: 1, origin: { type: "player" }, overworld: "default", commandLine },
                })
            );
        });
    }
}

export class ConnectBridge {
    private channel?: CommandChannel;
    private queue = Promise.resolve();
    private readonly server = createServer((_req, response) => response.writeHead(404).end());
    private readonly targets: readonly ConnectTarget[];

    constructor(
        private readonly port = Number(process.env.BEGAME_CONNECT_PORT ?? 18789),
        private readonly host = process.env.HOST ?? "127.0.0.1",
        targets: readonly ConnectTarget[] = []
    ) {
        // Deduplicate here as well: config parsing already does, but a
        // programmatic caller can pass anything and a repeated namespace would
        // list every session twice.
        const seen = new Set<string>();
        this.targets = targets.filter((target) => {
            if (seen.has(target.namespace)) return false;
            seen.add(target.namespace);
            return true;
        });
        if (this.targets.length === 0) {
            console.warn(
                "Bedrock /connect: 未配置任何 namespace，连接后无法列出会话。" +
                    "请在 observatory.config.json 的 connect.targets 中配置。"
            );
        }
        this.server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
            console.log(`Bedrock WebSocket upgrade: path=${request.url} remote=${socket.remoteAddress}`);
            if (this.channel) {
                console.error("Bedrock WebSocket: 已有客户端连接");
                return socket.destroy();
            }
            if (!acceptWebSocket(request, socket)) {
                console.error("Bedrock WebSocket: 缺少握手密钥");
                return;
            }
            let channel: CommandChannel;
            const transport = new RawWebSocketConnection(
                socket,
                head,
                (text) => channel.accept(text),
                () => {
                    // A peer that vanishes without a close frame only ends its
                    // read side; releasing here keeps `connected` honest and
                    // fails in-flight requests instead of letting them time out.
                    channel.release("Minecraft 已断开连接");
                    if (this.channel === channel) this.channel = undefined;
                    console.log("Minecraft WebSocket: 已断开");
                }
            );
            channel = new CommandChannel(transport);
            this.channel = channel;
            console.log("Minecraft /connect 已连接");
        });
        this.server.listen(this.port, this.host, () => console.log(`Bedrock /connect: ws://${this.host}:${this.port}`));
        this.server.on("error", (error) => console.error("Bedrock WebSocket 启动失败:", error));
    }

    get connected() { return Boolean(this.channel); }
    get url() { return `ws://${this.host}:${this.port}`; }
    /** Packs this bridge queries, as configured. */
    get configuredTargets(): readonly ConnectTarget[] { return this.targets; }

    /** Stops listening and drops the game connection, if any. */
    close(): void {
        this.channel?.release("连接已关闭");
        this.channel = undefined;
        this.server.close();
    }

    private serial<T>(operation: (client: CommandChannel) => Promise<T>): Promise<T> {
        const run = this.queue.then(() => {
            if (!this.channel) throw new Error("Minecraft 尚未连接；请在游戏中执行 /connect " + this.url);
            return operation(this.channel);
        });
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }

    /**
     * Lists sessions for one pack.
     *
     * The command namespace is per pack, so the caller has to name the pack it
     * wants; without a target the request cannot be formed at all.
     */
    private listTarget(client: CommandChannel, target: ConnectTarget): Promise<LiveSummary[]> {
        return (async () => {
            const all: LiveSummary[] = [];
            for (let page = 0; page < 1000; page++) {
                const response = await client.request(`/${target.namespace}:tracelist ${page}`);
                if (response.kind !== "list" || response.page !== page || !Array.isArray(response.sessions)) throw new Error("无效的会话列表");
                for (const session of response.sessions as LiveSummary[]) {
                    all.push({ ...session, pack: target.namespace, packName: target.packName ?? target.namespace });
                }
                if (all.length >= response.total || response.sessions.length < PAGE_SIZE) return all;
            }
            throw new Error("会话列表超过安全上限");
        })();
    }

    /**
     * Every configured pack's sessions, tagged with its namespace.
     *
     * One unreachable pack must not hide the others, so failures are collected
     * per pack and reported alongside the successful results.
     */
    async list(): Promise<{ sessions: LiveSummary[]; errors: { pack: string; error: string }[] }> {
        return this.serial(async (client) => {
            const sessions: LiveSummary[] = [];
            const errors: { pack: string; error: string }[] = [];
            for (const target of this.targets) {
                try {
                    sessions.push(...(await this.listTarget(client, target)));
                } catch (error) {
                    errors.push({ pack: target.namespace, error: (error as Error).message });
                }
            }
            return { sessions, errors };
        });
    }

    /** Sessions for one pack only; unknown namespaces fail loudly. */
    listPack(namespace: string): Promise<LiveSummary[]> {
        const target = this.targets.find((item) => item.namespace === namespace);
        if (!target) {
            return Promise.reject(
                new Error(`未配置的 namespace：${namespace}（请在 observatory.config.json 的 connect.targets 中添加）`)
            );
        }
        return this.serial((client) => this.listTarget(client, target));
    }

    download(id: string, namespace: string): Promise<Buffer> {
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) return Promise.reject(new Error("无效的会话 ID"));
        const target = this.targets.find((item) => item.namespace === namespace);
        if (!target) {
            return Promise.reject(
                new Error(`未配置的 namespace：${namespace}（请在 observatory.config.json 的 connect.targets 中添加）`)
            );
        }
        return this.serial(async (client) => {
            const info = await client.request(`/${target.namespace}:traceinfo ${id}`);
            if (info.kind !== "info" || info.id !== id || !Number.isSafeInteger(info.parts) || info.parts < 1 || info.parts > 11000 || !Number.isSafeInteger(info.chars) || info.chars < 1 || info.chars > MAX_TRACE_BYTES * 4 / 3 + 4 || info.parts !== Math.ceil(info.chars / 8192)) throw new Error("无效的 trace 信息");
            let encoded = "";
            for (let part = 0; part < info.parts; part++) {
                const response = await client.request(`/${target.namespace}:tracepart ${id} ${part}`);
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
