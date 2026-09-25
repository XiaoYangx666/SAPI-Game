import { RawMessage, TitleDisplayOptions } from "@minecraft/server";
import { GamePlayer, ValidGamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";
import { ObservableGroupSignal } from "./groupMembershipSignal";
import type { Subscription } from "../gameEvent/subscription";

/** 玩家组集合。 */
export class PlayerGroupSet<T extends GamePlayer = GamePlayer, TData = any> {
    private groups: PlayerGroup<T, TData>[] = [];
    private readonly groupSubscriptions = new Map<
        PlayerGroup<T, TData>,
        Subscription
    >();

    readonly changed = new ObservableGroupSignal<{
        readonly type: "added" | "removed" | "scope";
        readonly reason: string;
        readonly playerId?: string;
    }>();

    constructor(groups?: PlayerGroup<T, TData>[]) {
        for (const group of groups ?? []) this.addGroup(group);
    }

    private attachGroup(group: PlayerGroup<T, TData>): void {
        if (this.groupSubscriptions.has(group)) return;
        const subscription = group.changed.subscribe((event) =>
            this.changed.publish({
                type: event.type,
                reason: event.reason,
                playerId: event.player.id,
            })
        );
        this.groupSubscriptions.set(group, subscription);
    }

    private detachGroup(group: PlayerGroup<T, TData>): void {
        const subscription = this.groupSubscriptions.get(group);
        if (!subscription) return;
        subscription.unsubscribe();
        this.groupSubscriptions.delete(group);
    }

    addGroup(group: PlayerGroup<T, TData>) {
        if (!(group instanceof PlayerGroup)) {
            throw new Error("只能添加 PlayerGroup 实例");
        }
        if (this.groups.includes(group)) return this;

        this.groups.push(group);
        this.attachGroup(group);
        this.changed.publish({ type: "scope", reason: "group-added" });
        return this;
    }

    removeGroup(group: PlayerGroup<T, TData>) {
        const index = this.groups.indexOf(group);
        if (index === -1) return this;

        this.groups.splice(index, 1);
        this.detachGroup(group);
        this.changed.publish({ type: "scope", reason: "group-removed" });
        return this;
    }

    getGroups(): readonly PlayerGroup<T, TData>[] {
        return this.groups.slice();
    }

    /** 获取所有玩家，按 playerId 去重并保留首个组中的顺序。 */
    getAllPlayers(): T[] {
        const players = new Map<string, T>();
        for (const group of this.groups) {
            for (const player of group) {
                if (!players.has(player.id)) players.set(player.id, player);
            }
        }
        return [...players.values()];
    }

    /** 获取所有有效玩家。 */
    getAllValidPlayers(): ValidGamePlayer<T>[] {
        return this.getAllPlayers().filter(
            (player) => player.isValid
        ) as ValidGamePlayer<T>[];
    }

    /** 对所有有效玩家执行一次；即使玩家意外存在于多个组中也不会重复调用。 */
    forEach(func: (player: ValidGamePlayer<T>) => void) {
        const seen = new Set<string>();
        for (const group of this.groups) {
            group.forEach((player) => {
                if (seen.has(player.id)) return;
                seen.add(player.id);
                func(player);
            });
        }
        return this;
    }

    forEachGroup(func: (group: PlayerGroup<T, TData>) => void) {
        this.groups.forEach(func);
        return this;
    }

    runCommand(command: string) {
        this.forEach((player) => player.runCommand(command));
        return this;
    }

    runCommands(commands: readonly string[]) {
        for (const command of commands) this.runCommand(command);
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

    filter(predicate: (player: T) => boolean): T[] {
        return this.getAllPlayers().filter(predicate);
    }

    /** 是否存在至少一个满足条件的玩家；命中后立即返回，不构造玩家数组。 */
    some(predicate: (player: T) => boolean): boolean {
        const seen = new Set<string>();
        for (const group of this.groups) {
            for (const player of group) {
                if (seen.has(player.id)) continue;
                seen.add(player.id);
                if (predicate(player)) return true;
            }
        }
        return false;
    }

    /** Remove groups from this collection; does not clear each group's members. */
    clear() {
        if (this.groups.length === 0) return this;

        this.groups = [];
        for (const group of [...this.groupSubscriptions.keys()]) {
            this.detachGroup(group);
        }
        this.changed.publish({ type: "scope", reason: "groups-cleared" });
        return this;
    }

    clearInvalid() {
        for (const group of this.groups) group.clearInvalid();
        return this;
    }

    clone(): PlayerGroupSet<T, TData> {
        return new PlayerGroupSet<T, TData>(
            this.groups.map((group) => group.clone())
        );
    }

    get size() {
        return this.getAllPlayers().length;
    }

    get validSize() {
        let count = 0;
        const seen = new Set<string>();
        for (const group of this.groups) {
            for (const player of group) {
                if (seen.has(player.id)) continue;
                seen.add(player.id);
                if (player.isValid) count++;
            }
        }
        return count;
    }

    /** 根据玩家 ID 查找其首个所属组。 */
    findGroupById(id: string): PlayerGroup<T, TData> | undefined {
        for (const group of this.groups) {
            if (group.hasId(id)) return group;
        }
        return undefined;
    }

    /** 根据玩家 ID 查找玩家及其首个所属组。 */
    findById(
        id: string
    ): { player: T; group: PlayerGroup<T, TData> } | undefined {
        const group = this.findGroupById(id);
        if (!group) return undefined;
        const player = group.getById(id);
        return player ? { player, group } : undefined;
    }

    /** 判断两个玩家的首个所属组是否相同；不创建临时查找对象。 */
    areInSameGroup(firstId: string, secondId: string): boolean {
        const firstGroup = this.findGroupById(firstId);
        return (
            firstGroup !== undefined &&
            this.findGroupById(secondId) === firstGroup
        );
    }

    /** 判断玩家 ID 是否存在于集合。 */
    has(id: string) {
        return this.findGroupById(id) !== undefined;
    }
}
