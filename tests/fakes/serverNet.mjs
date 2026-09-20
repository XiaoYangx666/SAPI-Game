/**
 * Test double for `@minecraft/server-net`, aliased in `vitest.config.ts`.
 *
 * Covers both surfaces the trace package uses: the HTTP client (records
 * outbound requests, answers from a scripted response queue) and the WebSocket
 * client (records connections and lets tests inject inbound frames).
 */
export const HttpRequestMethod = {
    Delete: "Delete",
    Get: "Get",
    Head: "Head",
    Patch: "Patch",
    Post: "Post",
    Put: "Put",
};

export class HttpHeader {
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
}

export class HttpRequest {
    constructor(uri) {
        this.uri = uri;
        this.method = undefined;
        this.timeout = undefined;
        this.headers = [];
        this.body = undefined;
    }
    setMethod(method) {
        this.method = method;
        return this;
    }
    setTimeout(timeout) {
        this.timeout = timeout;
        return this;
    }
    addHeader(key, value) {
        this.headers.push([key, value]);
        return this;
    }
    setBody(body) {
        this.body = body;
        return this;
    }
}

export const requests = [];
export const responses = [];

export const http = {
    async request(request) {
        requests.push(request);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next ?? { status: 200 };
    },
};

export class FakeWebSocketClient {
    constructor() {
        this.isOpen = true;
        this.sent = [];
        this.messageHandlers = [];
        this.closeHandlers = [];
        this.afterEvents = {
            message: { subscribe: (callback) => this.messageHandlers.push(callback) },
            close: { subscribe: (callback) => this.closeHandlers.push(callback) },
        };
    }
    send(payload) {
        if (!this.isOpen) throw new Error("WebSocketNotConnectedError");
        this.sent.push(payload);
    }
    close() {
        this.isOpen = false;
        for (const handler of this.closeHandlers) handler({ reason: "closed", message: "closed" });
    }
    /** Simulates a frame sent by the Observatory. */
    receive(text) {
        for (const handler of this.messageHandlers) handler({ message: text });
    }
    /** Simulates the peer dropping the connection. */
    drop() {
        this.isOpen = false;
        for (const handler of this.closeHandlers) handler({ reason: "closed", message: "dropped" });
    }
    /** Parses the frames this client sent. */
    replies() {
        return this.sent.map((payload) => JSON.parse(payload));
    }
}

export const connectionAttempts = [];
export const connectFailures = [];
export const sockets = [];

export const websocket = {
    async connect(uri, headers) {
        connectionAttempts.push({ uri, headers });
        const failure = connectFailures.shift();
        if (failure) throw failure;
        const socket = new FakeWebSocketClient();
        sockets.push(socket);
        return socket;
    },
};

export function resetServerNet() {
    requests.length = 0;
    responses.length = 0;
    connectionAttempts.length = 0;
    connectFailures.length = 0;
    sockets.length = 0;
}
