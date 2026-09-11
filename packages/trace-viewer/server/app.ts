import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { decodeTracePayload } from "../src/decode.mjs";

const MAX_BODY_BYTES = 64 * 1024 * 1024;
const VERSION = "0.0.2";

/** Absolute path of the static assets, independent of the process cwd. */
export const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export function createApp() {
    const app = new Hono();

    app.get("/api/health", (c) =>
        c.json({ ok: true, name: "@begame/trace-viewer", version: VERSION })
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

    // Reserved for the upcoming live pipeline:
    //   POST /api/ingest  (Minecraft pushes trace data)
    //   GET  /api/live    (browser subscribes via SSE)

    app.get("/", serveStatic({ path: "/index.html", root: PUBLIC_DIR }));
    app.use("/*", serveStatic({ root: PUBLIC_DIR }));

    return app;
}
