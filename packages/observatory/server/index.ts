import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, PUBLIC_DIR } from "./app";
import { ConnectBridge } from "./connect";
import { IngestStore } from "./ingest";
import { TraceNetBridge } from "./net";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const NET_PORT = Number(process.env.BEGAME_NET_PORT ?? 18790);
const INGEST_DIR =
    process.env.BEGAME_INGEST_DIR ??
    fileURLToPath(new URL("../data", import.meta.url));

if (!existsSync(join(PUBLIC_DIR, "build", "app.js"))) {
    console.warn("前端 bundle 不存在，请先运行 npm run build（npm run observatory 会自动构建）。");
}

const bridge = new ConnectBridge();
const ingest = new IngestStore(INGEST_DIR, process.env.BEGAME_INGEST_TOKEN);
const net = new TraceNetBridge(
    NET_PORT,
    HOST,
    process.env.BEGAME_NET_TOKEN ?? process.env.BEGAME_INGEST_TOKEN
);
const server = serve(
    {
        fetch: createApp(bridge, ingest, net).fetch,
        port: PORT,
        hostname: HOST,
    },
    (info) => {
        console.log(`BEGame Observatory: http://${HOST}:${info.port}`);
        console.log(`BDS trace net: ws://${HOST}:${NET_PORT}/`);
        console.log(`BDS ingest: POST http://${HOST}:${info.port}/api/ingest (目录 ${INGEST_DIR})`);
        console.log("Ctrl+C 停止");
    }
);

server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
        console.error(`端口 ${PORT} 已被占用，可用 PORT=xxxx npm run observatory 换一个端口。`);
    } else {
        console.error(error);
    }
    process.exitCode = 1;
});
