import { Player, system } from "@minecraft/server";
import {
    Game,
    initSAPIGame,
    SAPIGameInitOptions,
} from "../main";
import {
    registerServerGameCommands,
    ServerGameCommandOptions,
} from "./gameCommand";
import { ServerPlayerTracker } from "./playerTracker";

export interface ServerIntegrationOptions {
    onJoin?: (player: Player) => void;
    hub?: (player: Player) => void;
    onEnd?: () => void;
    /**是否注册 /game:* 与 /game:hub 等服务器命令，默认 true。*/
    registerCommands?: boolean;
}

export interface SAPIGameServerOptions
    extends SAPIGameInitOptions,
        ServerIntegrationOptions {}

/**
 * SAPIGame 的“完整小游戏服务器/地图”集成层。
 *
 * 核心包本身不再接管服务器；只有显式创建并 start 此 integration，
 * 才会启用全服玩家追踪和 SAPIGame 管理命令。
 */
export class SAPIGameServerIntegration {
    public readonly players: ServerPlayerTracker;
    private readonly commandOptions: ServerGameCommandOptions;
    private started = false;
    private readonly startupHandler: Parameters<
        typeof system.beforeEvents.startup.subscribe
    >[0];

    constructor(private readonly options: ServerIntegrationOptions = {}) {
        this.players = new ServerPlayerTracker(
            Game.manager,
            Game.events.connection,
            { onJoin: options.onJoin }
        );
        this.commandOptions = {
            hub: options.hub,
            onEnd: options.onEnd,
        };
        this.startupHandler = (event) => {
            registerServerGameCommands(
                event.customCommandRegistry,
                Game.manager,
                this.commandOptions
            );
        };
    }

    start() {
        if (this.started) return this;
        this.started = true;
        this.players.start();
        if (this.options.registerCommands ?? true) {
            system.beforeEvents.startup.subscribe(this.startupHandler);
        }
        return this;
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        this.players.stop();
        if (this.options.registerCommands ?? true) {
            system.beforeEvents.startup.unsubscribe(this.startupHandler);
        }
    }
}

/**
 * 一步启用 SAPIGame 的传统“大而全”小游戏服务器体验。
 * Addon/嵌入式使用者只需 initSAPIGame，不需要调用此函数。
 */
export function initSAPIGameServer(
    options: SAPIGameServerOptions = {}
): SAPIGameServerIntegration {
    const {
        onJoin,
        hub,
        onEnd,
        registerCommands,
        ...coreOptions
    } = options;

    initSAPIGame(coreOptions);

    return new SAPIGameServerIntegration({
        onJoin,
        hub,
        onEnd,
        registerCommands,
    }).start();
}

export * from "./playerTracker";
export * from "./gameCommand";
