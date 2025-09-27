import { RawMessage, TitleDisplayOptions } from "@minecraft/server";
import { GamePlayer, ValidGamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";

/**玩家组集合 */
export class PlayerGroupSet<T extends GamePlayer = GamePlayer> {
    private groups: PlayerGroup<T>[] = [];

    constructor(groups?: PlayerGroup<T>[]) {
        if (groups) this.groups = groups.slice();
    }

    addGroup(group: PlayerGroup<T>) {
        if (!(group instanceof PlayerGroup)) throw new Error("只能添加 PlayerGroup 实例");
        this.groups.push(group);
        return this;
    }

    removeGroup(group: PlayerGroup<T>) {
        const index = this.groups.indexOf(group);
        if (index !== -1) this.groups.splice(index, 1);
        return this;
    }

    getGroups(): readonly PlayerGroup<T>[] {
        return this.groups.slice();
    }

    /**获取所有玩家，包括invalid的 */
    getAllPlayers(): T[] {
        const all: Set<T> = new Set();
        this.groups.forEach((g) => g.getAll().forEach((p) => all.add(p)));
        return [...all.values()];
    }

    /**获取所有有效玩家 */
    getAllValidPlayers() {
        return this.getAllPlayers().filter((p) => p.isValid);
    }

    /**对所有有效玩家执行操作*/
    forEach(func: (p: ValidGamePlayer<T>) => void) {
        this.getGroups().forEach((g) => g.forEach(func));
        return this;
    }

    forEachGroup(func: (g: PlayerGroup<T>) => void) {
        this.groups.forEach(func);
    }

    /**让所有玩家执行命令 */
    runCommand(command: string) {
        this.forEach((p) => p.runCommand(command));
        return this;
    }

    runCommands(commands: string[]) {
        commands.forEach((c) => this.runCommand(c));
    }

    /**向所有玩家发送消息 */
    sendMessage(mes: string | RawMessage | (string | RawMessage)[]) {
        this.forEach((p) => p.sendMessage(mes));
        return this;
    }

    /**对所有玩家显示标题 */
    title(
        title: string | RawMessage | (string | RawMessage)[],
        subtitle?: string | RawMessage | (string | RawMessage)[],
        options?: TitleDisplayOptions
    ) {
        this.forEach((p) => p.title(title, subtitle, options));
        return this;
    }

    filter(predicate: (p: T) => boolean): T[] {
        return this.groups.map((g) => g.filter(predicate)).flat();
    }

    clear() {
        this.groups = [];
        return this;
    }

    clearInvalid() {
        this.groups.forEach((g) => g.clearInvalid());
    }

    clone(): PlayerGroupSet<T> {
        return new PlayerGroupSet(this.groups.map((g) => g.clone()));
    }

    get size() {
        return this.getAllPlayers().length;
    }

    get validSize() {
        return this.getAllPlayers().filter((p) => p.isValid).length;
    }

    /** 根据玩家 ID 查找玩家及其所在组 */
    findById(id: string): { player: T; group: PlayerGroup<T> } | undefined {
        for (const group of this.groups) {
            const player = group.getById(id);
            if (player) return { player, group };
        }
        return undefined;
    }
}
