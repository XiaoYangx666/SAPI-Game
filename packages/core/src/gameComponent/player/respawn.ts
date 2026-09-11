import { Entity, world } from "@minecraft/server";
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
    groupSet: PlayerGroupSet<TPlayer>;
    /** 玩家死亡时触发自定义逻辑*/
    onDie?: (
        player: TPlayer,
        group: PlayerGroup<TPlayer>,
        source?: Entity
    ) => void;

    /**玩家重生时触发 */
    onSpawn?: (player: TPlayer, group: PlayerGroup<TPlayer, TData>) => void;

    /**是否自动广播消息（默认 false）*/
    autoBroadcast?: boolean;

    /**构建玩家显示名，用于广播消息*/
    buildNameFunc?: (
        player: TPlayer,
        group: PlayerGroup<TPlayer, TData>
    ) => string;

    /**自定义消息构建 */
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

            // 执行自定义逻辑
            onDie?.(player, group, event.damageSource.damagingEntity);

            // 自动广播消息
            if (autoBroadcast && buildNameFunc) {
                const playerName = buildNameFunc(player, group);
                const killerName = this.getKillerName(
                    event.damageSource.damagingEntity
                );
                let message: string;
                if (buildMsg) {
                    message = buildMsg(playerName, killerName, player);
                } else {
                    message = killerName
                        ? `${playerName} §r 被 ${killerName} §r 杀死了`
                        : `${playerName} §r 死了`;
                }

                groupSet.sendMessage(message);
            }
        });

        if (onSpawn) {
            this.subscribe(world.afterEvents.playerSpawn, (t) => {
                const ans = groupSet.findById(t.player.id);
                if (ans?.player) {
                    onSpawn(ans.player, ans.group);
                }
            });
        }
    }

    private getKillerName(source?: Entity): string | undefined {
        if (!source || source.typeId !== EntityTypeIds.Player) return undefined;

        const result = this.options!.groupSet.findById(source.id);
        if (!result) return undefined;

        if (this.options!.buildNameFunc) {
            return this.options!.buildNameFunc(result.player, result.group);
        }
        return undefined;
    }
}
