/**
 * The trace vocabulary, re-exported from `@begame/trace-spec`.
 *
 * The vocabulary lives in its own package because `@begame/core` needs it to
 * emit events without depending on this one. Everything here imports it through
 * this single module so there is one import site to reason about.
 */
export * from "@begame/trace-spec";