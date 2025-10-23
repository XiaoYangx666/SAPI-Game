import { Player, system, world } from "@minecraft/server";
import { Game } from "@sapi-game/main";
import { Logger } from "@sapi-game/utils";

class globalPlayer {
    public player: Player;

    get isValid() {
        return this.player.isValid;
    }

    /**当前分配游戏的key */
    curGame?: string;

    constructor(player: Player) {
        this.player = player;
    }
}

export class globalPlayerManager {
    private readonly players: Map<string, globalPlayer> = new Map();
    private readonly logger = new Logger(this.constructor.name);

    constructor() {
        world.afterEvents.worldLoad.subscribe(() => {
            system.runInterval(this.tick.bind(this));
        });
    }

    /** 玩家是否已被分配（不修改状态） */
    isPlayerAllocated(playerId: string): boolean {
        const player = this.players.get(playerId);
        return !!(player?.curGame && Game.manager.getGameByKey(player.curGame));
    }

    /**请求分配玩家
     * 系统调用，别乱用
     * @returns boolean 是否成功分配
     */
    allocatePlayerToGame(playerId: string, gameKey: string): boolean {
        this.logger.debug(`allocate player ${playerId} for ${gameKey}`);
        const player = this.players.get(playerId);
        this.logger.debug(
            `allocate player ${player?.player.name ?? playerId} for ${gameKey}`
        );
        if (player?.isValid && !this.isPlayerAllocated(player.player.id)) {
            player.curGame = gameKey;
            return true;
        }
        return false;
    }

    /**将玩家从指定游戏释放
     * 系统调用，别乱用
     */
    releaseAllPlayerFromGame(gameKey: string) {
        this.players.forEach((p) => {
            if (p.curGame == gameKey) p.curGame == undefined;
        });
    }

    /**将玩家从指定游戏释放 */
    releasePlayerFromGame(playerId: string, gameKey: string) {
        const player = this.players.get(playerId);
        if (player && player.curGame == gameKey) {
            player.curGame = undefined;
        }
    }

    /**强制释放玩家 */
    forceReleaseFromGame(playerId: string) {
        const player = this.players.get(playerId);
        if (player && player.curGame) {
            const game = Game.manager.getGameByKey(player.curGame);
            game?.playerManager.deactivate(player.player);
            player.curGame = undefined;
        }
    }

    /**获取所有在线且没有分配游戏的玩家 */
    getFreePlayers() {
        return [...this.players.values()]
            .filter((p) => p.curGame == undefined && p.isValid)
            .map((p) => p.player);
    }

    private tick() {
        const players = world.getAllPlayers();
        const onlineIds = new Set<string>();

        // 添加新玩家
        for (const p of players) {
            if (p == undefined) continue;
            onlineIds.add(p.id);
            if (!this.players.has(p.id)) {
                Game.config.config.onJoin(p); //之前没有，说明是新加入的
                this.players.set(p.id, new globalPlayer(p));
            }
        }

        for (const [id, gp] of this.players) {
            // 下线且无游戏 → 清理
            if (!onlineIds.has(id) && gp.curGame === undefined) {
                this.players.delete(id);
            }
            // 同时清理无效分配
            else if (gp.curGame && !Game.manager.getGameByKey(gp.curGame)) {
                gp.curGame = undefined;
            }
        }
    }

    status(): string {
        const total = this.players.size;
        let inGame = 0;
        let free = 0;
        let offline = 0;

        for (const gp of this.players.values()) {
            if (!gp.isValid) {
                offline++;
            } else if (gp.curGame) {
                inGame++;
            } else {
                free++;
            }
        }

        return `已追踪: ${total}, 游戏中: ${inGame}, 空闲: ${free}, 离线: ${offline}`;
    }
}
