import { GameError } from "../utils/GameError";
import { GamePlayer, GamePlayerConstructor } from "./gamePlayer";

class PlayerGroupError extends GameError {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = this.constructor.name;
    }
}

/**玩家组 */
export class PlayerGroup<T extends GamePlayer> {
    private players: T[];
    private playerConstructor: GamePlayerConstructor<T>;
    constructor(playerClass: GamePlayerConstructor<T>, players?: T[]) {
        this.playerConstructor = playerClass;
        if (
            players != undefined &&
            players.some((p) => !(p instanceof playerClass))
        ) {
            throw new PlayerGroupError(`players必须全为:${playerClass.name}`);
        }
        this.players = players ?? [];
    }

    getById(id: string) {
        return this.players.find((p) => p.id == id);
    }

    has(player: T) {
        return this.players.findIndex((p) => p.id == player.id) != -1;
    }

    add(player: T) {
        if (!(player instanceof this.playerConstructor)) {
            throw new PlayerGroupError(
                `添加的player必须是${this.playerConstructor.name}`
            );
        }
        if (!this.has(player)) {
            this.players.push(player);
        }
    }

    delete(player: T) {
        const index = this.players.findIndex((p) => p.id == player.id);
        if (index != -1) {
            this.players.splice(index, 1);
        }
    }

    /**获取组中全部玩家的拷贝 */
    getAll() {
        return this.players.slice();
    }

    /**对每个玩家执行操作 */
    forEach(func: (p: T) => void) {
        this.players.forEach(func);
    }

    clear() {
        this.players = [];
    }

    /**清除无效玩家 */
    clearInvalid() {
        this.players = this.players.filter((p) => p.player.isValid);
    }
}
