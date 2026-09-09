import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { globSync } from "tinyglobby";

function buildInput(files: string[], base: string) {
    return Object.fromEntries(
        files.map((file) => {
            const name = path
                .relative(base, file.slice(0, file.length - path.extname(file).length))
                .split(path.sep)
                .join("/");
            return [name, path.resolve(file)];
        })
    );
}

const coreInput = buildInput(
    globSync("src/**/*.ts", {
        ignore: ["src/**/*.d.ts", "src/testing/**"],
    }),
    "src"
);

const testInput = buildInput(
    globSync("src/testing/**/*.ts", {
        ignore: ["src/testing/**/*.d.ts"],
    }),
    "src/testing"
);

export default defineConfig([
    {
        input: coreInput,
        external: ["@minecraft/server", "@minecraft/server-ui"],
        output: {
            dir: "packages/core/dist",
            format: "esm",
            entryFileNames: "[name].js",
            chunkFileNames: "_chunks/[name]-[hash].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
    {
        input: testInput,
        external: [
            "@begame/core",
            "@minecraft/server",
            "@minecraft/server-ui",
            "node:module",
            "node:url",
            "vitest/config",
        ],
        output: {
            dir: "packages/test/dist",
            format: "esm",
            entryFileNames: "[name].js",
            chunkFileNames: "_chunks/[name]-[hash].js",
        },
        plugins: [dts({ tsconfig: "./tsconfig.json" })],
    },
]);
