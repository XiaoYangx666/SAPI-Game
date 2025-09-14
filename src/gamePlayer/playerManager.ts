import { Player } from "@minecraft/server";
import { GamePlayer, GamePlayerConstructor } from "./gamePlayer";
import { PlayerGroupBuilder } from "./groupBuilder";

/**游戏玩家管理器 */
export class GamePlayerManager<T extends GamePlayer = GamePlayer> {
    private readonly players: Map<string, T> = new Map();
    public readonly playerConstructor: GamePlayerConstructor<T>;
    /**玩家组构建器 */
    public readonly groupBuilder: PlayerGroupBuilder;

    constructor(playerConstructor: GamePlayerConstructor<T>) {
        this.playerConstructor = playerConstructor;
        this.groupBuilder = new PlayerGroupBuilder(this);
    }

    /**获取游戏玩家 */
    get(p: Player) {
        let gamePlayer = this.players.get(p.id);
        if (!gamePlayer) {
            gamePlayer = new this.playerConstructor(p);
            this.players.set(p.id, gamePlayer);
        }
        return gamePlayer;
    }
}
