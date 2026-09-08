import { Player, system, world } from "@minecraft/server";
import { GameManager } from "../system/gameManager";

export interface ServerPlayerTrackerOptions {
    onJoin?: (player: Player) => void;
}

/**
 * 小游戏服务器/地图层的在线玩家追踪。
 *
 * 它不保存游戏 membership；“玩家正在参加哪些游戏”只由
 * GameManager.participation 维护。
 */
export class ServerPlayerTracker {
    private onlineIds = new Set<string>();
    private bootstrapRun?: number;
    private intervalRun?: number;
    private started = false;

    constructor(
        private readonly games: GameManager,
        private readonly options: ServerPlayerTrackerOptions = {}
    ) {}

    start() {
        if (this.started) return this;
        this.started = true;
        this.bootstrapRun = system.run(() => {
            if (!this.started) return;
            this.scan();
            this.intervalRun = system.runInterval(() => this.scan());
        });
        return this;
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        if (this.bootstrapRun !== undefined) system.clearRun(this.bootstrapRun);
        if (this.intervalRun !== undefined) system.clearRun(this.intervalRun);
        this.bootstrapRun = undefined;
        this.intervalRun = undefined;
        this.onlineIds.clear();
    }

    getFreePlayers(): Player[] {
        return world
            .getAllPlayers()
            .filter((player) => !this.games.participation.has(player.id));
    }

    status(): string {
        const online = world.getAllPlayers();
        const participating = online.filter((player) =>
            this.games.participation.has(player.id)
        ).length;
        return `在线: ${online.length}, 参与游戏: ${participating}, 空闲: ${online.length - participating}`;
    }

    private scan() {
        const players = world.getAllPlayers();
        const nextOnlineIds = new Set<string>();

        for (const player of players) {
            nextOnlineIds.add(player.id);
            if (!this.onlineIds.has(player.id)) {
                this.options.onJoin?.(player);
            }
        }

        this.onlineIds = nextOnlineIds;
    }
}
