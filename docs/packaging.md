# Packaging and tree-shaking

BEGame packages are consumed by bundling them into a single Minecraft script, so
whatever a game does not use should not reach its output. That is a property of
the built `dist/` plus the package manifests, not of the source, and it is
guarded by an executable check rather than by inspection.

## The contract

```shell
npm run test:treeshake
```

`scripts/treeshake-probe.mjs` bundles a handful of one-symbol consumers with
rolldown and inspects **which modules** were pulled in. It runs in CI after the
build.

It asserts both directions:

- `forbid` — modules that must be gone (unused components, the trace stack).
- `require` — modules that must survive. This is the more important half:
  `sideEffects` is a blunt instrument, and declaring it too broadly silently
  drops the worldLoad gating that several past fixes depend on.

Detection is by module id. Never scan the output text for identifiers: names
like `Timer` and `DisconnectTimeout` also occur as members of trace-core's
`BuiltinEventType` enum and produce false positives.

## `sideEffects`

Every published package declares it. `false` means "nothing here runs for its
own sake", which lets bundlers drop unused re-exports from barrels.

`@begame/core` cannot use `false`. Three modules do real work at import time:

| Module | Module-level effect |
| --- | --- |
| `dist/constants.js` | subscribes to `world.afterEvents.worldLoad` |
| `dist/system/worldReady.js` | subscribes to `world.afterEvents.worldLoad` |
| `dist/main.js` | builds the global manager / events singleton |
| `dist/trace/index.js` | installs the trace runtime (see below) |

So it uses the array form, listing only those. `@begame/test` lists
`dist/register.js` (it installs Node module hooks). `@begame/trace-core` and
`@begame/trace-tools` are `false`.

Two traps learned the hard way:

- The array is an **allowlist for the package's own build too**. A bare
  `import "./sideEffectfulModule"` inside a package that declares itself
  side-effect free gets dropped from that package's own `dist/`. Prefer a real
  value import, which cannot be eliminated.
- Subpath specifiers need their own `external` entry when building a sibling
  package. An exact-string `external: ["@begame/core"]` does not cover
  `@begame/core/trace`, and rolldown will then try to inline it and emit
  broken relative paths. Use the `^@begame/core(\/|$)` regex.

## Import-time vs call-time opt-in

A feature that is only enabled by a *call* cannot be tree-shaken away, because
the bundler cannot know the call will not happen. Unused features are therefore
enabled by *importing an entry*:

| Entry | Enables |
| --- | --- |
| `@begame/core` | the runtime and its global manager singleton |
| `@begame/core/server` | server integration, `/game` commands, player tracking |
| `@begame/core/trace` | the trace runtime and codec |

`@begame/core` never imports `@begame/trace-core` at runtime. Its hot path uses
a dependency-free contract (`packages/core/src/trace/contract.ts`) holding the
numeric event ids, a no-op scope and a deferred error marker; the real
`TraceManager` installs itself when `@begame/core/trace` is evaluated.

The installation is resolved on first `Game.trace` access rather than at module
evaluation, so the entry may be imported before or after `@begame/core`. Do not
turn `Game.trace` back into a plain property: reading it while `main.ts` is
still evaluating freezes the inert runtime in place and tracing silently stops
working.

## Why not a dynamic `import()`

Deferring the load would also work, but it makes enabling tracing asynchronous,
which conflicts with the worldLoad ordering the runtime already depends on. The
opt-in entry keeps installation synchronous and order-stable.
