import { GamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";
import { PlayerGroupSet } from "./groupSet";

/** 可作为玩家来源的实际容器。 */
export type PlayerCollection<
    P extends GamePlayer = GamePlayer,
    TData = any
> =
    | PlayerGroup<P, TData>
    | PlayerGroupSet<P, TData>
    | Iterable<P>;

/**
 * 一个可解析为玩家集合的来源。
 *
 * 既可以直接传 Group / GroupSet / Iterable，也可以传一个按需返回这些容器的函数。
 */
export type PlayerSource<
    P extends GamePlayer = GamePlayer,
    TData = any
> =
    | PlayerCollection<P, TData>
    | (() => PlayerCollection<P, TData>);

export interface PlayerSourceEntry<
    P extends GamePlayer = GamePlayer,
    TData = any
> {
    player: P;
    /** 只有来源本身携带队伍信息时才存在。 */
    group?: PlayerGroup<P, TData>;
}

function resolvePlayerCollection<P extends GamePlayer, TData>(
    source: PlayerSource<P, TData> | undefined
): PlayerCollection<P, TData> | undefined {
    if (source === undefined) return undefined;
    return typeof source === "function" ? source() : source;
}

/** 解析玩家来源，返回其中的玩家数组。来源为空时返回空数组。 */
export function resolvePlayers<P extends GamePlayer, TData = any>(
    source: PlayerSource<P, TData> | undefined
): P[] {
    const value = resolvePlayerCollection(source);
    if (value === undefined) return [];
    if (value instanceof PlayerGroupSet) return value.getAllPlayers();
    if (value instanceof PlayerGroup) return value.getAll();
    return [...value];
}

/**
 * 解析玩家及其所属组。
 *
 * Group / GroupSet 会保留组上下文；普通 Iterable 没有组语义，因此 group 为 undefined。
 * 函数来源只会求值一次。
 */
export function resolvePlayerEntries<P extends GamePlayer, TData = any>(
    source: PlayerSource<P, TData> | undefined
): PlayerSourceEntry<P, TData>[] {
    const value = resolvePlayerCollection(source);
    if (value === undefined) return [];

    if (value instanceof PlayerGroup) {
        return value.getAll().map((player) => ({ player, group: value }));
    }
    if (value instanceof PlayerGroupSet) {
        return value.getAllPlayers().map((player) => ({
            player,
            group: value.findById(player.id)?.group,
        }));
    }
    return [...value].map((player) => ({ player }));
}

/** 判断玩家 ID 是否存在于来源中；常见 Group/GroupSet 路径不会创建临时数组。 */
export function playerSourceHas<P extends GamePlayer, TData = any>(
    source: PlayerSource<P, TData> | undefined,
    playerId: string
): boolean {
    const value = resolvePlayerCollection(source);
    if (value === undefined) return false;
    if (value instanceof PlayerGroupSet) return value.has(playerId);
    if (value instanceof PlayerGroup) return value.getById(playerId) !== undefined;
    for (const player of value) {
        if (player.id === playerId) return true;
    }
    return false;
}
