import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { globSync } from "tinyglobby";

const input = Object.fromEntries(
    globSync("src/**/*.ts", {
        ignore: ["src/**/*.d.ts"],
    }).map((file) => {
        const name = path
            .relative(
                "src",
                file.slice(0, file.length - path.extname(file).length)
            )
            .split(path.sep)
            .join("/");
        return [name, path.resolve(file)];
    })
);

export default defineConfig({
    input,

    external: ["@minecraft/server", "@minecraft/server-ui"],

    output: {
        dir: "dist",
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "_chunks/[name]-[hash].js",
    },

    plugins: [
        dts({
            tsconfig: "./tsconfig.json",
        }),
    ],
});
