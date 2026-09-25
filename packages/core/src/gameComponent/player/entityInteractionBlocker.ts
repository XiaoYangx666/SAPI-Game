import { EntityComponentTypes, system, world } from "@minecraft/server";
import {
    PlayerGroupSet,
    PlayerSource,
    playerSourceHas,
} from "../../gamePlayer";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

interface EntityInteractionBlockerBase {
    entityIds?: string[];
    entityComponentTypes?: EntityComponentTypes[];
    showMessage?: boolean;
    message?: string;
}

type EntityInteractionBlockerScope =
    | {
          /** 被限制的玩家来源。 */
          players: PlayerSource;
          /** @deprecated 使用 players。 */
          groupSet?: PlayerGroupSet;
      }
    | {
          players?: PlayerSource;
          /** @deprecated 使用 players。 */
          groupSet: PlayerGroupSet;
      };

export type EntityInteractionBlockerOptions =
    EntityInteractionBlockerBase & EntityInteractionBlockerScope;

/** 通用实体交互阻止组件。 */
export class EntityInteractionBlocker extends GameComponent<
    GameState,
    EntityInteractionBlockerOptions
> {
    override onAttach(): void {
        if (!this.options) return;

        const {
            players,
            groupSet,
            entityIds,
            entityComponentTypes,
            showMessage = true,
            message,
        } = this.options;
        const source = players ?? groupSet;
        if (!source) {
            throw new Error("EntityInteractionBlocker requires players or groupSet");
        }

        const entityIdSet =
            entityIds && entityIds.length > 0 ? new Set(entityIds) : undefined;

        this.subscribe(world.beforeEvents.playerInteractWithEntity, (event) => {
            const { player, target } = event;

            if (!playerSourceHas(source, player.id)) return;
            if (entityIdSet && !entityIdSet.has(target.typeId)) return;

            if (entityComponentTypes && entityComponentTypes.length > 0) {
                const hasComponent = entityComponentTypes.some((type) => {
                    try {
                        return target.getComponent(type) !== undefined;
                    } catch {
                        return false;
                    }
                });
                if (!hasComponent) return;
            }

            event.cancel = true;

            if (showMessage) {
                system.run(() =>
                    player.onScreenDisplay.setActionBar(
                        message ?? "§c你无法与该实体交互！"
                    )
                );
            }
        });
    }
}
