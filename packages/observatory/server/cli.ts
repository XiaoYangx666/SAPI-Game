#!/usr/bin/env node
/**
 * CLI entry for the Observatory.
 *
 * Kept separate from `./server` so the package can expose a `bin` target with a
 * shebang without putting one inside the server module itself (which is also
 * imported by tests and by `main`).
 */
import "./index.js";
