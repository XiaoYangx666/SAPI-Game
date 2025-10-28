import { Player, world } from "@minecraft/server";
import { GameRegion } from "../gameRegion/gameRegion";
import { DimensionIds } from "../utils/vanila-data";
import { GamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";
import { GamePlayerManager } from "./playerManager";

/**玩家组构建器 */
export class PlayerGroupBuilder<T extends GamePlayer = GamePlayer> {
    playerManager: GamePlayerManager<T>;
    constructor(manager: GamePlayerManager<T>) {
        this.playerManager = manager;
    }

    /**创建空的玩家组 */
    emptyGroup<TData = undefined>(
        ...rest: TData extends undefined ? [] : [data: TData]
    ): PlayerGroup<T, TData> {
        return new PlayerGroup<T, TData>(
            this.playerManager.playerConstructor,
            [],
            rest[0] as TData
        );
    }

    /** 从原生 Player 创建 PlayerGroup 并映射到 playerManager */
    fromPlayers<TData = undefined>(
        players: Player[],
        ...rest: TData extends undefined ? [] : [data: TData]
    ) {
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.playerManager.get(p)),
            rest[0] as TData
        );
    }

    /** 从已有 PlayerGroup 创建 engine PlayerGroup */
    fromGroup<TData = undefined>(
        group: PlayerGroup<any>,
        ...rest: TData extends undefined ? [] : [data: TData]
    ) {
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            group.getAllPlayers().map((p) => this.playerManager.get(p)),
            rest[0] as TData
        );
    }

    /**从某个区域创建 */
    fromRegion<TData = unknown>(
        dim: DimensionIds,
        region: GameRegion,
        ...rest: TData extends undefined ? [] : [data: TData]
    ) {
        const players = world
            .getDimension(dim)
            .getPlayers(region.getEntityQueryOption())
            .filter((p) => p != undefined);
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.playerManager.get(p)),
            rest[0] as TData
        );
    }

    /**从所有玩家创建 */
    fromAll<TData = unknown>(
        ...rest: TData extends undefined ? [] : [data: TData]
    ) {
        const players = world.getAllPlayers().filter((p) => p != undefined);
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.playerManager.get(p)),
            rest[0] as TData
        );
    }
}
