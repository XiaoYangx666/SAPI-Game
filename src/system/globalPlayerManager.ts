import { Player, system, world } from "@minecraft/server";
import { Game } from "@sapi-game/main";
import { Logger } from "@sapi-game/utils";

class globalPlayer {
    public player: Player;

    get isValid() {
        return this.player.isValid;
    }

    constructor(player: Player) {
        this.player = player;
    }
}

/**
 * 服务器级玩家追踪。
 *
 * 这里只负责 onJoin / 在线玩家查询等宿主能力；游戏参与关系已经迁移到
 * Game.manager.participation，不再在这里保存 curGame。
 */
export class globalPlayerManager {
    private readonly players: Map<string, globalPlayer> = new Map();
    private readonly logger = new Logger(this.constructor.name);

    constructor() {
        world.afterEvents.worldLoad.subscribe(() => {
            system.runInterval(this.tick.bind(this));
        });
    }

    /**玩家当前是否参加了至少一个普通游戏。*/
    isPlayerAllocated(playerId: string): boolean {
        return Game.manager.participation.has(playerId);
    }

    /**让玩家退出指定游戏。*/
    releasePlayerFromGame(playerId: string, gameKey: string) {
        const game = Game.manager.getGameByKey(gameKey);
        if (game) game.playerManager.leave(playerId);
        else Game.manager.participation.leave(playerId, gameKey);
    }

    /**让玩家退出所有参与中的普通游戏。*/
    forceReleaseFromGame(playerId: string) {
        Game.manager.leavePlayerFromAll(playerId);
    }

    /**获取所有在线且当前没有参与普通游戏的玩家。*/
    getFreePlayers() {
        return [...this.players.values()]
            .filter(
                (p) =>
                    p.isValid && !Game.manager.participation.has(p.player.id)
            )
            .map((p) => p.player);
    }

    private tick() {
        const players = world.getAllPlayers();
        const onlineIds = new Set<string>();

        for (const p of players) {
            onlineIds.add(p.id);
            if (!this.players.has(p.id)) {
                Game.config.config.onJoin(p);
                this.players.set(p.id, new globalPlayer(p));
            }
        }

        for (const [id] of this.players) {
            if (!onlineIds.has(id)) this.players.delete(id);
        }
    }

    status(): string {
        const total = this.players.size;
        const participating = [...this.players.values()].filter((p) =>
            Game.manager.participation.has(p.player.id)
        ).length;
        return `在线追踪: ${total}, 参与游戏: ${participating}, 空闲: ${total - participating}`;
    }
}
