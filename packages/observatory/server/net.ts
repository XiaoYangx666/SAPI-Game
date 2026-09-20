import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";
import {
    TRACE_NET_VERSION,
    parseTraceNetReply,
    type StoredTraceSummary,
    type TraceNetReply,
    type TraceNetRequest,
    type TraceNetStoreStatus,
} from "@begame/trace";
import { decodeTracePayload } from "../src/decode.mjs";
import { RawWebSocketConnection, acceptWebSocket } from "./ws";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_TRACE_BYTES = 64 * 1024 * 1024;
/** Upper bound for a single `part` reply, slightly above the sender's part size. */
const MAX_PART_CHARS = 400_000;
const MAX_CONNECTIONS = 8;

type TraceNetResponse = Extract<TraceNetReply, { kind: "response" }>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type RequestInit = DistributiveOmit<TraceNetRequest, "v" | "kind" | "id">;

interface ReadyState {
    packId: string;
    packName?: string;
    store: TraceNetStoreStatus;
}

interface Pending {
    resolve(value: TraceNetResponse): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
}

interface Connection {
    readonly id: string;
    readonly client: RawWebSocketConnection;
    ready?: ReadyState;
    readonly pending: Map<string, Pending>;
}

/** One connected pack. */
export interface TraceNetSourceInfo {
    /** Stable identity the pack sent in its `ready` handshake. */
    readonly source: string;
    readonly packName?: string;
    readonly store: TraceNetStoreStatus;
}

export interface TraceNetSourceSessions extends TraceNetSourceInfo {
    readonly sessions: readonly StoredTraceSummary[];
    readonly error?: string;
}

/**
 * Server side of the BDS trace bridge.
 *
 * Each behavior pack runs its own script runtime and its own history store, and
 * a world may load several of them, so this accepts up to {@link MAX_CONNECTIONS}
 * concurrent WebSocket clients and routes every request by the pack's `packId`.
 */
export class TraceNetBridge {
    private readonly server: Server;
    /** Ready connections keyed by packId. */
    private readonly ready = new Map<string, Connection>();
    /** All open connections, including ones that have not sent `ready` yet. */
    private readonly connections = new Set<Connection>();

    constructor(
        readonly port = 18790,
        private readonly host = "127.0.0.1",
        private readonly token?: string
    ) {
        this.server = createServer((_request, response) => response.writeHead(404).end());
        this.server.on("upgrade", (request, socket, head) =>
            this.onUpgrade(request, socket, head)
        );
        this.server.on("error", (error) =>
            console.error("BDS trace net 服务错误:", error)
        );
        this.server.listen(port, host, () =>
            console.log(`BDS trace net: ws://${host}:${port}/`)
        );
    }

    get connected() {
        return this.ready.size > 0;
    }

    /** The actual listening port, useful when constructed with port 0. */
    get boundPort(): number {
        const address = this.server.address();
        return typeof address === "object" && address ? address.port : this.port;
    }

    sources(): TraceNetSourceInfo[] {
        return [...this.ready.values()].map((connection) => this.sourceInfo(connection));
    }

    close() {
        for (const connection of [...this.connections]) {
            this.rejectPending(connection, new Error("trace net 已关闭"));
            connection.client.close();
        }
        this.connections.clear();
        this.ready.clear();
        this.server.close();
    }

    /** Queries every connected pack; a failing source reports its error inline. */
    async listAll(): Promise<TraceNetSourceSessions[]> {
        return Promise.all(
            [...this.ready.values()].map(async (connection) => {
                const info = this.sourceInfo(connection);
                try {
                    const [list, status] = await Promise.all([
                        this.request(connection, { op: "list" }),
                        this.request(connection, { op: "status" }).catch(() => undefined),
                    ]);
                    if (!list.ok) throw new Error(list.error);
                    if (!("sessions" in list.result)) throw new Error("无效的 list 响应");
                    const store =
                        status?.ok && isStoreStatus(status.result)
                            ? status.result
                            : info.store;
                    return { ...info, store, sessions: list.result.sessions };
                } catch (error) {
                    return { ...info, sessions: [], error: (error as Error).message };
                }
            })
        );
    }

