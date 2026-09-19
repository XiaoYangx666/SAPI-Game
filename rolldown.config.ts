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
const traceCoreRoot = "packages/trace-core/src";
const traceRoot = "packages/trace/src";
const traceToolsRoot = "packages/trace-tools/src";
const observatoryEntry = path.resolve("packages/observatory/src/main.tsx");
const observatoryServerEntry = path.resolve("packages/observatory/server/index.ts");

const traceSpecExternal = /^@begame\/trace-spec(\/|$)/;
const traceCoreExternal = /^@begame\/trace-core(\/|$)/;
const traceExternal = /^@begame\/trace(\/|$)/;
/** Keeps every @begame/core subpath (notably ./trace) external, not just the root. */
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

const traceCoreInput = buildInput(
    globSync(`${traceCoreRoot}/**/*.ts`, {
        ignore: [`${traceCoreRoot}/**/*.d.ts`],
    }),
    traceCoreRoot
);

const traceInput = buildInput(
    globSync(`${traceRoot}/**/*.ts`, {
        ignore: [`${traceRoot}/**/*.d.ts`],
    }),
    traceRoot
);

const traceToolsInput = buildInput(
    globSync(`${traceToolsRoot}/**/*.ts`, {
        ignore: [`${traceToolsRoot}/**/*.d.ts`],
    }),
    traceToolsRoot
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
        input: traceCoreInput,
        external: [traceSpecExternal],
        output: {
            dir: "packages/trace-core/dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: traceCoreRoot,
            entryFileNames: "[name].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
    {
        input: traceInput,
        external: [
            coreExternal,
            traceCoreExternal,
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
            traceCoreExternal,
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
        input: traceToolsInput,
        external: [traceCoreExternal, traceSpecExternal],
        output: {
            dir: "packages/trace-tools/dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: traceToolsRoot,
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
