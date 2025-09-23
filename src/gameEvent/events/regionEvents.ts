import { Player, world } from "@minecraft/server";
import { difference } from "@sapi-game/utils/func";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { Logger } from "@sapi-game/utils/logger";
import { DimensionIds } from "@sapi-game/utils/vanila-data";
import { CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";
import { IntervalEventSignal } from "./interval";

export enum RegionEventType {
    Enter = "enter",
    Leave = "leave",
}

export interface PlayerRegionEvent {
    readonly player: Player;
    readonly type: RegionEventType;
    readonly region: GameRegion;
}

interface RegionSubscription {
    callback: (event: PlayerRegionEvent) => void;
    region: GameRegion;
}

export class PlayerRegionEventSignal
    implements CustomEventSignal<PlayerRegionEvent>
{
    constructor(private readonly tickEvent: IntervalEventSignal) {}
    private logger = new Logger(this.constructor.name);
    private subscription: Subscription | null = null;

    private allSubscriptions: Set<RegionSubscription> = new Set();

    // 每个 region 当前的玩家状态
    private regionStates: Map<GameRegion, Set<string>> = new Map();

    subscribe(
        callback: (event: PlayerRegionEvent) => void,
        region: GameRegion
    ): Subscription {
        const subscription: RegionSubscription = { callback, region };
        this.allSubscriptions.add(subscription);

        // 初始化状态
        if (!this.regionStates.has(region)) {
            this.regionStates.set(region, new Set());
        }

        if (this.subscription === null) {
            this.startMonitoring();
        }

        return {
            unsubscribe: () => {
                this.allSubscriptions.delete(subscription);
                // 如果 region 没有订阅者了，清理它的状态
                if (
                    ![...this.allSubscriptions].some(
                        (sub) => sub.region === region
                    )
                ) {
                    this.regionStates.delete(region);
                }

                if (this.allSubscriptions.size === 0) {
                    this.stopMonitoring();
                }
            },
        };
    }

    private startMonitoring(): void {
        this.logger.debug("启动玩家区域观测");
        this.subscription = this.tickEvent.subscribe(
            this.checkAllRegions.bind(this)
        );
    }

    private stopMonitoring(): void {
        if (this.subscription !== null) {
            this.logger.debug("停止玩家区域观测");
            this.subscription.unsubscribe();
            this.subscription = null;
            this.regionStates.clear();
        }
    }

    private checkAllRegions(): void {
        // 1. 按维度收集所有玩家
        const players = world.getAllPlayers();
        const playersByDimension: Record<string, Player[]> = {};
        const dimensions = [
            DimensionIds.Overworld,
            DimensionIds.Nether,
            DimensionIds.End,
        ];

        for (const dim of dimensions) {
            playersByDimension[dim] = players.filter(
                (p) => p.dimension.id === dim
            );
        }

        // 2. 遍历所有订阅区域
        for (const sub of this.allSubscriptions) {
            const region = sub.region;
            const prevPlayers =
                this.regionStates.get(region) ?? new Set<string>();

            const dimensionPlayers =
                playersByDimension[region.dimensionId] ?? [];
            const currPlayers = new Set(
                dimensionPlayers
                    .filter((p) => region.isInside(p.location))
                    .map((p) => p.id)
            );

            // 进入事件
            for (const playerId of difference(currPlayers, prevPlayers)) {
                const player = dimensionPlayers.find((p) => p.id === playerId)!;
                this.publish(player, RegionEventType.Enter, sub);
            }

            //离开事件
            for (const playerId of difference(prevPlayers, currPlayers)) {
                const player = dimensionPlayers.find((p) => p.id === playerId);
                if (player) this.publish(player, RegionEventType.Leave, sub);
            }

            // 更新状态
            this.regionStates.set(region, currPlayers);
        }
    }

    private publish(
        player: Player,
        type: RegionEventType,
        subscription: RegionSubscription
    ): void {
        try {
            subscription.callback({
                player,
                type,
                region: subscription.region,
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
