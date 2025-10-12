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

export * as Region from "@sapi-game/gameRegion/gameRegion";
export { regionHelper } from "@sapi-game/gameRegion/regionHelper";
export * as GameUtils from "@sapi-game/utils";
export { GameComponent } from "./gameComponent/gameComponent";
export { GameEngine } from "./gameEngine";
export { GameState } from "./gameState";
