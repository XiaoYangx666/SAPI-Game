import { Player } from "@minecraft/server";
import { Game, globalPlayerManagerInternal } from "@sapi-game/main";
import { GamePlayer, GamePlayerConstructor } from "./gamePlayer";
import { PlayerGroupBuilder } from "./groupBuilder";

/**游戏玩家管理器 */
export class GamePlayerManager<T extends GamePlayer = GamePlayer> {
    private readonly players: Map<string, T> = new Map();
    public readonly playerConstructor: GamePlayerConstructor<T>;

    /**玩家组构建器 */
    public readonly groupBuilder: PlayerGroupBuilder<T>;

    constructor(
        playerConstructor: GamePlayerConstructor<T>,
        private readonly gameKey: string,
        private readonly isDaemon: boolean
    ) {
        this.playerConstructor = playerConstructor;
        this.groupBuilder = new PlayerGroupBuilder(this);
    }

    /**获取游戏玩家(若玩家已分配，返回无效玩家) */
    get(p: Player) {
        //创建
        let gamePlayer = this.players.get(p.id);
        //若未创建或已失效，则重新创建并尝试分配
        if (!gamePlayer || !(gamePlayer as any).isActive) {
            gamePlayer = new this.playerConstructor(p);
            this.players.set(p.id, gamePlayer);
            //申请分配玩家
            if (!this.isDaemon) {
                const ans = (
                    Game.playerManager as unknown as globalPlayerManagerInternal
                ).allocatePlayerToGame(p.id, this.gameKey);
                (gamePlayer as any).isActive = ans;
            }
        }
        return gamePlayer;
    }

    getAll(): T[] {
        return Array.from(this.players.values());
    }

    /**让玩家失活 */
    deactivate(p: Player) {
        let gamePlayer = this.players.get(p.id);
        if (gamePlayer) {
            (gamePlayer as any).isActive = false; //强制修改活动状态
        }
    }

    get size() {
        return this.players.size;
    }

    get validSize() {
        return Array.from(this.players.values()).filter((p) => p.isValid)
            .length;
    }

    dispose() {
        (
            Game.playerManager as unknown as globalPlayerManagerInternal
        ).releaseAllPlayerFromGame(this.gameKey);
    }
}
