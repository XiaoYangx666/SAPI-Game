import { Entity, Player } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroupSet } from "../../gamePlayer/groupSet";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameState } from "../../gameState/gameState";
import { EntityTypeIds } from "../../utils/vanila-data";
import {
    PlayerLifecycle,
    playerLifecycle,
} from "./playerLifecycle";

export interface RespawnComponentOptions<
    TPlayer extends GamePlayer,
    TData = unknown
> {
    groupSet: PlayerGroupSet<TPlayer, TData>;
    onDie?: (
        player: TPlayer,
        group: PlayerGroup<TPlayer, TData>,
        source?: Entity
    ) => void;
    onSpawn?: (player: TPlayer, group: PlayerGroup<TPlayer, TData>) => void;
    autoBroadcast?: boolean;
    buildNameFunc?: (
        player: TPlayer,
        group: PlayerGroup<TPlayer, TData>
    ) => string;
    buildMsg?: (
        playerName: string,
        killerName: string | undefined,
        player: TPlayer
    ) => string;
}

/**
 * @deprecated 使用 PlayerLifecycle + playerLifecycle(options)。
 * 旧的自动死亡播报仅作为兼容适配层保留。
 */
export class RespawnComponent<
    TPlayer extends GamePlayer,
    TData = unknown
> extends PlayerLifecycle {
    constructor(
        state: GameState,
        options?: RespawnComponentOptions<TPlayer, TData>,
        tag?: string
    ) {
        super(
            state,
            options
                ? playerLifecycle({
                      players: options.groupSet,
                      onDeath: ({ player, group, event }) => {
                          if (!group) return;

                          options.onDie?.(
                              player,
                              group,
                              event.damageSource.damagingEntity
                          );
                          if (!options.autoBroadcast) return;

                          const playerName =
                              options.buildNameFunc?.(player, group) ??
                              player.name;
                          const killerName = getKillerName(
                              event.damageSource.damagingEntity,
                              options.groupSet,
                              options.buildNameFunc
                          );
                          const message = options.buildMsg
                              ? options.buildMsg(
                                    playerName,
                                    killerName,
                                    player
                                )
                              : killerName
                                ? `${playerName} §r 被 ${killerName} §r 杀死了`
                                : `${playerName} §r 死了`;

                          options.groupSet.sendMessage(message);
                      },
                      onSpawn: options.onSpawn
                          ? ({ player, group }) => {
                                if (group) options.onSpawn?.(player, group);
                            }
                          : undefined,
                  })
                : undefined,
            tag
        );
    }
}

function getKillerName<
    P extends GamePlayer,
    TData
>(
    source: Entity | undefined,
    groupSet: PlayerGroupSet<P, TData>,
    buildName?: (player: P, group: PlayerGroup<P, TData>) => string
): string | undefined {
    if (!source || source.typeId !== EntityTypeIds.Player) return undefined;

    const result = groupSet.findById(source.id);
    if (result) {
        return buildName?.(result.player, result.group) ?? result.player.name;
    }

    return (source as Player).name;
}
