import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { decodeTracePayload } from "../src/decode.mjs";
import type { DecodeResponse } from "../src/types";
import type { ConnectBridge } from "./connect";
import type { IngestStore } from "./ingest";
import type { TraceNetBridge } from "./net";
import { zipFiles } from "./zip";

const MAX_BODY_BYTES = 64 * 1024 * 1024;
const VERSION = "0.0.2";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

/** Absolute path of the static assets, independent of the process cwd. */
export const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

interface AppDeps {
    bridge?: ConnectBridge;
    ingest?: IngestStore;
    net?: TraceNetBridge;
}

export function createApp(bridge?: ConnectBridge, ingest?: IngestStore, net?: TraceNetBridge) {
    const app = new Hono();
    const deps: AppDeps = { bridge, ingest, net };

    app.get("/api/health", (c) =>
        c.json({
            ok: true,
            name: "@begame/observatory",
            version: VERSION,
            capabilities: capabilities(deps),
        })
    );

    // ------------------------------------------------------------------
    // Decode / analyze
    // ------------------------------------------------------------------

    app.post("/api/decode", async (c) => {
        const body = await readBody(c, MAX_BODY_BYTES);
        if (!body.ok) return c.json({ ok: false, error: body.error, exports: [] }, body.status);
        const sessionId = c.req.query("session") || undefined;
        const result = decodeSafely(body.buffer, sessionId);
        return c.json(result, result.ok ? 200 : 422);
    });

    /** Decode + analyze an uploaded payload; the response stays analysis-only. */
    app.post("/api/analyze", async (c) => {
        const body = await readBody(c, MAX_BODY_BYTES);
        if (!body.ok) return c.json({ ok: false, error: body.error }, body.status);
        const sessionId = c.req.query("session") || undefined;
        return c.json(analyzePayload(body.buffer, sessionId));
    });

    /** Analyze a session already held by one of the configured sources. */
    app.get("/api/analyze", async (c) => {
        const source = c.req.query("source");
        const id = c.req.query("id");
        if (!source || !id) return c.json({ ok: false, error: "缺少 source / id 参数" }, 400);
        try {
            const bytes = await fetchSessionBytes(deps, source, id, c.req.query("pack"));
            return c.json(analyzePayload(bytes));
        } catch (error) {
            return c.json({ ok: false, error: (error as Error).message }, 422);
        }
    });

    // ------------------------------------------------------------------
    // Unified source / session surface
    // ------------------------------------------------------------------

    /** Every configured source, whether or not it is currently connected. */
    app.get("/api/sources", (c) => c.json({ capabilities: capabilities(deps), sources: sourceSummary(deps) }));

    /** All sessions from every connected source, flattened and tagged. */
    app.get("/api/sessions", async (c) => {
        const sources: unknown[] = [];

        if (bridge) {
            try {
                const sessions = await bridge.list();
                sources.push({ id: "connect", kind: "connect", connected: bridge.connected, sessions });
            } catch (error) {
                sources.push({ id: "connect", kind: "connect", connected: bridge.connected, sessions: [], error: (error as Error).message });
            }
        }
        if (net) {
            try {
                const all = await net.listAll();
                for (const entry of all) {
                    sources.push({
                        id: `net:${entry.source}`,
                        kind: "net",
                        connected: true,
                        pack: entry.source,
                        packName: entry.packName,
                        store: entry.store,
                        sessions: entry.sessions,
                        error: entry.error,
                    });
                }
            } catch (error) {
                sources.push({ id: "net", kind: "net", connected: net.connected, sessions: [], error: (error as Error).message });
            }
        }
        if (ingest) {
            sources.push({ id: "ingest", kind: "ingest", connected: true, sessions: ingest.list() });
        }

        return c.json({ capabilities: capabilities(deps), sources });
    });

    /** Raw `.begtrace` bytes for a session, or `?format=json` for the decoded session. */
    app.get("/api/session/:id", async (c) => {
        const source = c.req.query("source");
        if (!source) return c.json({ error: "缺少 source 参数" }, 400);
        const id = c.req.param("id");
        try {
            const bytes = await fetchSessionBytes(deps, source, id, c.req.query("pack"));
            if (c.req.query("format") === "json") {
                return c.json(decodeSafely(bytes));
            }
            return new Response(new Uint8Array(bytes), {
                headers: {
                    "content-type": "application/octet-stream",
                    "content-disposition": `attachment; filename="${id}.begtrace"`,
                    "cache-control": "no-store",
                },
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 422);
        }
    });

    // ------------------------------------------------------------------
    // /connect bridge
    // ------------------------------------------------------------------

    app.get("/api/connect/status", (c) =>
        c.json({ enabled: Boolean(bridge), connected: bridge?.connected ?? false, url: bridge?.url })
    );
    app.get("/api/connect/sessions", async (c) => {
        if (!bridge) return c.json({ error: "连接服务未启动" }, 503);
        try { return c.json({ sessions: await bridge.list() }); }
        catch (error) { return c.json({ error: (error as Error).message }, 503); }
    });
    app.get("/api/connect/session/:id", async (c) => {
        if (!bridge) return c.json({ error: "连接服务未启动" }, 503);
        try {
            const bytes = await bridge.download(c.req.param("id"));
            return new Response(new Uint8Array(bytes), {
                headers: {
                    "content-type": "application/octet-stream",
                    "content-disposition": `attachment; filename="${c.req.param("id")}.begtrace"`,
                    "cache-control": "no-store",
                },
            });
        } catch (error) { return c.json({ error: (error as Error).message }, 422); }
    });
    app.post("/api/connect/export", async (c) => {
        if (!bridge) return c.json({ error: "连接服务未启动" }, 503);
        try {
            const body = await c.req.json() as { ids?: unknown };
            const ids = body.ids;
            if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((id) => typeof id === "string" && ID_PATTERN.test(id))) {
                return c.json({ error: "请选择 1 至 500 个有效会话" }, 400);
            }
            const files = [];
            let total = 0;
            for (const id of new Set(ids as string[])) {
                const bytes = await bridge.download(id);
                total += bytes.length;
                if (total > MAX_BODY_BYTES) return c.json({ error: "归档超过 64 MiB，请分批导出" }, 413);
                files.push({ name: `${id}.begtrace`, bytes });
            }
            return new Response(new Uint8Array(zipFiles(files)), {
                headers: { "content-type": "application/zip", "content-disposition": "attachment; filename=begame-traces.zip", "cache-control": "no-store" },
            });
        } catch (error) { return c.json({ error: (error as Error).message }, 422); }
    });

    // ------------------------------------------------------------------
    // HTTP ingest sink
    // ------------------------------------------------------------------

    app.get("/api/ingest/status", (c) =>
        c.json({ enabled: Boolean(ingest), count: ingest?.list().length ?? 0 })
    );

    app.post("/api/ingest", async (c) => {
        if (!ingest) return c.json({ error: "ingest 未启用" }, 503);
        if (!ingest.authorize(c.req.header("x-begame-token"))) {
            return c.json({ error: "unauthorized" }, 401);
        }
        const length = Number(c.req.header("content-length") ?? 0);
        if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
            return c.json({ error: "上传体过大（上限 64 MiB）" }, 413);
        }
        let body: unknown;
        try {
            body = await c.req.json();
        } catch {
            return c.json({ error: "无效的 JSON 上传分片" }, 400);
        }
        const result = ingest.accept(body);
        return c.json(result, result.ok ? 202 : result.code);
    });

    app.get("/api/ingest/sessions", (c) => {
        if (!ingest) return c.json({ error: "ingest 未启用" }, 503);
        return c.json({ sessions: ingest.list() });
    });

    app.get("/api/ingest/session/:id", (c) => {
        if (!ingest) return c.json({ error: "ingest 未启用" }, 503);
        const bytes = ingest.read(c.req.param("id"));
        if (!bytes) return c.json({ error: "未找到会话" }, 404);
        return new Response(new Uint8Array(bytes), {
            headers: {
                "content-type": "application/octet-stream",
                "content-disposition": `attachment; filename="${c.req.param("id")}.begtrace"`,
                "cache-control": "no-store",
            },
        });
    });

    // ------------------------------------------------------------------
    // BDS trace net
    // ------------------------------------------------------------------

    app.get("/api/net/status", (c) => {
        if (!net) return c.json({ enabled: false, connected: false, sources: [] });
        return c.json({ enabled: true, connected: net.connected, sources: net.sources() });
    });

    app.get("/api/net/sessions", async (c) => {
        if (!net) return c.json({ error: "trace net 未启用" }, 503);
        try {
            return c.json({ sources: await net.listAll() });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 503);
        }
    });

    app.get("/api/net/session/:id", async (c) => {
        if (!net) return c.json({ error: "trace net 未启用" }, 503);
        const source = c.req.query("source");
        if (!source) return c.json({ error: "缺少 source 参数" }, 400);
        try {
            const bytes = await net.download(source, c.req.param("id"));
            return new Response(new Uint8Array(bytes), {
                headers: {
                    "content-type": "application/octet-stream",
                    "content-disposition": `attachment; filename="${c.req.param("id")}.begtrace"`,
                    "cache-control": "no-store",
                },
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 422);
        }
    });

    app.delete("/api/net/session/:id", async (c) => {
        if (!net) return c.json({ error: "trace net 未启用" }, 503);
        const source = c.req.query("source");
        if (!source) return c.json({ error: "缺少 source 参数" }, 400);
        try {
            return c.json({ deleted: await net.remove(source, c.req.param("id")) });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 422);
        }
    });

    app.post("/api/net/clear", async (c) => {
        if (!net) return c.json({ error: "trace net 未启用" }, 503);
        let source: unknown;
        try {
            source = (await c.req.json()).source;
        } catch {
            return c.json({ error: "无效的 JSON" }, 400);
        }
        if (typeof source !== "string" || source.length === 0) {
            return c.json({ error: "缺少 source" }, 400);
        }
        try {
            return c.json({ removed: await net.clear(source) });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 422);
        }
    });

    app.post("/api/net/store", async (c) => {
        if (!net) return c.json({ error: "trace net 未启用" }, 503);
        let body: { source?: unknown; enabled?: unknown };
        try {
            body = await c.req.json();
        } catch {
            return c.json({ error: "无效的 JSON" }, 400);
        }
        if (typeof body.source !== "string" || body.source.length === 0) {
            return c.json({ error: "缺少 source" }, 400);
        }
        if (typeof body.enabled !== "boolean") {
            return c.json({ error: "enabled 必须是布尔值" }, 400);
        }
        try {
            return c.json({ store: await net.setStore(body.source, body.enabled) });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 422);
        }
    });

    app.post("/api/net/export", async (c) => {
        if (!net) return c.json({ error: "trace net 未启用" }, 503);
        try {
            const body = (await c.req.json()) as { items?: unknown };
            const items = body.items;
            if (
                !Array.isArray(items) ||
                items.length === 0 ||
                items.length > 500 ||
                !items.every(
                    (item) =>
                        typeof item === "object" &&
                        item !== null &&
                        typeof (item as { source?: unknown }).source === "string" &&
                        typeof (item as { id?: unknown }).id === "string" &&
                        ID_PATTERN.test((item as { id: string }).id)
                )
            ) {
                return c.json({ error: "请选择 1 至 500 个有效会话" }, 400);
            }
            const files = [];
            let total = 0;
            const seen = new Set<string>();
            for (const item of items as { source: string; id: string }[]) {
                const key = `${item.source}/${item.id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const bytes = await net.download(item.source, item.id);
                total += bytes.length;
                if (total > MAX_BODY_BYTES) {
                    return c.json({ error: "归档超过 64 MiB，请分批导出" }, 413);
                }
                files.push({ name: `${item.source}-${item.id}.begtrace`, bytes });
            }
            return new Response(new Uint8Array(zipFiles(files)), {
                headers: {
                    "content-type": "application/zip",
                    "content-disposition": "attachment; filename=begame-bds-traces.zip",
                    "cache-control": "no-store",
                },
            });
        } catch (error) {
            return c.json({ error: (error as Error).message }, 422);
        }
    });

    app.get("/", serveStatic({ path: "/index.html", root: PUBLIC_DIR }));
    app.use("/*", serveStatic({ root: PUBLIC_DIR }));

    return app;
}

function capabilities(deps: AppDeps) {
    return {
        http: true,
        connect: Boolean(deps.bridge),
        net: Boolean(deps.net),
        ingest: Boolean(deps.ingest),
    };
}

function sourceSummary(deps: AppDeps) {
    const sources: Array<{ id: string; kind: string; enabled: boolean }> = [];
    if (deps.bridge) sources.push({ id: "connect", kind: "connect", enabled: true });
    if (deps.net) sources.push({ id: "net", kind: "net", enabled: true });
    if (deps.ingest) sources.push({ id: "ingest", kind: "ingest", enabled: true });
    return sources;
}

type BodyResult =
    | { ok: true; buffer: Buffer }
    | { ok: false; status: 400 | 413; error: string };

async function readBody(c: { req: { header(name: string): string | undefined; arrayBuffer(): Promise<ArrayBuffer> } }, limit: number): Promise<BodyResult> {
    const length = Number(c.req.header("content-length") ?? 0);
    if (Number.isFinite(length) && length > limit) {
        return { ok: false, status: 413, error: "请求体过大（上限 64 MiB）" };
    }
    const buffer = Buffer.from(await c.req.arrayBuffer());
    if (buffer.length === 0) return { ok: false, status: 400, error: "请求体为空" };
    return { ok: true, buffer };
}

function decodeSafely(buffer: Buffer, sessionId?: string): DecodeResponse {
    try {
        return decodeTracePayload(buffer, sessionId);
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            exports: [],
        };
    }
}

function analyzePayload(buffer: Buffer, sessionId?: string) {
    const result = decodeSafely(buffer, sessionId);
    if (!result.ok || !result.selected) {
        return { ok: false, error: result.error ?? "解析失败", exports: result.exports ?? [] };
    }
    return {
        ok: true,
        source: result.source,
        analysis: result.analysis,
        warnings: result.warnings ?? [],
    };
}

/** Resolve raw bytes for one session, by source kind. */
async function fetchSessionBytes(
    deps: AppDeps,
    source: string,
    id: string,
    pack?: string
): Promise<Buffer> {
    if (!ID_PATTERN.test(id)) throw new Error("无效的会话 ID");
    if (source === "connect") {
        if (!deps.bridge) throw new Error("连接服务未启动");
        return deps.bridge.download(id);
    }
    if (source === "ingest") {
        if (!deps.ingest) throw new Error("ingest 未启用");
        const bytes = deps.ingest.read(id);
        if (!bytes) throw new Error("未找到会话");
        return bytes;
    }
    if (source === "net") {
        if (!deps.net) throw new Error("trace net 未启用");
        if (!pack) throw new Error("net 数据源需要 pack 参数");
        return deps.net.download(pack, id);
    }
    throw new Error(`未知数据源：${source}`);
}
