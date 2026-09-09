// @ts-expect-error 测试包在 Node/Vitest 中运行，主 tsconfig 不加载 @types/node。
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type UserConfig } from "vitest/config";

const server = fileURLToPath(new URL("./virtualMinecraft.js", import.meta.url));
const serverUi = fileURLToPath(new URL("./virtualMinecraftUi.js", import.meta.url));

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
