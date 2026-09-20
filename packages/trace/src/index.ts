/**
 * BEGame Trace — everything that does not need Minecraft.
 *
 * This root entry is the platform-independent half: the wire vocabulary
 * (re-exported from `@begame/trace-spec`), the binary codec, session
 * primitives, the history store and its storage seams, the session manager, and
 * the Minecraft Content Log parser. The observatory server and offline tooling
 * import exactly this, in plain Node.
 *
 * Source layout:
 *
 * - `wire/`    — vocabulary, binary primitives, container, decoder, schema DSL
 * - `runtime/` — session, manager, history store, storage seams, console export
 * - `bridge/`  — transports shared with the game side: trace-net, ingest, the
 *                `/connect` bridge registry
 * - `tools/`   — offline Content Log parser
 * - root       — `index.ts` (this entry), plus the `./minecraft` and
 *                `./server-net` bindings
 *
 * The Minecraft binding lives in `./minecraft` and is deliberately **not**
 * re-exported here: doing so would drag `@minecraft/server` and `@begame/core`
 * into every consumer that only wants to decode a `.begtrace` file. Games import
 * it explicitly:
 *
 * ```ts
 * import { initBEGame } from "@begame/core";
 * import { createTraceRuntime } from "@begame/trace/minecraft";
 *
 * initBEGame({ trace: createTraceRuntime(), traceStore: true });
 * ```
 *
 * `tests/trace-isolation.test.mjs` fails CI if this entry starts reaching for
 * either of those, or if any module other than `minecraft` does.
 */
export * from "./wire/types";
export * from "./wire/format";
export * from "./wire/binary";
export * from "./wire/base64";
export * from "./wire/container";
export * from "./wire/decoder";
export * from "./wire/schema";
export * from "./runtime/session";
export * from "./runtime/consoleExporter";
export * from "./runtime/storage";
export * from "./runtime/historyStore";
export * from "./runtime/manager";
export * from "./tools/logParser";
export * from "./bridge/bridgeRegistry";
export * from "./bridge/ingest";
export * from "./bridge/net";
