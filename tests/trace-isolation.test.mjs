import { expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Architectural guard.
 *
 * `@begame/trace-core` must stay runnable outside Minecraft: the observatory
 * server and any offline tooling import it in plain Node, with no Minecraft
 * runtime and no game framework present. That property is what justifies the
 * storage seams in `packages/trace-core/src/storage.ts`, and it is exactly the
 * kind of boundary that erodes silently when someone adds a convenient import.
 *
 * Asserting it on the built output, not the source, because the source can
 * import something that is later tree-shaken or vice versa.
 */
const root = path.resolve(import.meta.dirname, "..");

function jsFilesUnder(dir) {
    const found = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) found.push(...jsFilesUnder(full));
        else if (entry.endsWith(".js")) found.push(full);
    }
    return found;
}

test("@begame/trace-core does not reach for Minecraft or the game runtime", () => {
    const files = jsFilesUnder(path.join(root, "packages/trace-core/dist"));
    expect(files.length).toBeGreaterThan(0);

    const offenders = [];
    for (const file of files) {
        const code = readFileSync(file, "utf8");
        // The lookahead matters: "@begame/trace" is a prefix of
        // "@begame/trace-spec", which core is allowed to import.
        for (const match of code.matchAll(
            /from\s+"(@minecraft\/[^"]+|@begame\/core(?:\/|"))/g
        )) {
            offenders.push(`${path.relative(root, file)} -> ${match[1]}`);
        }
    }
    expect(offenders).toEqual([]);
});

test("@begame/trace-core depends only on the shared vocabulary", () => {
    const manifest = JSON.parse(
        readFileSync(path.join(root, "packages/trace-core/package.json"), "utf8")
    );
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([
        "@begame/trace-spec",
    ]);
    expect(manifest.peerDependencies ?? {}).toEqual({});
});

test("@begame/core builds without any trace implementation package", () => {
    const files = jsFilesUnder(path.join(root, "packages/core/dist"));
    const offenders = [];
    for (const file of files) {
        const code = readFileSync(file, "utf8");
        for (const match of code.matchAll(
            /from\s+"(@begame\/(?:trace|trace-core)(?:\/|"))/g
        )) {
            offenders.push(`${path.relative(root, file)} -> ${match[1]}`);
        }
    }
    expect(offenders).toEqual([]);
});
