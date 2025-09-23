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

    emptyGroup() {
        return new PlayerGroup(this.playerManager.playerConstructor);
    }

    /** 从原生 Player 创建 PlayerGroup 并映射到 playerManager */
    fromPlayers(players: Player[]) {
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.playerManager.get(p))
        );
    }

    /** 从已有 PlayerGroup 创建 engine PlayerGroup */
    fromGroup(group: PlayerGroup<any>) {
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            group.getAllPlayers().map((p) => this.playerManager.get(p))
        );
    }

    /**从某个区域创建 */
    fromRegion(dim: DimensionIds, region: GameRegion) {
        const players = world
            .getDimension(dim)
            .getPlayers(region.getEntityQueryOption())
            .filter((p) => p != undefined);
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.playerManager.get(p))
        );
    }

    /**从所有玩家创建 */
    fromAll() {
        const players = world.getAllPlayers().filter((p) => p != undefined);
        return new PlayerGroup(
            this.playerManager.playerConstructor,
            players.map((p) => this.playerManager.get(p))
        );
    }
}
