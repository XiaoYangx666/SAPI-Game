import { Player, RawMessage, TitleDisplayOptions } from "@minecraft/server";
import { GameError } from "../utils/GameError";
import { GamePlayer, GamePlayerConstructor, ValidGamePlayer } from "./gamePlayer";

class PlayerGroupError extends GameError {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = this.constructor.name;
    }
}

/**玩家组 */
export class PlayerGroup<T extends GamePlayer = GamePlayer> {
    private players: T[];
    readonly playerConstructor: GamePlayerConstructor<T>;

    constructor(playerClass: GamePlayerConstructor<T>, players?: T[]) {
        this.playerConstructor = playerClass;
        if (players != undefined && players.some((p) => !(p instanceof playerClass))) {
            throw new PlayerGroupError(`players必须全为:${playerClass.name}`);
        }
        this.players = players ?? [];
    }

    /** 组中玩家数量(包含下线玩家) */
    get size() {
        return this.players.length;
    }

    /** 组中玩家数量(不包含下线玩家) */
    get validSize() {
        return this.players.filter((p) => p.isValid).length;
    }

    /** 根据 id 查找玩家 */
    getById(id: string) {
        return this.players.find((p) => p.id == id);
    }

    /** 是否包含玩家 */
    has(player: T | Player) {
        return this.players.findIndex((p) => p.id == player.id) != -1;
    }

    add(player: T) {
        if (!(player instanceof this.playerConstructor)) {
            throw new PlayerGroupError(`添加的player必须是${this.playerConstructor.name}`);
        }
        if (!this.has(player)) {
            this.players.push(player);
        }
        return this;
    }

    delete(player: T | Player) {
        const index = this.players.findIndex((p) => p.id == player.id);
        if (index != -1) {
            this.players.splice(index, 1);
        }
        return this;
    }

    removeWhere(func: (player: T) => boolean): T[] {
        const removed: T[] = [];
        this.players = this.players.filter((p) => {
            if (func(p)) {
                removed.push(p);
                return false;
            }
            return true;
        });
        return removed;
    }

    /**获取组中全部玩家的拷贝 */
    getAll(): readonly T[] {
        return this.players.slice();
    }

    /** 获取所有原生 Player 对象 */
    getAllPlayers(): Player[] {
        return this.players.map((p) => p.player).filter((p) => p != undefined);
    }

    /**对所有有效玩家执行操作 */
    forEach(func: (p: ValidGamePlayer<T>) => void) {
        try {
            this.players.filter((p) => p.isValid).forEach(func as any);
        } catch (err) {
            console.error(err, err instanceof Error ? err.stack : "");
        }
    }

    /**组内所有玩家执行命令 */
    runCommand(commandString: string) {
        this.forEach((p) => p.runCommand(commandString));
    }

    /**向组内所有玩家发送消息 */
    sendMessage(mes: string | RawMessage | (string | RawMessage)[]) {
        this.forEach((p) => p.sendMessage(mes));
    }

    /**向组内所有玩家显示标题 */
    title(
        title: string | RawMessage | (string | RawMessage)[],
        subtitle?: string | RawMessage | (string | RawMessage)[],
        options?: TitleDisplayOptions
    ) {
        this.forEach((p) => p.title(title, subtitle, options));
        return this;
    }

    map<U>(func: (p: T) => U): U[] {
        return this.players.map(func);
    }

    /**获取随机在线玩家 */
    random() {
        const validPlayers = this.players.filter((p) => p.isValid);
        if (validPlayers.length === 0) return undefined;

        const index = Math.floor(Math.random() * validPlayers.length);
        return validPlayers[index];
    }

    filter(func: (p: T) => boolean): T[] {
        return this.players.filter(func);
    }

    /** 清空组 */
    clear() {
        this.players = [];
        return this;
    }

    /**清除无效玩家 */
    clearInvalid() {
        this.players = this.players.filter((p) => p.isValid);
        return this;
    }

    /** 克隆一份新的 PlayerGroup */
    clone(): PlayerGroup<T> {
        return new PlayerGroup(this.playerConstructor, this.players);
    }

    /** 查找符合条件的玩家 */
    find(predicate: (p: T) => boolean): T | undefined {
        return this.players.find(predicate);
    }

    findIndex(predicate: (p: T) => boolean): number {
        return this.players.findIndex(predicate);
    }
}
