import { GameEngine } from "./gameEngine";
import { GameManagerError } from "./utils/GameError";
import { classConstructor } from "./utils/interfaces";
import { Logger } from "./utils/logger";

export class GameManager {
    games: Map<string, GameEngine<any, any>> = new Map();
    logger = new Logger(this.constructor.name);

    startGame<T extends GameEngine<any, any>>(game: T, tag?: string) {
        const key = this.buildKey(game.constructor, tag);
        if (this.games.has(key)) {
            throw new GameManagerError(`已存在游戏: ${key}`);
        }
        this.logger.log(`startedGame: ${key}`);
        game.onInit();
        this.games.set(key, game);
    }

    stopGame<T extends GameEngine<any, any>>(
        game: classConstructor<T>,
        tag?: string
    ) {
        const key = this.buildKey(game, tag);
        const gameInstance = this.games.get(key);
        if (gameInstance) {
            gameInstance.onDispose();
            this.games.delete(key);
            this.logger.log(`stopedGame: ${key}`);
        }
    }

    buildKey(game: Function, tag?: string) {
        return `${game.name}:${tag ?? 0}`;
    }
}
