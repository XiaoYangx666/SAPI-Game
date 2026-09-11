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
 * 自动 unsubscribe，因此仅 import BEGame Core 不会产生连接追踪副作用。
 *
 * 该 Signal 只描述连接状态变化，不保存或暴露当前在线玩家快照。
 * 当前玩家状态统一通过 Game.server.getAllPlayers() 查询。
 */
export class PlayerConnectionEventSignal
    implements CustomEventSignal<PlayerConnectionEvent>
{
    private readonly callbacks = new Set<
        (event: PlayerConnectionEvent) => void
    >();
    private started = false;

    private readonly spawnHandler = (event: PlayerSpawnAfterEvent) => {
        if (!event.initialSpawn) return;
        this.publish({
            type: "online",
            playerId: event.player.id,
            playerName: event.player.name,
            player: event.player,
        });
    };

    private readonly leaveHandler = (event: PlayerLeaveAfterEvent) => {
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

    private start() {
        if (this.started) return;
        this.started = true;
        world.afterEvents.playerSpawn.subscribe(this.spawnHandler);
        world.afterEvents.playerLeave.subscribe(this.leaveHandler);
    }

    private stop() {
        if (!this.started) return;
        this.started = false;
        world.afterEvents.playerSpawn.unsubscribe(this.spawnHandler);
        world.afterEvents.playerLeave.unsubscribe(this.leaveHandler);
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
