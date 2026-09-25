import { GamePlayer } from "./gamePlayer";
import { PlayerGroup } from "./playerGroup";
import { PlayerGroupSet } from "./groupSet";

/**
 * 一个可解析为玩家集合的来源。
 *
 * 组件经常需要「一批玩家」而不是某一种具体容器，这里把常见的
 * {@link PlayerGroup}、{@link PlayerGroupSet}、普通可迭代集合以及返回它们的
 * 函数统一成一个类型，组件按需解析即可。
 */
export type PlayerSource<P extends GamePlayer = GamePlayer> =
    | PlayerGroup<P>
    | PlayerGroupSet<P>
    | Iterable<P>
    | (() => Iterable<P>);

/** 解析玩家来源，返回其中的玩家数组。来源为空时返回空数组。 */
export function resolvePlayers<P extends GamePlayer>(
    source: PlayerSource<P> | undefined
): P[] {
    if (source === undefined) return [];
    const value = typeof source === "function" ? source() : source;
    if (value instanceof PlayerGroupSet) return value.getAllPlayers();
    if (value instanceof PlayerGroup) return value.getAll();
    return [...value];
}

/** 判断玩家 ID 是否存在于来源中；常见 Group/GroupSet 路径不会创建临时数组。 */
export function playerSourceHas<P extends GamePlayer>(
    source: PlayerSource<P> | undefined,
    playerId: string
): boolean {
    if (source === undefined) return false;
    const value = typeof source === "function" ? source() : source;
    if (value instanceof PlayerGroupSet) return value.has(playerId);
    if (value instanceof PlayerGroup) return value.getById(playerId) !== undefined;
    for (const player of value) {
        if (player.id === playerId) return true;
    }
    return false;
}
