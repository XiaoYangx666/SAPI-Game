import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, PUBLIC_DIR } from "./app";
import { ConnectBridge } from "./connect";
import { IngestStore } from "./ingest";
import { TraceNetBridge } from "./net";
import { HELP_TEXT, parseServerOptions, type ServerOptions } from "./options";

const parsed = parseServerOptions(process.argv.slice(2), process.env);
if (!parsed.ok) {
    // `--help` also arrives here; print it as information, not as an error.
    const isHelp = parsed.error === HELP_TEXT;
    (isHelp ? console.log : console.error)(parsed.error);
    process.exitCode = isHelp ? 0 : 2;
} else {
    start(parsed.options);
}

function start(options: ServerOptions) {
    const ingestDir =
        options.ingestDir ??
        fileURLToPath(new URL("../data", import.meta.url));

    const bridge = options.connect ? new ConnectBridge(options.connectPort) : undefined;
    const ingest = options.ingest ? new IngestStore(ingestDir, options.ingestToken) : undefined;
    const net = options.net
        ? new TraceNetBridge(options.netPort, options.host, options.netToken)
        : undefined;

    if (!options.http) {
        console.log("HTTP 工作台未启用（--no-http）。");
        return;
    }

    if (!existsSync(join(PUBLIC_DIR, "build", "app.js"))) {
        console.warn("前端 bundle 不存在，请先运行 npm run build（npm run observatory 会自动构建）。");
    }

    const server = serve(
        {
            fetch: createApp(bridge, ingest, net).fetch,
            port: options.port,
            hostname: options.host,
        },
        (info) => {
            console.log(`BEGame Observatory: http://${options.host}:${info.port}`);
            if (bridge) console.log(`/connect 桥: ws://${options.host}:${options.connectPort}`);
            if (net) console.log(`BDS trace net: ws://${options.host}:${options.netPort}`);
            if (ingest) {
                console.log(`BDS ingest: POST http://${options.host}:${info.port}/api/ingest（目录 ${ingestDir}）`);
            }
            console.log("Ctrl+C 停止");
        }
    );

    server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            console.error(
                `端口 ${options.port} 已被占用，可用 --port <n> 或 PORT=<n> 换一个端口。`
            );
        } else {
            console.error(error);
        }
        process.exitCode = 1;
    });
}
