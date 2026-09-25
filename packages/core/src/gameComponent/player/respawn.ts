import { Entity, Player, world } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroupSet } from "../../gamePlayer/groupSet";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameState } from "../../gameState/gameState";
import { EntityTypeIds } from "../../utils/vanila-data";
import { GameComponent } from "../gameComponent";

export interface RespawnComponentOptions<
    TPlayer extends GamePlayer,
    TData = unknown
> {
    groupSet: PlayerGroupSet<TPlayer, TData>;

    /** 玩家死亡时触发自定义逻辑。 */
    onDie?: (
        player: TPlayer,
        group: PlayerGroup<TPlayer, TData>,
        source?: Entity
    ) => void;

    /** 玩家重生时触发。 */
    onSpawn?: (player: TPlayer, group: PlayerGroup<TPlayer, TData>) => void;

    /** 是否自动广播死亡消息，默认 false。 */
    autoBroadcast?: boolean;

    /**
     * 构建玩家显示名，用于广播消息。
     * 不提供时直接使用 GamePlayer.name。
     */
    buildNameFunc?: (
        player: TPlayer,
        group: PlayerGroup<TPlayer, TData>
    ) => string;

    /** 自定义死亡消息构建。 */
    buildMsg?: (
        playerName: string,
        killerName: string | undefined,
        player: TPlayer
    ) => string;
}

export class RespawnComponent<
    TPlayer extends GamePlayer,
    TData = unknown
> extends GameComponent<GameState, RespawnComponentOptions<TPlayer, TData>> {
    override onAttach(): void {
        if (!this.options) return;

        const {
            onDie,
            autoBroadcast,
            buildNameFunc,
            groupSet,
            onSpawn,
            buildMsg,
        } = this.options;

        this.subscribe(world.afterEvents.entityDie, (event) => {
            const deadEntity = event.deadEntity;
            if (deadEntity.typeId !== EntityTypeIds.Player) return;

            const result = groupSet.findById(deadEntity.id);
            if (!result) return;

            const { player, group } = result;
            onDie?.(player, group, event.damageSource.damagingEntity);

            if (!autoBroadcast) return;

            const playerName =
                buildNameFunc?.(player, group) ?? player.name;
            const killerName = this.getKillerName(
                event.damageSource.damagingEntity
            );
            const message = buildMsg
                ? buildMsg(playerName, killerName, player)
                : killerName
                  ? `${playerName} §r 被 ${killerName} §r 杀死了`
                  : `${playerName} §r 死了`;

            groupSet.sendMessage(message);
        });

        if (onSpawn) {
            this.subscribe(world.afterEvents.playerSpawn, (event) => {
                const result = groupSet.findById(event.player.id);
                if (result) onSpawn(result.player, result.group);
            });
        }
    }

    private getKillerName(source?: Entity): string | undefined {
        if (!source || source.typeId !== EntityTypeIds.Player) return undefined;

        const result = this.options!.groupSet.findById(source.id);
        if (result) {
            return (
                this.options!.buildNameFunc?.(result.player, result.group) ??
                result.player.name
            );
        }

        // 杀手不属于当前游戏时，仍可使用原生玩家名。
        return (source as Player).name;
    }
}
