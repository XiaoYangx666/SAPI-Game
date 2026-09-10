import { BEGameConfig, BEGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { gameEvents } from "./gameEvent/gameEvent";
import { ParticipationPolicy } from "./participation/participationManager";
import { GameManager } from "./system/gameManager";
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
manager.trace.bindConnectionSource(events.connection);

/** BEGame 核心全局入口。服务器级能力需要显式启用 `@begame/core/server`。 */
export const Game = {
    events,
    manager,
    participation: manager.participation,
    trace: manager.trace,
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
export * from "./trace/index";
export { createGameModule } from "./createGameModule";
