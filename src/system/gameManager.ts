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

export interface DisposeAllOptions {
    /**是否连同常驻游戏一起释放。Script reload / 测试隔离时应设为 true。*/
    includeDaemon?: boolean;
}

export class GameManager implements GameEngineOwner {
    private games: Map<string, GameEngine<any, any>> = new Map();
    private readonly logger = new Logger(this.constructor.name);
    public readonly participation: ParticipationManager;

    constructor(
        participationPolicy: ParticipationPolicy = new ExclusiveParticipationPolicy()
    ) {
        this.participation = new ParticipationManager(participationPolicy);
    }

    startGame<T extends GameEngine<any, any, any>>(
        game: ManagedGameConstructor<T>,
        config?: T extends GameEngine<any, any, infer O> ? O : unknown,
        tag?: string
    ): T {
        const key = this.buildKey(game, tag);
        if (this.games.has(key)) {
            throw new GameManagerError(`已存在游戏: ${key}`);
        }

        const gameInstance = new game(this, key, config);
        const internal = gameInstance as any as GameEngineInternal;

        // 先注册再 onStart：onStart 内部 stopGame()/getGameByKey() 都能看到自己。
        this.games.set(key, gameInstance);
        this.logger.log(`startingGame: ${key}`);
        try {
            internal._onStart();
            if (gameInstance.lifecycle !== "disposed") {
                this.logger.log(`startedGame: ${key}`);
            }
            return gameInstance;
        } catch (startError) {
            const errors: unknown[] = [startError];
            try {
                internal._onDispose();
            } catch (disposeError) {
                errors.push(disposeError);
            } finally {
                if (this.games.get(key) === gameInstance) {
                    this.games.delete(key);
                }
            }

            if (errors.length > 1) {
                throw new AggregateError(
                    errors,
                    `游戏 ${key} 启动失败且回滚异常`
                );
            }
            throw startError;
        }
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
        const gameInstance = this.games.get(key);
        if (!gameInstance) {
            this.logger.error("StopGame失败，游戏不存在:" + key);
            return;
        }

        const internal = gameInstance as any as GameEngineInternal;
        const errors: unknown[] = [];
        try {
            internal._onStop();
        } catch (err) {
            errors.push(err);
        }
        try {
            internal._onDispose();
        } catch (err) {
            errors.push(err);
        } finally {
            if (this.games.get(key) === gameInstance) {
                this.games.delete(key);
            }
            this.logger.log(`stoppedGame: ${key}`);
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, `游戏 ${key} 停止时发生异常`);
        }
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
        const errors: unknown[] = [];
        for (const [key, game] of [...this.games]) {
            if (game.isDaemon) continue;
            try {
                this.stopGameByKey(key);
            } catch (err) {
                errors.push(err);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, "停止全部游戏时发生异常");
        }
    }

    /**
     * 静默释放游戏实例，不调用 onStop。
     * 默认保持常驻游戏；Script reload、测试隔离等需要整个脚本运行时销毁的场景
     * 可以通过 includeDaemon 显式连同常驻游戏一起释放。
     */
    disposeAll(options: DisposeAllOptions = {}) {
        const errors: unknown[] = [];
        for (const [key, game] of [...this.games]) {
            if (game.isDaemon && !options.includeDaemon) continue;
            try {
                (game as any as GameEngineInternal)._onDispose();
            } catch (err) {
                errors.push(err);
            } finally {
                this.games.delete(key);
                this.logger.log(`disposedGame: ${key}`);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, "释放全部游戏时发生异常");
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
