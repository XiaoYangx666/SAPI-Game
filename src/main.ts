import { BEGameConfig, BEGameConfigOptions } from "./config";
import { Constants } from "./constants";
import { gameEvents } from "./gameEvent/gameEvent";
import { ParticipationPolicy } from "./participation/participationManager";
import { GameManager } from "./system/gameManager";

export { BEGameConfig, SAPIGameConfig } from "./config";
export type { BEGameConfigOptions, SAPIGameConfigOptions } from "./config";

export interface BEGameInitOptions extends BEGameConfigOptions {
    participationPolicy?: ParticipationPolicy;
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
    const { participationPolicy, ...config } = options;
    BEGameConfig.update(config);
    if (participationPolicy) manager.participation.setPolicy(participationPolicy);
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
