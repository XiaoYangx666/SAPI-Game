import { defineConfig, mergeConfig, type UserConfig } from "vitest/config";

const server = new URL("./virtualMinecraft.js", import.meta.url).pathname;
const serverUi = new URL("./virtualMinecraftUi.js", import.meta.url).pathname;

/** BEGame 官方 Vitest 配置。自动把 Minecraft ScriptAPI 重定向到无头测试 runtime。 */
export function defineBEGameTestConfig(config: UserConfig = {}) {
    return mergeConfig(
        defineConfig({
            resolve: {
                alias: [
                    { find: /^@minecraft\/server$/, replacement: server },
                    { find: /^@minecraft\/server-ui$/, replacement: serverUi },
                ],
            },
            test: {
                environment: "node",
                sequence: { concurrent: false },
            },
        }),
        config
    );
}
