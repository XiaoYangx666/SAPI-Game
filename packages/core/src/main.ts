import { BEGameConfig, BEGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { gameEvents } from "./gameEvent/gameEvent";
import { ParticipationPolicy } from "./participation/participationManager";
import { GameManager } from "./system/gameManager";
import { gameServer } from "./system/server";
import { isTraceRuntimeInstalled } from "./trace/registry";
import { Logger } from "./utils/logger";
import type { WorldTraceStoreOptions } from "./trace/worldStore";

export { BEGameConfig, SAPIGameConfig } from "./config";
export type { BEGameConfigOptions, SAPIGameConfigOptions } from "./config";

export interface BEGameTraceStoreInitOptions extends WorldTraceStoreOptions {
    /** Whether World Dynamic Property history storage is enabled. Defaults to true when this object is provided. */
    enabled?: boolean;
}

export interface BEGameInitOptions extends BEGameConfigOptions {
    participationPolicy?: ParticipationPolicy;
    /**
     * Persistent Game Trace history in World Dynamic Properties.
     * Omit to leave the current runtime setting unchanged; boolean toggles storage,
     * or provide retention options plus `enabled`.
     */
    traceStore?: boolean | BEGameTraceStoreInitOptions;
}

/** @deprecated 使用 BEGameInitOptions。 */
export type SAPIGameInitOptions = BEGameInitOptions;

const manager = new GameManager();
const events = new gameEvents();
// Recorded, not bound: the trace runtime is created lazily, so this stays
// correct no matter whether the consumer's trace entry is evaluated before or
// after `@begame/core`.
manager.bindTraceConnectionSource(events.connection);

/** BEGame 核心全局入口。命令/onJoin 等服务器集成能力仍需显式启用 `@begame/core/server`。 */
export const Game = {
    events,
    server: gameServer,
    manager,
    participation: manager.participation,
    // Must stay a getter: reading it here would resolve the trace runtime while
    // this module is still evaluating, before an opt-in entry could install it.
    get trace() {
        return manager.trace;
    },
    constants: Constants,
    config: BEGameConfig,
} as const;

/** 初始化 BEGame Core；不会注册服务器命令或玩家轮询。 */
export function initBEGame(options: BEGameInitOptions = {}) {
    const { participationPolicy, traceStore, ...config } = options;
    BEGameConfig.update(config);
    if (participationPolicy) {
        manager.participation.setPolicy(participationPolicy);
    }
    if (traceStore !== undefined) {
        const wantsTrace =
            typeof traceStore === "boolean"
                ? traceStore
                : traceStore.enabled !== false;
        if (wantsTrace && !isTraceRuntimeInstalled()) {
            // Otherwise this silently does nothing and the missing history looks
            // like a framework bug rather than a missing import.
            new Logger("BEGame").error(
                'traceStore 已启用，但 Trace 运行时未加载。请在使用 Trace 的入口 import "@begame/core/trace"。'
            );
        }
        if (typeof traceStore === "boolean") {
            manager.trace.setStoreEnabled(traceStore);
        } else {
            const { enabled = true, ...storeOptions } = traceStore;
            manager.trace.configureStore(storeOptions);
            manager.trace.setStoreEnabled(enabled);
        }
    }
}

/** @deprecated 使用 initBEGame。 */
export const initSAPIGame = initBEGame;

export * from "./gameRegion/index";
export * as Utils from "./utils/index";
export * from "./gameComponent/index";
export * from "./gameState/index";
export * from "./gamePlayer/index";
export * from "./participation/participationManager";
export { GameEngine } from "./gameEngine";
export type { GameEngineOwner } from "./gameEngine";
export { GameContext } from "./gameContext";
export { GameStructure } from "./gameStructure/gameStructure";
export { ScriptRunner, ScriptCancelledError } from "./Runner/scriptRunner";
export { RunnerManager } from "./Runner/RunnerManager";
export * from "./gameEvent/index";
export * from "./system/gameManager";
export { createGameModule } from "./createGameModule";
