import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createApp, PUBLIC_DIR } from "./app";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";

if (!existsSync(join(PUBLIC_DIR, "build", "app.js"))) {
    console.warn("前端 bundle 不存在，请先运行 npm run build（npm run viewer 会自动构建）。");
}

const server = serve(
    { fetch: createApp().fetch, port: PORT, hostname: HOST },
    (info) => {
        console.log(`BEGame Trace Viewer: http://${HOST}:${info.port}`);
        console.log("Ctrl+C 停止");
    }
);

server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
        console.error(`端口 ${PORT} 已被占用，可用 PORT=xxxx npm run viewer 换一个端口。`);
    } else {
        console.error(error);
    }
    process.exitCode = 1;
});
