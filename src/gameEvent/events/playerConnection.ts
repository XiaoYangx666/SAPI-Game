import {
    Player,
    PlayerLeaveAfterEvent,
    PlayerSpawnAfterEvent,
    world,
} from "@minecraft/server";
import { CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";

export type PlayerConnectionEvent =
    | {
          readonly type: "online";
          readonly playerId: string;
          readonly playerName: string;
          readonly player: Player;
      }
    | {
          readonly type: "offline";
          readonly playerId: string;
          readonly playerName: string;
      };

/**
 * 玩家连接生命周期事件。
 *
 * 只有出现第一个订阅者时才连接 Minecraft 原生事件；最后一个订阅者离开后
 * 自动 unsubscribe，因此仅 import SAPIGame Core 不会产生连接追踪副作用。
 *
 * Signal 启动时会抓取一次当前在线玩家快照，供长期生命周期组件判断
 * “组件挂载之前就已经掉线/在线”的玩家状态。
 */
export class PlayerConnectionEventSignal
    implements CustomEventSignal<PlayerConnectionEvent>
{
    private readonly callbacks = new Set<
        (event: PlayerConnectionEvent) => void
    >();
    private readonly onlinePlayers = new Map<string, Player>();
    private started = false;

    private readonly spawnHandler = (event: PlayerSpawnAfterEvent) => {
        if (!event.initialSpawn) return;
        this.onlinePlayers.set(event.player.id, event.player);
        this.publish({
            type: "online",
            playerId: event.player.id,
            playerName: event.player.name,
            player: event.player,
        });
    };

    private readonly leaveHandler = (event: PlayerLeaveAfterEvent) => {
        this.onlinePlayers.delete(event.playerId);
        this.publish({
            type: "offline",
            playerId: event.playerId,
            playerName: event.playerName,
        });
    };

    subscribe(
        callback: (event: PlayerConnectionEvent) => void
    ): Subscription {
        this.callbacks.add(callback);
        if (!this.started) this.start();

        let unsubscribed = false;
        return {
            unsubscribe: () => {
                if (unsubscribed) return;
                unsubscribed = true;
                this.callbacks.delete(callback);
                if (this.callbacks.size === 0) this.stop();
            },
        };
    }

    /**当前是否有该 playerId 对应的在线 Player。*/
    isOnline(playerId: string): boolean {
        return this.getOnlinePlayer(playerId) !== undefined;
    }

    /**获取当前在线 Player；若已失效会顺便从快照清理。*/
    getOnlinePlayer(playerId: string): Player | undefined {
        const player = this.onlinePlayers.get(playerId);
        if (!player) return;
        if (!player.isValid) {
            this.onlinePlayers.delete(playerId);
            return;
        }
        return player;
    }

    private start() {
        if (this.started) return;
        this.started = true;
        this.onlinePlayers.clear();
        for (const player of world.getAllPlayers()) {
            if (player.isValid) this.onlinePlayers.set(player.id, player);
        }
        world.afterEvents.playerSpawn.subscribe(this.spawnHandler);
        world.afterEvents.playerLeave.subscribe(this.leaveHandler);
    }

    private stop() {
        if (!this.started) return;
        this.started = false;
        world.afterEvents.playerSpawn.unsubscribe(this.spawnHandler);
        world.afterEvents.playerLeave.unsubscribe(this.leaveHandler);
        this.onlinePlayers.clear();
    }

    private publish(event: PlayerConnectionEvent) {
        for (const callback of [...this.callbacks]) {
            try {
                callback(event);
            } catch (err) {
                console.error("Player connection callback error:", err);
            }
        }
    }

    dispose() {
        this.callbacks.clear();
        this.stop();
    }
}
