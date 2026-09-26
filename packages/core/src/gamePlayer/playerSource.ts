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
        return Array.from(value, (player) => ({ player, group: value }));
    }

    if (value instanceof PlayerGroupSet) {
        const entries: PlayerSourceEntry<P, TData>[] = [];
        const seen = new Set<string>();
        value.forEachGroup((group) => {
            for (const player of group) {
                if (seen.has(player.id)) continue;
                seen.add(player.id);
                entries.push({ player, group });
            }
        });
        return entries;
    }

    return Array.from(value, (player) => ({ player }));
}

/**
 * 按 ID 查找玩家并保留可用的组上下文。
 * Group / GroupSet 走索引；普通 Iterable 只遍历到命中项。
 */
export function findPlayerSourceEntry<
    P extends GamePlayer,
    TData = any
>(
    source: PlayerSource<P, TData> | undefined,
    playerId: string
): PlayerSourceEntry<P, TData> | undefined {
    const value = resolvePlayerCollection(source);
    if (value === undefined) return undefined;

    if (value instanceof PlayerGroupSet) {
        return value.findById(playerId);
    }

    if (value instanceof PlayerGroup) {
        const player = value.getById(playerId);
        return player ? { player, group: value } : undefined;
    }

    for (const player of value) {
        if (player.id === playerId) return { player };
    }
    return undefined;
}

/** 判断玩家 ID 是否存在于来源中；常见 Group/GroupSet 路径不会创建临时数组。 */
export function playerSourceHas<P extends GamePlayer, TData = any>(
    source: PlayerSource<P, TData> | undefined,
    playerId: string
): boolean {
    const value = resolvePlayerCollection(source);
    if (value === undefined) return false;
    if (value instanceof PlayerGroupSet) return value.has(playerId);
    if (value instanceof PlayerGroup) return value.hasId(playerId);

    for (const player of value) {
        if (player.id === playerId) return true;
    }
    return false;
}

/**
 * 判断两个玩家 ID 是否都存在于同一来源。
 *
 * 动态函数来源只求值一次；普通 Iterable 也只遍历一次，
 * 避免 PvP 等高频路径重复解析，且兼容一次性 generator。
 */
export function playerSourceHasBoth<P extends GamePlayer, TData = any>(
    source: PlayerSource<P, TData> | undefined,
    firstId: string,
    secondId: string
): boolean {
    const value = resolvePlayerCollection(source);
    if (value === undefined) return false;

    if (value instanceof PlayerGroupSet) {
        return value.has(firstId) && value.has(secondId);
    }
    if (value instanceof PlayerGroup) {
        return value.hasId(firstId) && value.hasId(secondId);
    }

    if (firstId === secondId) {
        for (const player of value) {
            if (player.id === firstId) return true;
        }
        return false;
    }

    let firstFound = false;
    let secondFound = false;
    for (const player of value) {
        if (player.id === firstId) firstFound = true;
        if (player.id === secondId) secondFound = true;
        if (firstFound && secondFound) return true;
    }
    return false;
}
