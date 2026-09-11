import { Player, world } from "@minecraft/server";
import { GameRegion } from "../gameRegion/gameRegion";
import { gameServer } from "../system/server";
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

    /**
     * 从原生 Player 创建 PlayerGroup。
     * 这些玩家必须已经属于当前游戏；该方法不会隐式创建 participation。
     */
    fromPlayers<TData = undefined>(
        players: Player[],
        ...rest: TData extends undefined ? [] : [data: TData]
    ) {
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.requirePlayer(p)),
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
            group.getAllPlayers().map((p) => this.requirePlayer(p)),
            rest[0] as TData
        );
    }

    /**从某个区域中的已参与玩家创建 */
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
            players.map((p) => this.requirePlayer(p)),
            rest[0] as TData
        );
    }

    /**从所有已参与且在线的玩家创建 */
    fromAll<TData = unknown>(
        ...rest: TData extends undefined ? [] : [data: TData]
    ) {
        const players = gameServer.getAllPlayers();
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players
                .map((p) => this.playerManager.get(p))
                .filter((p): p is T => p !== undefined),
            rest[0] as TData
        );
    }

    private requirePlayer(player: Player): T {
        const gamePlayer = this.playerManager.get(player);
        if (!gamePlayer) {
            throw new Error(
                `玩家 ${player.name} (${player.id}) 尚未加入当前游戏`
            );
        }
        return gamePlayer;
    }
}
