import { GamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";

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

    getAllPlayers(): T[] {
        const all: Set<T> = new Set();
        this.groups.forEach((g) => g.getAll().forEach((p) => all.add(p)));
        return [...all.values()];
    }

    forEach(func: (p: T) => void) {
        this.getAllPlayers().forEach(func);
        return this;
    }

    runCommand(command: string) {
        this.forEach((p) => p.player.runCommand(command));
        return this;
    }

    filter(predicate: (p: T) => boolean): PlayerGroupSet<T> {
        const newGroups = this.groups.map((g) => g.filter(predicate)).filter((g) => g.size > 0);
        return new PlayerGroupSet(newGroups);
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
        return this.getAllPlayers().filter((p) => p.player.isValid).length;
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
