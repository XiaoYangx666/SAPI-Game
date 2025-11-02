import { Player } from "@minecraft/server";
import { SAPIGameConfig } from "../config";
import { GameEngine } from "../gameEngine";
import { GameManagerError } from "../utils/GameError";
import { classConstructor } from "../utils/interfaces";
import { Logger } from "../utils/logger";
import { Game } from "@sapi-game/main";

export class GameManager {
    private games: Map<string, GameEngine<any, any>> = new Map();
    private readonly logger = new Logger(this.constructor.name);

    private addGame(
        map: Map<string, GameEngine<any, any>>,
        key: string,
        gameInstance: GameEngine<any, any>
    ) {
        if (map.has(key)) {
            throw new GameManagerError(`已存在游戏: ${key}`);
        }
        this.logger.log(`startedGame: ${key}`);
        gameInstance.onStart();
        map.set(key, gameInstance);
    }

    /**
     * 启动指定游戏
     * @throws GameManagerError 当游戏已存在时
     */
    startGame<T extends GameEngine<any, any, any>>(
        game: classConstructor<T>,
        config?: T extends GameEngine<any, any, infer P> ? P : unknown,
        tag?: string
    ) {
        const key = this.buildKey(game, tag);
        const gameInstance = new game(key, config);
        this.addGame(this.games, key, gameInstance);
    }

    /**获取指定tag游戏是否已存在 */
    hasGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ) {
        const key = this.buildKey(game, tag);
        const gameInstance = this.games.get(key);
        return gameInstance != undefined;
    }

    /**获取game */
    getGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ): T | undefined {
        return this.games.get(this.buildKey(game, tag)) as T | undefined;
    }

    getGameByKey(key: string) {
        const game = this.games.get(key);
        return game;
    }

    stopGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ) {
        const key = this.buildKey(game, tag);
        this.stopGameByKey(key);
    }

    stopGameByKey(key: string) {
        const gameInstance = this.games.get(key);
        if (gameInstance) {
            gameInstance.onStop();
            gameInstance.onDispose();
            this.games.delete(key);
            this.logger.log(`stopedGame: ${key}`);
        } else {
            this.logger.error("StopGame失败，游戏不存在:" + key);
        }
    }

    /**停止所有普通游戏 */
    stopAll() {
        for (const [key, game] of this.games) {
            if (game.isDaemon) continue;
            game.onStop();
            game.onDispose();
            this.logger.log(`stopedGame: ${key}`);
            this.games.delete(key);
        }
    }

    /**静默停止所有普通游戏 */
    end() {
        for (const [key, game] of this.games) {
            if (game.isDaemon) continue;
            game.onDispose();
            this.logger.log(`endedGame: ${key}`);
            this.games.delete(key);
        }
        SAPIGameConfig.config.onEnd();
    }

    status(player?: Player, detail?: boolean) {
        const lines: string[] = [];

        // 顶部标题
        lines.push("§6========== 游戏状态 ==========");
        lines.push(`§e总游戏数: §a${this.games.size}`);
        lines.push("§6================================");
        lines.push("");

        lines.push("玩家状态");
        lines.push(Game.playerManager.status());

        lines.push("");

        // 普通游戏
        if (this.games.size) {
            lines.push("§d—— 普通游戏 ——");
            for (const [key, g] of this.games) {
                lines.push(`§a● ${key} §7|\ §f${g.stats(detail)}`);
            }
            lines.push("");
        }

        // 汇总输出
        const message = lines.join("\n");

        if (player) {
            player.sendMessage(message);
        } else {
            console.log(message);
        }
    }

    buildKey(game: Function, tag?: string) {
        return `${game.name}:${tag ?? 0}`;
    }
}
