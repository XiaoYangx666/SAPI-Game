import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { decodeTracePayload } from "../src/decode.mjs";
import type { ConnectBridge } from "./connect";
import { zipFiles } from "./zip";

const MAX_BODY_BYTES = 64 * 1024 * 1024;
const VERSION = "0.0.2";

/** Absolute path of the static assets, independent of the process cwd. */
export const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export function createApp(bridge?: ConnectBridge) {
    const app = new Hono();

    app.get("/api/health", (c) =>
        c.json({ ok: true, name: "@begame/observatory", version: VERSION })
    );

    app.use("/api/decode", async (c, next) => {
        const length = Number(c.req.header("content-length") ?? 0);
        if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
            return c.json(
                { ok: false, error: "请求体过大（上限 64 MiB）", exports: [] },
                413
            );
        }
        await next();
    });

    app.post("/api/decode", async (c) => {
        const buffer = Buffer.from(await c.req.arrayBuffer());
        if (buffer.length === 0) {
            return c.json({ ok: false, error: "请求体为空", exports: [] }, 400);
        }
        const sessionId = c.req.query("session") || undefined;
        try {
            const result = decodeTracePayload(buffer, sessionId);
            return c.json(result, result.ok ? 200 : 422);
        } catch (error) {
            return c.json(
                {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                    exports: [],
                },
                422
            );
        }
    });

    app.get("/api/connect/status", (c) => c.json({ connected: bridge?.connected ?? false, url: bridge?.url ?? "ws://127.0.0.1:18789" }));
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
            if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(id))) {
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

    app.get("/", serveStatic({ path: "/index.html", root: PUBLIC_DIR }));
    app.use("/*", serveStatic({ root: PUBLIC_DIR }));

    return app;
}
