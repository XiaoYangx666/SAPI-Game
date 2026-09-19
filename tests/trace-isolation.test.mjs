import { expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Architectural guard for the trace package's platform boundary.
 *
 * `@begame/trace` is one package with two halves: the root entry is
 * platform-independent (codec, session manager, history store, log parser) and
 * `./minecraft` is the binding. The observatory server and offline tooling load
 * the root in plain Node, with no Minecraft runtime and no game framework, so
 * only `minecraft.js` may reach for either.
 *
 * This is a convention rather than a package-graph guarantee — which is exactly
 * why it is asserted mechanically, against `dist` rather than source, since that
 * is what consumers load.
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

/** Matches @minecraft/* and @begame/core, but not @begame/trace-spec. */
const MINECRAFT_OR_CORE = /from\s+"(@minecraft\/[^"]+|@begame\/core(?:\/|"))/g;

test("only the Minecraft entry may import Minecraft or the game runtime", () => {
    const files = jsFilesUnder(path.join(root, "packages/trace/dist"));
    // Guard against the scan passing vacuously on an empty build.
    expect(files.length).toBeGreaterThan(5);

    const offenders = [];
    for (const file of files) {
        const relative = path.relative(root, file).split("\\").join("/");
        if (relative.endsWith("trace/dist/minecraft.js")) continue;
        for (const match of readFileSync(file, "utf8").matchAll(MINECRAFT_OR_CORE)) {
            offenders.push(`${relative} -> ${match[1]}`);
        }
    }
    expect(offenders).toEqual([]);
});

test("the root entry does not pull the Minecraft binding in", () => {
    const entry = readFileSync(
        path.join(root, "packages/trace/dist/index.js"),
        "utf8"
    );
    // If this ever re-exports ./minecraft, every codec consumer silently gains a
    // Minecraft dependency.
    expect(entry).not.toMatch(/["']\.\/minecraft(\.js)?["']/);
});

test("Minecraft and the game runtime are optional peers, not dependencies", () => {
    const manifest = JSON.parse(
        readFileSync(path.join(root, "packages/trace/package.json"), "utf8")
    );
    // A regular dependency here would make `npm i @begame/trace` in a Node-only
    // consumer pull @begame/core and, through its peers, the Mojang packages.
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([
        "@begame/trace-spec",
    ]);
    for (const peer of ["@begame/core", "@minecraft/server"]) {
        expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true);
    }
});

test("@begame/core builds without reaching the trace package", () => {
    const files = jsFilesUnder(path.join(root, "packages/core/dist"));
    const offenders = [];
    for (const file of files) {
        const code = readFileSync(file, "utf8");
        // The lookahead keeps the allowed @begame/trace-spec out of the match.
        for (const match of code.matchAll(
            /from\s+"(@begame\/trace(?:\/|"))/g
        )) {
            offenders.push(`${path.relative(root, file)} -> ${match[1]}`);
        }
    }
    expect(offenders).toEqual([]);
});
