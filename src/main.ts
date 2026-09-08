import { SAPIGameConfig, SAPIGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { gameEvents } from "./gameEvent/gameEvent";
import { ParticipationPolicy } from "./participation/participationManager";
import { GameManager } from "./system/gameManager";

export { SAPIGameConfig } from "./config";
export type { SAPIGameConfigOptions } from "./config";

export interface SAPIGameInitOptions extends SAPIGameConfigOptions {
    participationPolicy?: ParticipationPolicy;
}

const manager = new GameManager();

/**
 * SAPIGame 核心全局入口。
 *
 * 这里只包含游戏本身需要的能力；Hub、全服玩家追踪、管理命令等
 * 服务器级能力需要显式启用 `sapi-game/server`。
 */
export const Game = {
    events: new gameEvents(),
    manager,
    participation: manager.participation,
    constants: Constants,
    config: SAPIGameConfig,
} as const;

/**初始化 SAPIGame 核心。该函数本身不会注册服务器命令或玩家轮询。*/
export function initSAPIGame(options: SAPIGameInitOptions = {}) {
    const { participationPolicy, ...config } = options;
    SAPIGameConfig.update(config);
    if (participationPolicy) {
        manager.participation.setPolicy(participationPolicy);
    }
}

export * from "@sapi-game/gameRegion/index";
export * as Utils from "@sapi-game/utils";
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
