// 该入口仅用于 Node 测试运行时。
// @ts-expect-error Node 内建模块在当前库 tsconfig 中不加载 @types/node。
import { registerHooks } from "node:module";

const serverUrl = new URL("./virtualMinecraft.js", import.meta.url).href;
const serverUiUrl = new URL("./virtualMinecraftUi.js", import.meta.url).href;

registerHooks({
    resolve(
        specifier: string,
        context: unknown,
        nextResolve: (specifier: string, context: unknown) => unknown
    ) {
        if (specifier === "@minecraft/server") {
            return { url: serverUrl, shortCircuit: true };
        }
        if (specifier === "@minecraft/server-ui") {
            return { url: serverUiUrl, shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});
