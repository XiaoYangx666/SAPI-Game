import { Player } from "@minecraft/server";
import {
    GameEngine,
    GameEngineInternal,
    GameEngineOwner,
} from "../gameEngine";
import {
    ExclusiveParticipationPolicy,
    ParticipationManager,
    ParticipationPolicy,
} from "../participation/participationManager";
import { GameManagerError } from "../utils/GameError";
import { classConstructor } from "../utils/interfaces";
import { Logger } from "../utils/logger";

export type ManagedGameConstructor<T extends GameEngine<any, any, any>> = new (
    owner: GameEngineOwner,
    key: string,
    config?: T extends GameEngine<any, any, infer O> ? O : unknown
) => T;

export class GameManager implements GameEngineOwner {
    private games: Map<string, GameEngine<any, any>> = new Map();
    private readonly logger = new Logger(this.constructor.name);
    public readonly participation: ParticipationManager;

    constructor(
        participationPolicy: ParticipationPolicy = new ExclusiveParticipationPolicy()
    ) {
        this.participation = new ParticipationManager(participationPolicy);
    }

    private addGame(
        map: Map<string, GameEngine<any, any>>,
        key: string,
        gameInstance: GameEngine<any, any>
    ) {
        if (map.has(key)) {
            throw new GameManagerError(`已存在游戏: ${key}`);
        }
        this.logger.log(`startedGame: ${key}`);
        (gameInstance as any as GameEngineInternal).onStart();
        map.set(key, gameInstance);
    }

    startGame<T extends GameEngine<any, any, any>>(
        game: ManagedGameConstructor<T>,
        config?: T extends GameEngine<any, any, infer O> ? O : unknown,
        tag?: string
    ): T {
        const key = this.buildKey(game, tag);
        const gameInstance = new game(this, key, config);
        this.addGame(this.games, key, gameInstance);
        return gameInstance;
    }

    hasGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ) {
        return this.games.has(this.buildKey(game, tag));
    }

    getGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ): T | undefined {
        return this.games.get(this.buildKey(game, tag)) as T | undefined;
    }

    getGameByKey(key: string) {
        return this.games.get(key);
    }

    stopGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ) {
        this.stopGameByKey(this.buildKey(game, tag));
    }

    stopGameByKey(key: string) {
        const gameInstance = this.games.get(key) as any as
            | GameEngineInternal
            | undefined;
        if (!gameInstance) {
            this.logger.error("StopGame失败，游戏不存在:" + key);
            return;
        }

        gameInstance.onStop();
        gameInstance.onDispose();
        this.games.delete(key);
        this.logger.log(`stopedGame: ${key}`);
    }

    /**让玩家退出其当前参加的所有普通游戏。*/
    leavePlayerFromAll(playerId: string) {
        const gameKeys = [...this.participation.getGames(playerId)];
        for (const key of gameKeys) {
            const game = this.games.get(key);
            if (game) game.playerManager.leave(playerId);
            else this.participation.leave(playerId, key);
        }
    }

    stopAll() {
        for (const [key, game] of this.games) {
            if (game.isDaemon) continue;
            const instance = game as any as GameEngineInternal;
            instance.onStop();
            instance.onDispose();
            this.logger.log(`stopedGame: ${key}`);
            this.games.delete(key);
        }
    }

    /**
     * 静默释放所有普通游戏实例，不调用 onStop。
     * 宿主在服务器关闭、地图重置等场景中可自行决定是否使用。
     */
    disposeAll() {
        for (const [key, game] of this.games) {
            if (game.isDaemon) continue;
            (game as any as GameEngineInternal).onDispose();
            this.logger.log(`disposedGame: ${key}`);
            this.games.delete(key);
        }
    }

    status(player?: Player, detail?: boolean) {
        const lines: string[] = [];
        lines.push("§6========== 游戏状态 ==========");
        lines.push(`§e总游戏数: §a${this.games.size}`);
        lines.push(
            `§e参与关系: §a${this.participation.membershipCount} §7(玩家 ${this.participation.playerCount})`
        );
        lines.push("§6================================");
        lines.push("");

        if (this.games.size) {
            lines.push("§d—— 常驻游戏 ——");
            for (const [key, g] of this.games) {
                if (g.isDaemon) {
                    lines.push(`§a● ${key} §7|\\ §f${g.stats(detail)}`);
                }
            }
            lines.push("");
        }

        if (this.games.size) {
            lines.push("§d—— 普通游戏 ——");
            for (const [key, g] of this.games) {
                if (!g.isDaemon) {
                    lines.push(`§a● ${key} §7|\\ §f${g.stats(detail)}`);
                }
            }
            lines.push("");
        }

        const message = lines.join("\n");
        if (player) player.sendMessage(message);
        else console.log(message);
    }

    getGameType(game: Function) {
        const explicitType = (game as Function & { gameType?: unknown }).gameType;
        if (explicitType === undefined) return game.name;
        if (typeof explicitType !== "string" || !explicitType.trim()) {
            throw new GameManagerError("gameType 必须是非空字符串");
        }

        const gameType = explicitType.trim();
        if (gameType.includes(":")) {
            throw new GameManagerError("gameType 不能包含 ':'");
        }
        return gameType;
    }

    buildKey(game: Function, tag?: string) {
        return `${this.getGameType(game)}:${tag ?? 0}`;
    }
}
