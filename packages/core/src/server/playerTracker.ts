import { Player, world } from "@minecraft/server";
import {
    PlayerConnectionEventSignal,
    type PlayerConnectionEvent,
} from "../gameEvent/events/playerConnection";
import type { Subscription } from "../gameEvent/subscription";
import { GameManager } from "../system/gameManager";

export interface ServerPlayerTrackerOptions {
    onJoin?: (player: Player) => void;
}

/**
 * 小游戏服务器/地图层的在线玩家追踪。
 *
 * 启动时只扫描一次当前在线玩家，之后复用 SAPIGame 的连接事件；
 * 它不保存游戏 membership。
 */
export class ServerPlayerTracker {
    private onlineIds = new Set<string>();
    private connectionSubscription?: Subscription;
    private started = false;

    constructor(
        private readonly games: GameManager,
        private readonly connection: PlayerConnectionEventSignal,
        private readonly options: ServerPlayerTrackerOptions = {}
    ) {}

    start() {
        if (this.started) return this;
        this.started = true;

        // 先订阅再扫描，避免启动窗口内刚好有玩家进入时漏事件。
        this.connectionSubscription = this.connection.subscribe((event) =>
            this.handleConnection(event)
        );
        for (const player of world.getAllPlayers()) {
            this.handleOnline(player);
        }
        return this;
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        this.connectionSubscription?.unsubscribe();
        this.connectionSubscription = undefined;
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

    private handleConnection(event: PlayerConnectionEvent) {
        if (!this.started) return;
        if (event.type === "online") {
            this.handleOnline(event.player);
        } else {
            this.onlineIds.delete(event.playerId);
        }
    }

    private handleOnline(player: Player) {
        if (this.onlineIds.has(player.id)) return;
        this.onlineIds.add(player.id);
        this.options.onJoin?.(player);
    }
}
