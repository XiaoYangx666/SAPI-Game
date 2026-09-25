import {
    Player,
    PlayerSoundOptions,
    RawMessage,
    TitleDisplayOptions,
} from "@minecraft/server";
import { GameError } from "../utils/GameError";
import {
    GamePlayer,
    GamePlayerConstructor,
    ValidGamePlayer,
} from "./gamePlayer";
import { GroupMembershipSignal } from "./groupMembershipSignal";

class PlayerGroupError extends GameError {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = this.constructor.name;
    }
}

/** 玩家组。保留插入顺序，并为按 ID 查询维护索引。 */
export class PlayerGroup<T extends GamePlayer = GamePlayer, TData = undefined> {
    private players: T[];
    private readonly playersById = new Map<string, T>();
    readonly changed = new GroupMembershipSignal<T>();
    readonly playerConstructor: GamePlayerConstructor<T>;
    readonly data: TData;

    /** 创建新的玩家组。 */
    constructor(playerClass: GamePlayerConstructor<T>, players?: T[]);
    constructor(
        playerClass: GamePlayerConstructor<T>,
        players: T[],
        data?: TData
    );
    constructor(
        playerClass: GamePlayerConstructor<T>,
        players?: T[],
        data?: TData
    ) {
        this.playerConstructor = playerClass;
        if (
            players !== undefined &&
            players.some((player) => !(player instanceof playerClass))
        ) {
            throw new PlayerGroupError(`players必须全为:${playerClass.name}`);
        }

        this.data = data as TData;
        this.players = players?.slice() ?? [];
        this.rebuildIndex();
    }

    /** 组中玩家数量（包含下线玩家）。 */
    get size() {
        return this.players.length;
    }

    /** 组中有效玩家数量。 */
    get validSize() {
        let count = 0;
        for (const player of this.players) {
            if (player.isValid) count++;
        }
        return count;
    }

    /** 根据 ID 查找玩家。 */
    getById(id: string): T | undefined {
        return this.playersById.get(id);
    }

    /** 是否包含指定玩家 ID。 */
    hasId(id: string): boolean {
        return this.playersById.has(id);
    }

    /** 是否包含玩家。 */
    has(player: T | Player): boolean {
        return this.hasId(player.id);
    }

    add(player: T) {
        if (!(player instanceof this.playerConstructor)) {
            throw new PlayerGroupError(
                `添加的player必须是${this.playerConstructor.name}`
            );
        }
        if (!this.hasId(player.id)) {
            this.players.push(player);
            this.playersById.set(player.id, player);
            this.changed.publish({ type: "added", player, reason: "manual" });
        }
        return this;
    }

    delete(player: T | Player, reason = "manual") {
        const indexed = this.playersById.get(player.id);
        if (!indexed) return this;

        const index = this.players.indexOf(indexed);
        if (index === -1) {
            // 理论上不应发生；自愈索引后保持幂等。
            this.rebuildIndex();
            return this;
        }

        const [removed] = this.players.splice(index, 1);
        this.playersById.delete(removed.id);

        // 兼容构造器历史上可能接收到重复 ID 的数组：删除第一项后，
        // 若仍有同 ID wrapper，则恢复到下一项，保持旧 getById 语义。
        const duplicate = this.players.find((item) => item.id === removed.id);
        if (duplicate) this.playersById.set(duplicate.id, duplicate);

        this.changed.publish({ type: "removed", player: removed, reason });
        return this;
    }

    removeWhere(func: (player: T) => boolean, reason = "predicate"): T[] {
        const removed: T[] = [];
        const retained: T[] = [];

        for (const player of this.players) {
            (func(player) ? removed : retained).push(player);
        }
        if (removed.length === 0) return removed;

        this.players = retained;
        this.rebuildIndex();
        for (const player of removed) {
            this.changed.publish({ type: "removed", player, reason });
        }
        return removed;
    }

    /** 按当前组顺序迭代玩家，不创建数组副本。 */
    [Symbol.iterator](): Iterator<T> {
        return this.players[Symbol.iterator]();
    }

    /** 获取组中全部玩家的拷贝。 */
    getAll(): T[] {
        return this.players.slice();
    }

    /** 获取所有有效原生 Player 对象。 */
    getAllPlayers(): Player[] {
        const result: Player[] = [];
        for (const gamePlayer of this.players) {
            const player = gamePlayer.player;
            if (player) result.push(player);
        }
        return result;
    }

    /** 对所有有效玩家执行操作。 */
    forEach(func: (player: ValidGamePlayer<T>) => void) {
        try {
            for (const player of this.players) {
                if (player.isValid) func(player as ValidGamePlayer<T>);
            }
        } catch (err) {
            console.error(err, err instanceof Error ? err.stack : "");
        }
    }

    runCommand(commandString: string) {
        this.forEach((player) => player.runCommand(commandString));
        return this;
    }

    sendMessage(mes: string | RawMessage | (string | RawMessage)[]) {
        this.forEach((player) => player.sendMessage(mes));
        return this;
    }

    title(
        title: string | RawMessage | (string | RawMessage)[],
        subtitle?: string | RawMessage | (string | RawMessage)[],
        options?: TitleDisplayOptions
    ) {
        this.forEach((player) => player.title(title, subtitle, options));
        return this;
    }

    actionbar(text: (RawMessage | string)[] | RawMessage | string) {
        this.forEach((player) => player.actionbar(text));
        return this;
    }

    playSound(soundId: string, soundOptions?: PlayerSoundOptions) {
        this.forEach((player) => player.player.playSound(soundId, soundOptions));
        return this;
    }

    map<U>(func: (player: T) => U): U[] {
        return this.players.map(func);
    }

    /** 获取随机有效玩家，不构造临时有效玩家数组。 */
    random(): T | undefined {
        let selected: T | undefined;
        let validCount = 0;
        for (const player of this.players) {
            if (!player.isValid) continue;
            validCount++;
            if (Math.random() < 1 / validCount) selected = player;
        }
        return selected;
    }

    filter(func: (player: T) => boolean): T[] {
        return this.players.filter(func);
    }

    /** 清空组。 */
    clear() {
        if (this.players.length === 0) return this;
        const previous = this.players;
        this.players = [];
        this.playersById.clear();

        for (const player of previous) {
            this.changed.publish({
                type: "removed",
                player,
                reason: "group-clear",
            });
        }
        return this;
    }

    /** 清除无效玩家。 */
    clearInvalid() {
        this.removeWhere((player) => !player.isValid, "invalid-purge");
        return this;
    }

    /** 克隆玩家组；成员与 data 保持同一引用语义。 */
    clone(): PlayerGroup<T, TData> {
        return new PlayerGroup<T, TData>(
            this.playerConstructor,
            this.players,
            this.data
        );
    }

    find(predicate: (player: T) => boolean): T | undefined {
        return this.players.find(predicate);
    }

    findIndex(predicate: (player: T) => boolean): number {
        return this.players.findIndex(predicate);
    }

    private rebuildIndex() {
        this.playersById.clear();
        // 保留旧 getById 的“首个同 ID 玩家优先”语义。
        for (const player of this.players) {
            if (!this.playersById.has(player.id)) {
                this.playersById.set(player.id, player);
            }
        }
    }
}
