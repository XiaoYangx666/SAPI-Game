import { Player } from "@minecraft/server";
import { ParticipationManager } from "../participation/participationManager";
import { GamePlayer, GamePlayerConstructor } from "./gamePlayer";
import { PlayerGroupBuilder } from "./groupBuilder";

/**游戏实例内的玩家管理器 */
export class GamePlayerManager<T extends GamePlayer = GamePlayer> {
    private readonly players: Map<string, T> = new Map();
    public readonly playerConstructor: GamePlayerConstructor<T>;

    /**玩家组构建器 */
    public readonly groupBuilder: PlayerGroupBuilder<T>;

    constructor(
        playerConstructor: GamePlayerConstructor<T>,
        private readonly gameKey: string,
        private readonly participation: ParticipationManager,
        private readonly isDaemon: boolean
    ) {
        this.playerConstructor = playerConstructor;
        this.groupBuilder = new PlayerGroupBuilder(this);
    }

    /**
     * 获取/加入游戏玩家。
     *
     * 当前仍保留 get(Player) 这个入口，但玩家是否能进入游戏由注入的
     * ParticipationManager 决定，不再依赖全局 Game 单例。
     */
    get(p: Player) {
        let gamePlayer = this.players.get(p.id);
        if (!gamePlayer || !(gamePlayer as any).isActive) {
            gamePlayer = new this.playerConstructor(p);
            this.players.set(p.id, gamePlayer);

            if (!this.isDaemon) {
                const decision = this.participation.join(p.id, this.gameKey);
                (gamePlayer as any).isActive = decision.allowed;
            }
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
        if (!this.isDaemon) this.participation.leave(playerId, this.gameKey);
        return gamePlayer !== undefined;
    }

    /**兼容旧的按 Player 失活入口。*/
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
        if (!this.isDaemon) this.participation.releaseGame(this.gameKey);
    }
}
