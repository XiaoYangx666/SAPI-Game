// @ts-expect-error 测试包在 Node/Vitest 中运行，主 tsconfig 不加载 @types/node。
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("./scriptApiShell.js", import.meta.url));
const serverUi = fileURLToPath(new URL("./virtualMinecraftUi.js", import.meta.url));
const begamePackagePattern = /@begame[\\/]/;

type LooseConfig = Record<string, any>;

function normalizeAlias(alias: unknown): any[] {
    if (Array.isArray(alias)) return alias;
    if (alias && typeof alias === "object") {
        return Object.entries(alias as Record<string, string>).map(
            ([find, replacement]) => ({ find, replacement })
        );
    }
    return [];
}

function normalizeInline(inline: unknown): unknown {
    if (inline === true) return true;
    if (Array.isArray(inline)) return [begamePackagePattern, ...inline];
    if (inline === undefined) return [begamePackagePattern];
    return [begamePackagePattern, inline];
}

/**
 * 返回可直接作为 Vitest config 使用的配置对象。
 * @begame/test 本身不依赖 Vitest，只负责注入虚拟 ScriptAPI runtime。
 *
 * BEGame packages are inlined automatically so their @minecraft/* imports pass
 * through the virtual ScriptAPI aliases even when BEGame is installed from a
 * real npm tarball instead of a workspace/link dependency.
 */
export function defineBEGameTestConfig(config: LooseConfig = {}) {
    const resolve = (config.resolve ?? {}) as LooseConfig;
    const test = (config.test ?? {}) as LooseConfig;
    const sequence = (test.sequence ?? {}) as LooseConfig;
    const testServer = (test.server ?? {}) as LooseConfig;
    const deps = (testServer.deps ?? {}) as LooseConfig;

    return {
        ...config,
        resolve: {
            ...resolve,
            alias: [
                { find: /^@minecraft\/server$/, replacement: server },
                { find: /^@minecraft\/server-ui$/, replacement: serverUi },
                ...normalizeAlias(resolve.alias),
            ],
        },
        test: {
            environment: "node",
            ...test,
            server: {
                ...testServer,
                deps: {
                    ...deps,
                    inline: normalizeInline(deps.inline),
                },
            },
            sequence: {
                concurrent: false,
                ...sequence,
            },
        },
    };
}
