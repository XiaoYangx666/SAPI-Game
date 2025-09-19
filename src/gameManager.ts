import {
    CommandPermissionLevel,
    CustomCommandOrigin,
    CustomCommandParamType,
    Player,
    system,
} from "@minecraft/server";
import { GameEngine } from "./gameEngine";
import { GameManagerError } from "./utils/GameError";
import { classConstructor } from "./utils/interfaces";
import { Logger } from "./utils/logger";
import { regGameCommand } from "./gameCommand";
import { SAPIGameConfig } from "./config";

export class GameManager {
    private games: Map<string, GameEngine<any, any>> = new Map();
    private backGames: Map<string, GameEngine<any, any>> = new Map();
    private logger = new Logger(this.constructor.name);

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

    startGame<O, T extends classConstructor<GameEngine<any, any, O>>>(
        game: T,
        config?: O,
        tag?: string
    ) {
        const key = this.buildKey(game, tag);
        const gameInstance = new game(config);
        this.addGame(this.games, key, gameInstance);
    }

    startBackGame<T extends GameEngine<any, any>>(game: T, tag?: string) {
        const key = this.buildKey(game.constructor, tag);
        this.addGame(this.backGames, key, game);
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
        const gameInstance = this.games.get(key);
        if (gameInstance) {
            gameInstance.onStop();
            gameInstance.onDispose();
            this.games.delete(key);
            this.logger.log(`stopedGame: ${key}`);
        } else {
            this.logger.error("StopGame失败，游戏不存在:" + game.name);
        }
    }

    /**停止所有普通游戏 */
    stopAll() {
        for (const [key, game] of this.games) {
            game.onStop();
            game.onDispose();
            this.logger.log(`stopedGame: ${key}`);
        }
        this.games.clear();
    }

    /**静默停止所有普通游戏 */
    end() {
        for (const [key, game] of this.games) {
            game.onDispose();
            this.logger.log(`endedGame: ${key}`);
        }
        SAPIGameConfig.config.onEnd();
        this.games.clear();
    }

    status(player?: Player) {
        const lines: string[] = [];

        // 顶部标题
        lines.push("§6========== 游戏状态 ==========");
        lines.push(`§e总游戏数: §a${this.games.size}`);
        lines.push(`§e常驻游戏数: §a${this.backGames.size}`);
        lines.push("§6================================");
        lines.push("");

        // 常驻游戏
        if (this.backGames.size) {
            lines.push("§b—— 常驻游戏 ——");
            for (const [key, g] of this.backGames) {
                lines.push(`§a● ${key} §7| §f${g.stats()}`);
            }
            lines.push("");
        }

        // 普通游戏
        if (this.games.size) {
            lines.push("§d—— 普通游戏 ——");
            for (const [key, g] of this.games) {
                lines.push(`§a● ${key} §7|\ §f${g.stats()}`);
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
