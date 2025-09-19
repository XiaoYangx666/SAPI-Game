import { system } from "@minecraft/server";
import { SAPIGameConfig, SAPIGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { regGameCommand } from "./gameCommand";
import { gameEvents } from "./gameEvent/gameEvent";
import { GameManager } from "./gameManager";

export const Game = {
    events: new gameEvents(),
    manager: new GameManager(),
    constants: Constants,
} as const;

/**使用配置初始化框架 */
export function initSAPIGame(config: SAPIGameConfigOptions) {
    SAPIGameConfig.update(config);
}

//注册指令
system.beforeEvents.startup.subscribe((t) => {
    regGameCommand(t.customCommandRegistry);
});

export * as GameUtils from "@sapi-game/utils";
export { GameComponent } from "./gameComponent/gameComponent";
export { GameEngine } from "./gameEngine";
export { GameState } from "./gameState";
