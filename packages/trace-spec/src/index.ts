/**
 * The BEGame Trace vocabulary, shared by the runtime and the codec.
 *
 * This package exists so `@begame/core` and `@begame/trace` agree on the wire
 * vocabulary (event ids, field types, session shape) without either depending on
 * the other. Core emits events but must not ship the codec; the codec encodes
 * events but must not depend on the Minecraft runtime.
 *
 * It has no dependencies and no module-level side effects.
 */
export * from "./types";
export * from "./management";
export * from "./marker";
