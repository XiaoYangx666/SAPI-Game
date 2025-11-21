import { system } from "@minecraft/server";
import { SAPIGameConfig, SAPIGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { gameEvents } from "./gameEvent/gameEvent";
import { regGameCommand } from "./system/gameCommand";
import { GameManager } from "./system/gameManager";
import { globalPlayerManager } from "./system/globalPlayerManager";

export const Game = {
    /**框架预定义事件 */
    events: new gameEvents(),
    /**游戏管理器 */
    manager: new GameManager(),
    playerManager: new globalPlayerManager(),
    constants: Constants,
    /**全局配置 */
    config: SAPIGameConfig,
} as const;

/**使用配置初始化框架 */
export function initSAPIGame(config: SAPIGameConfigOptions) {
    SAPIGameConfig.update(config);
}

//注册指令
system.beforeEvents.startup.subscribe((t) => {
    regGameCommand(t.customCommandRegistry);
});

export * from "@sapi-game/gameRegion/index";
export * as Utils from "@sapi-game/utils";
export * from "./gameComponent/index";
export * from "./gameState/index";
export * from "./gamePlayer/index";
export { GameEngine } from "./gameEngine";
export { GameContext } from "./gameContext";
export { GameStructure } from "./gameStructure/gameStructure";
export { ScriptRunner, ScriptCancelledError } from "./Runner/scriptRunner";
export { RunnerManager } from "./Runner/RunnerManager";
export * from "./gameEvent/index";
export * from "./system/gameManager";
export * from "./system/globalPlayerManager";
export { createGameModule } from "./createGameModule";
