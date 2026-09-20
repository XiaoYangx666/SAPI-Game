import { RawMessage, TitleDisplayOptions } from "@minecraft/server";
import { GamePlayer, ValidGamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";
import { ObservableGroupSignal } from "./groupMembershipSignal";
import type { Subscription } from "../gameEvent/subscription";

/**玩家组集合 */
export class PlayerGroupSet<T extends GamePlayer = GamePlayer, TData = any> {
    private groups: PlayerGroup<T, TData>[] = [];
    private readonly groupSubscriptions = new Map<PlayerGroup<T, TData>, Subscription>();
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
        const subscription = group.changed.subscribe((event) => this.changed.publish({
            type: event.type,
            reason: event.reason,
            playerId: event.player.id,
        }));
        this.groupSubscriptions.set(group, subscription);
    }

    private detachGroup(group: PlayerGroup<T, TData>): void {
        const subscription = this.groupSubscriptions.get(group);
        if (!subscription) return;
        subscription.unsubscribe();
        this.groupSubscriptions.delete(group);
    }

    addGroup(group: PlayerGroup<T, TData>) {
        if (!(group instanceof PlayerGroup))
            throw new Error("只能添加 PlayerGroup 实例");
        // This is a set of groups: adding the same instance twice is a no-op,
        // not a membership change or another source of forwarded notifications.
        if (this.groups.includes(group)) return this;
        this.groups.push(group);
        this.attachGroup(group);
        this.changed.publish({ type: "scope", reason: "group-added" });
        return this;
    }

    removeGroup(group: PlayerGroup<T, TData>) {
        const index = this.groups.indexOf(group);
        if (index !== -1) {
            this.groups.splice(index, 1);
            if (!this.groups.includes(group)) this.detachGroup(group);
            this.changed.publish({ type: "scope", reason: "group-removed" });
        }
        return this;
    }

    getGroups(): readonly PlayerGroup<T, TData>[] {
        return this.groups.slice();
    }

    /**获取所有玩家，包括invalid的 */
    getAllPlayers(): T[] {
        const all: Set<T> = new Set();
        this.groups.forEach((g) => g.getAll().forEach((p) => all.add(p)));
        return [...all.values()];
    }

    /**获取所有有效玩家 */
    getAllValidPlayers(): ValidGamePlayer<T>[] {
        return this.getAllPlayers().filter(
            (p) => p.isValid
        ) as ValidGamePlayer<T>[];
    }

    /**对所有有效玩家执行操作*/
    forEach(func: (p: ValidGamePlayer<T>) => void) {
        this.getGroups().forEach((g) => g.forEach(func));
        return this;
    }

    forEachGroup(func: (g: PlayerGroup<T, TData>) => void) {
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

    /** Remove groups from this collection; does not clear each group's members. */
    clear() {
        if (this.groups.length === 0) return this;
        this.groups = [];
        for (const group of [...this.groupSubscriptions.keys()]) this.detachGroup(group);
        this.changed.publish({ type: "scope", reason: "groups-cleared" });
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
    findById(
        id: string
    ): { player: T; group: PlayerGroup<T, TData> } | undefined {
        for (const group of this.groups) {
            const player = group.getById(id);
            if (player) return { player, group };
        }
        return undefined;
    }

    /**判断玩家是否在内 */
    has(id: string) {
        return this.findById(id) != undefined;
    }
}
