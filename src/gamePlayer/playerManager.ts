import { Player } from "@minecraft/server";
import { GameParticipation } from "../participation/gameParticipation";
import { GamePlayer, GamePlayerConstructor } from "./gamePlayer";
import { PlayerGroupBuilder } from "./groupBuilder";

/**游戏实例内的在线 GamePlayer 管理器。*/
export class GamePlayerManager<T extends GamePlayer = GamePlayer> {
    private readonly players: Map<string, T> = new Map();
    public readonly playerConstructor: GamePlayerConstructor<T>;

    /**玩家组构建器 */
    public readonly groupBuilder: PlayerGroupBuilder<T>;

    constructor(
        playerConstructor: GamePlayerConstructor<T>,
        private readonly participation: GameParticipation
    ) {
        this.playerConstructor = playerConstructor;
        this.groupBuilder = new PlayerGroupBuilder(this);
    }

    /**
     * 获取/创建在线 GamePlayer。
     *
     * membership 可以在玩家在线前由 engine.participation 仅凭 playerId 建立；
     * 若此前尚未建立，get(Player) 仍会尝试加入，方便简单小游戏使用。
     */
    get(p: Player) {
        let gamePlayer = this.players.get(p.id);
        if (!gamePlayer || !(gamePlayer as any).isActive) {
            const decision = this.participation.join(p.id);
            gamePlayer = new this.playerConstructor(p);
            this.players.set(p.id, gamePlayer);
            (gamePlayer as any).isActive = decision.allowed;
        }
        return gamePlayer;
    }

    getById(playerId: string): T | undefined {
        return this.players.get(playerId);
    }

    getAll(): T[] {
        return Array.from(this.players.values());
    }

    /**让玩家退出当前游戏，并释放 participation。*/
    leave(playerId: string): boolean {
        const gamePlayer = this.players.get(playerId);
        if (gamePlayer) (gamePlayer as any).isActive = false;
        const released = this.participation.leave(playerId);
        return gamePlayer !== undefined || released;
    }

    deactivate(p: Player) {
        this.leave(p.id);
    }

    get size() {
        return this.players.size;
    }

    get validSize() {
        return Array.from(this.players.values()).filter((p) => p.isValid)
            .length;
    }

    dispose() {
        for (const player of this.players.values()) {
            (player as any).isActive = false;
        }
        this.participation.clear();
    }
}
