import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@minecraft\/server$/,
                replacement: path.resolve(root, "packages/test/dist/virtualMinecraft.js"),
            },
            {
                find: /^@minecraft\/server-ui$/,
                replacement: path.resolve(root, "packages/test/dist/virtualMinecraftUi.js"),
            },
        ],
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.mjs"],
        sequence: { concurrent: false },
    },
});
