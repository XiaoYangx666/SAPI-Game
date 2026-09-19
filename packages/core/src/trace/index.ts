import { TraceManager } from "./manager";
import { installTraceRuntime } from "./registry";

export * from "@begame/trace-core";
export * from "./worldStore";
export * from "./manager";

/**
 * Importing this entry is what turns runtime tracing on in `@begame/core`.
 *
 * This module-level side effect is deliberate and is declared in this package's
 * `sideEffects` list, so bundlers keep it. `@begame/core` itself stays free of
 * the trace implementation, which means a game that never imports
 * `@begame/core/trace` ships none of it.
 */
installTraceRuntime(
    (tick, onInternalError) => new TraceManager(tick, { onInternalError })
);