    async download(source: string, sessionId: string): Promise<Buffer> {
        const connection = this.find(source);
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(sessionId)) {
            throw new Error("无效的会话 ID");
        }
        const begin = await this.request(connection, { op: "begin", sessionId });
        if (!begin.ok) throw new Error(begin.error);
        if (!("parts" in begin.result) || !("chars" in begin.result)) {
            throw new Error("无效的 begin 响应");
        }
        const { parts, chars } = begin.result;
        if (
            !Number.isSafeInteger(parts) ||
            parts < 1 ||
            parts > 11000 ||
            !Number.isSafeInteger(chars) ||
            chars < 1 ||
            chars > (MAX_TRACE_BYTES * 4) / 3 + 4
        ) {
            throw new Error("无效的 trace 信息");
        }
        let encoded = "";
        for (let part = 0; part < parts; part++) {
            const reply = await this.request(connection, { op: "part", sessionId, part });
            if (!reply.ok) throw new Error(reply.error);
            if (
                !("data" in reply.result) ||
                typeof reply.result.data !== "string" ||
                reply.result.data.length > MAX_PART_CHARS
            ) {
                throw new Error(`trace 分片 ${part} 无效`);
            }
            encoded += reply.result.data;
        }
        if (encoded.length !== chars) throw new Error("trace 分片不完整");
        const bytes = Buffer.from(encoded, "base64");
        const parsed = decodeTracePayload(bytes);
        if (!parsed.ok || parsed.selected?.sessionId !== sessionId) {
            throw new Error("trace 校验失败");
        }
        return bytes;
    }

    async remove(source: string, sessionId: string): Promise<boolean> {
        const reply = await this.request(this.find(source), { op: "delete", sessionId });
        if (!reply.ok) throw new Error(reply.error);
        if (!("deleted" in reply.result)) throw new Error("无效的 delete 响应");
        return reply.result.deleted;
    }

    async clear(source: string): Promise<number> {
        const reply = await this.request(this.find(source), { op: "clear" });
        if (!reply.ok) throw new Error(reply.error);
        if (!("removed" in reply.result)) throw new Error("无效的 clear 响应");
        return reply.result.removed;
    }

    async setStore(source: string, enabled: boolean): Promise<TraceNetStoreStatus> {
        const connection = this.find(source);
        const reply = await this.request(connection, { op: "store", enabled });
        if (!reply.ok) throw new Error(reply.error);
        const store = reply.result as TraceNetStoreStatus;
        if (connection.ready) connection.ready.store = store;
        return store;
    }

    async status(source: string): Promise<TraceNetStoreStatus> {
        const connection = this.find(source);
        const reply = await this.request(connection, { op: "status" });
        if (!reply.ok) throw new Error(reply.error);
        const store = reply.result as TraceNetStoreStatus;
        if (connection.ready) connection.ready.store = store;
        return store;
    }

    private sourceInfo(connection: Connection): TraceNetSourceInfo {
        return {
            source: connection.ready!.packId,
            ...(connection.ready!.packName === undefined
                ? {}
                : { packName: connection.ready!.packName }),
            store: connection.ready!.store,
        };
    }

    private find(source: string): Connection {
        const connection = this.ready.get(source);
        if (!connection) throw new Error(`数据源未连接：${source}`);
        return connection;
    }

    private onUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
        if (this.token && request.headers["x-begame-token"] !== this.token) {
            console.error("BDS trace net: 鉴权失败");
            socket.destroy();
            return;
        }
        if (this.connections.size >= MAX_CONNECTIONS) {
            console.error("BDS trace net: 连接数已达上限");
            socket.destroy();
            return;
        }
        if (!acceptWebSocket(request, socket)) return;
        const connection: Connection = {
            id: randomUUID(),
            client: new RawWebSocketConnection(
                socket,
                head,
                (text) => this.onMessage(connection, text),
                () => this.onClose(connection)
            ),
            pending: new Map(),
        };
        this.connections.add(connection);
    }

    private onClose(connection: Connection) {
        this.connections.delete(connection);
        this.rejectPending(connection, new Error("BDS 连接已断开"));
        if (connection.ready) {
            const source = connection.ready.packId;
            if (this.ready.get(source) === connection) {
                this.ready.delete(source);
                console.log(`BDS trace net: ${source} 已断开`);
            }
        }
    }

    private rejectPending(connection: Connection, error: Error) {
        for (const item of connection.pending.values()) {
            clearTimeout(item.timer);
            item.reject(error);
        }
        connection.pending.clear();
    }

    private onMessage(connection: Connection, text: string) {
        let reply: TraceNetReply | undefined;
        try {
            reply = parseTraceNetReply(JSON.parse(text));
        } catch {
            return;
        }
        if (!reply) return;
        if (reply.kind === "ready") {
            // Older packs predate packId; fall back to the pack name or the
            // connection id so several of them still coexist.
            const packId =
                typeof reply.packId === "string" && reply.packId.length > 0
                    ? reply.packId
                    : typeof reply.packName === "string" && reply.packName.length > 0
                      ? reply.packName
                      : connection.id;
            const previous = this.ready.get(packId);
            if (previous && previous !== connection) {
                // A reconnecting pack replaces its stale socket.
                this.rejectPending(previous, new Error("被新的连接替换"));
                previous.client.close();
                this.connections.delete(previous);
            }
            connection.ready = {
                packId,
                ...(reply.packName === undefined ? {} : { packName: reply.packName }),
                store: reply.store,
            };
            this.ready.set(packId, connection);
            console.log(
                `BDS trace net: ${packId} 已连接${reply.packName ? ` (${reply.packName})` : ""}`
            );
            return;
        }
        const item = connection.pending.get(reply.id);
        if (!item) return;
        connection.pending.delete(reply.id);
        clearTimeout(item.timer);
        item.resolve(reply);
    }

    private request(connection: Connection, init: RequestInit): Promise<TraceNetResponse> {
        if (!connection.client.isOpen) return Promise.reject(new Error("BDS 连接已断开"));
        const id = randomUUID();
        const message = { v: TRACE_NET_VERSION, kind: "request", id, ...init } as TraceNetRequest;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                connection.pending.delete(id);
                reject(new Error(`trace net 超时：${message.op}`));
            }, REQUEST_TIMEOUT_MS);
            connection.pending.set(id, { resolve, reject, timer });
            connection.client.send(JSON.stringify(message));
        });
    }
}

function isStoreStatus(value: unknown): value is TraceNetStoreStatus {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as TraceNetStoreStatus).enabled === "boolean" &&
        typeof (value as TraceNetStoreStatus).count === "number"
    );
}
