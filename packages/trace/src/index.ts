/**
 * BEGame Trace — everything that does not need Minecraft.
 *
 * This root entry is the platform-independent half: the wire vocabulary
 * (re-exported from `@begame/trace-spec`), the binary codec, session
 * primitives, the history store and its storage seams, the session manager, and
 * the Minecraft Content Log parser. The observatory server and offline tooling
 * import exactly this, in plain Node.
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
export * from "./types";
export * from "./format";
export * from "./binary";
export * from "./base64";
export * from "./container";
export * from "./decoder";
export * from "./schema";
export * from "./session";
export * from "./consoleExporter";
export * from "./storage";
export * from "./historyStore";
export * from "./manager";
export * from "./logParser";
