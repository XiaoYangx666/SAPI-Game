import { Player, system } from "@minecraft/server";
import { Game, initBEGame, BEGameInitOptions } from "../main";
import {
    registerServerGameCommands,
    ServerGameCommandOptions,
} from "./gameCommand";
import { ServerPlayerTracker } from "./playerTracker";

export interface ServerIntegrationOptions {
    onJoin?: (player: Player) => void;
    hub?: (player: Player) => void;
    onEnd?: () => void;
    registerCommands?: boolean;
}

export interface BEGameServerOptions
    extends BEGameInitOptions,
        ServerIntegrationOptions {}

/** @deprecated 使用 BEGameServerOptions。 */
export type SAPIGameServerOptions = BEGameServerOptions;

export class BEGameServerIntegration {
    public readonly players: ServerPlayerTracker;
    private readonly commandOptions: ServerGameCommandOptions;
    private started = false;
    private playerStartRunId?: number;
    private readonly startupHandler: Parameters<
        typeof system.beforeEvents.startup.subscribe
    >[0];

    constructor(private readonly options: ServerIntegrationOptions = {}) {
        this.players = new ServerPlayerTracker(
            Game.manager,
            Game.events.connection,
            { onJoin: options.onJoin }
        );
        this.commandOptions = { hub: options.hub, onEnd: options.onEnd };
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

        // Custom commands must subscribe during early execution so they receive the
        // startup registry. Player tracking, however, touches world.getAllPlayers(),
        // which is forbidden in early execution. Start only that part next tick.
        if (this.options.registerCommands ?? true) {
            system.beforeEvents.startup.subscribe(this.startupHandler);
        }
        this.playerStartRunId = system.run(() => {
            this.playerStartRunId = undefined;
            if (!this.started) return;
            this.players.start();
        });
        return this;
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        if (this.playerStartRunId !== undefined) {
            system.clearRun(this.playerStartRunId);
            this.playerStartRunId = undefined;
        }
        this.players.stop();
        if (this.options.registerCommands ?? true) {
            system.beforeEvents.startup.unsubscribe(this.startupHandler);
        }
    }
}

export function initBEGameServer(
    options: BEGameServerOptions = {}
): BEGameServerIntegration {
    const { onJoin, hub, onEnd, registerCommands, ...coreOptions } = options;
    initBEGame(coreOptions);
    return new BEGameServerIntegration({
        onJoin,
        hub,
        onEnd,
        registerCommands,
    }).start();
}

/** @deprecated 使用 BEGameServerIntegration。 */
export const SAPIGameServerIntegration = BEGameServerIntegration;
/** @deprecated 使用 initBEGameServer。 */
export const initSAPIGameServer = initBEGameServer;

export * from "./playerTracker";
export * from "./gameCommand";
