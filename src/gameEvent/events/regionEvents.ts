import { Player, world } from "@minecraft/server";
import { GameRegion } from "@sapi-game/utils/gameRegion";
import { Logger } from "@sapi-game/utils/logger";
import { DimensionIds } from "@sapi-game/utils/types";
import { CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";
import { IntervalEventSignal } from "./tick";

export enum RegionEventType {
    Enter = "enter",
    Leave = "leave",
}

/** 包含与玩家区域相关的信息 */
export interface PlayerRegionEvent {
    readonly player: Player;
    readonly type: RegionEventType;
    readonly region: GameRegion;
    readonly dimension: DimensionIds;
}

/** 玩家区域事件的相关参数 */
export interface RegionSubscriptionOptions {
    region: GameRegion;
    dimension: DimensionIds;
}

/**
 * @internal 内部用于存储每个订阅详细信息的数据结构
 */
interface RegionSubscription {
    callback: (event: PlayerRegionEvent) => void;
    options: RegionSubscriptionOptions;
}

export class PlayerRegionEventSignal
    implements CustomEventSignal<PlayerRegionEvent>
{
    constructor(private readonly tickEvent: IntervalEventSignal) {}
    private logger = new Logger(this.constructor.name);
    private subscription: Subscription | null = null;

    // 存储所有独立的订阅
    private allSubscriptions: Set<RegionSubscription> = new Set();

    // 核心状态：维护每个玩家当前所在的区域订阅。
    // Key: player.id, Value: 该玩家所在的 RegionSubscription
    private playerStates: Map<string, RegionSubscription> = new Map();

    /** 订阅玩家进出指定区域的事件。*/
    subscribe(
        callback: (event: PlayerRegionEvent) => void,
        options: RegionSubscriptionOptions
    ): Subscription {
        const subscription: RegionSubscription = { callback, options };
        this.allSubscriptions.add(subscription);

        // 如果这是第一个订阅，启动全局计时器
        if (this.subscription === null) {
            this.startMonitoring();
        }

        return {
            unsubscribe: () => {
                this.allSubscriptions.delete(subscription);

                // 如果所有订阅都取消了，停止全局计时器
                if (this.allSubscriptions.size === 0) {
                    this.stopMonitoring();
                }
            },
        };
    }

    private startMonitoring(): void {
        this.logger.debug("启动玩家区域观测");
        this.subscription = this.tickEvent.subscribe(
            this.checkAllPlayers.bind(this)
        );
    }

    private stopMonitoring(): void {
        if (this.subscription !== null) {
            this.logger.debug("停止玩家区域观测");
            this.subscription.unsubscribe();
            this.subscription = null;
            // 清理状态以防万一
            this.playerStates.clear();
        }
    }

    /** 遍历所有在线玩家，检查他们的区域状态。*/
    private checkAllPlayers(): void {
        const onlinePlayerIds = new Set<string>();

        // 1. 遍历所有在线玩家，处理状态变化
        for (const player of world.getAllPlayers()) {
            if (player == undefined) continue;
            onlinePlayerIds.add(player.id);
            const previousState = this.playerStates.get(player.id) ?? null;
            const currentState = this.findRegionForPlayer(player);

            // 状态机：检查是否发生变化
            if (previousState !== currentState) {
                // 触发离开事件 (如果之前在某个区域)
                if (previousState) {
                    this.publish(player, RegionEventType.Leave, previousState);
                }
                // 触发进入事件 (如果现在进入了某个区域)
                if (currentState) {
                    this.publish(player, RegionEventType.Enter, currentState);
                }

                // 更新玩家状态
                if (currentState) {
                    this.playerStates.set(player.id, currentState);
                } else {
                    this.playerStates.delete(player.id);
                }
            }
        }

        // 2. 处理离线玩家
        for (const playerId of this.playerStates.keys()) {
            if (!onlinePlayerIds.has(playerId)) {
                this.playerStates.delete(playerId);
                this.logger.debug(
                    `区域中的玩家: ${playerId} 离开了游戏. 状态已清理.`
                );
            }
        }
    }

    /** 为指定玩家查找其当前所在的区域。*/
    private findRegionForPlayer(player: Player): RegionSubscription | null {
        for (const sub of this.allSubscriptions) {
            if (player.dimension.id == sub.options.dimension) {
                if (sub.options.region.isInRegion(player.location)) {
                    return sub;
                }
            }
        }
        return null;
    }

    /** 发布事件 */
    private publish(
        player: Player,
        type: RegionEventType,
        subscription: RegionSubscription
    ): void {
        try {
            subscription.callback({
                player,
                type,
                region: subscription.options.region,
                dimension: subscription.options.dimension,
            });
        } catch (e) {
            this.logger.error("Region event callback error:", e);
        }
    }

    dispose(): void {
        this.stopMonitoring();
        this.allSubscriptions.clear();
    }
}
