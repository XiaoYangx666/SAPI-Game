import { system } from "@minecraft/server";
import { SAPIGameConfig, SAPIGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { gameEvents } from "./gameEvent/gameEvent";
import { regGameCommand } from "./system/gameCommand";
import { GameManager } from "./system/gameManager";
import { globalPlayerManager } from "./system/globalPlayerManager";

export { SAPIGameConfig } from "./config";

const manager = new GameManager();

export const Game = {
    /**框架预定义事件 */
    events: new gameEvents(),
    /**游戏实例管理器 */
    manager,
    /**玩家与游戏实例之间的参与关系 */
    participation: manager.participation,
    /**服务器级玩家追踪（onJoin / free players / hub integration） */
    playerManager: new globalPlayerManager(),
    constants: Constants,
    /**全局配置 */
    config: SAPIGameConfig,
} as const;

/**使用配置初始化框架 */
export function initSAPIGame(config: SAPIGameConfigOptions) {
    SAPIGameConfig.update(config);
}

system.beforeEvents.startup.subscribe((t) => {
    regGameCommand(t.customCommandRegistry);
});

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
export * from "./system/globalPlayerManager";
export { createGameModule } from "./createGameModule";
