import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { globSync } from "tinyglobby";

function buildInput(files: string[], base: string) {
    return Object.fromEntries(
        files.map((file) => {
            const name = path
                .relative(
                    base,
                    file.slice(0, file.length - path.extname(file).length)
                )
                .split(path.sep)
                .join("/");
            return [name, path.resolve(file)];
        })
    );
}

const coreRoot = "packages/core/src";
const testRoot = "packages/test/src";
const traceSpecRoot = "packages/trace-spec/src";
const traceRoot = "packages/trace/src";
const observatoryEntry = path.resolve("packages/observatory/src/main.tsx");
const observatoryServerEntry = path.resolve("packages/observatory/server/index.ts");

const traceSpecExternal = /^@begame\/trace-spec(\/|$)/;
const traceExternal = /^@begame\/trace(\/|$)/;
/** Keeps every @begame/core subpath (notably ./world-ready) external. */
const coreExternal = /^@begame\/core(\/|$)/;

const coreInput = buildInput(
    globSync(`${coreRoot}/**/*.ts`, {
        ignore: [`${coreRoot}/**/*.d.ts`],
    }),
    coreRoot
);

const testInput = buildInput(
    globSync(`${testRoot}/**/*.ts`, {
        ignore: [`${testRoot}/**/*.d.ts`],
    }),
    testRoot
);

const traceSpecInput = buildInput(
    globSync(`${traceSpecRoot}/**/*.ts`, {
        ignore: [`${traceSpecRoot}/**/*.d.ts`],
    }),
    traceSpecRoot
);

const traceInput = buildInput(
    globSync(`${traceRoot}/**/*.ts`, {
        ignore: [`${traceRoot}/**/*.d.ts`],
    }),
    traceRoot
);

export default defineConfig([
    {
        input: traceSpecInput,
        output: {
            dir: "packages/trace-spec/dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: traceSpecRoot,
            entryFileNames: "[name].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
    {
        // Only ./minecraft reaches for @minecraft/server and @begame/core; the
        // rest of the package is platform-independent.
        input: traceInput,
        external: [
            traceSpecExternal,
            coreExternal,
            "@minecraft/server",
        ],
        output: {
            dir: "packages/trace/dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: traceRoot,
            entryFileNames: "[name].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
    {
        input: coreInput,
        external: [
            traceSpecExternal,
            "@minecraft/server",
            "@minecraft/server-ui",
        ],
        output: {
            dir: "packages/core/dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: coreRoot,
            entryFileNames: "[name].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
    {
        input: testInput,
        external: [
            coreExternal,
            "@minecraft/server",
            "@minecraft/server-ui",
            "node:fs",
            "node:module",
            "node:url",
            "vitest/config",
            traceExternal,
        ],
        output: {
            dir: "packages/test/dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: testRoot,
            entryFileNames: "[name].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
    {
        input: { app: observatoryEntry },
        platform: "browser",
        define: {
            "process.env.NODE_ENV": JSON.stringify("production"),
        },
        output: {
            dir: "packages/observatory/public/build",
            format: "esm",
            entryFileNames: "[name].js",
            minify: true,
        },
    },
    {
        input: { server: observatoryServerEntry },
        platform: "node",
        output: {
            dir: "packages/observatory/dist",
            format: "esm",
            entryFileNames: "[name].js",
        },
    },
]);
