import { BlockComponentTypes, system, world } from "@minecraft/server";
import {
    PlayerGroupSet,
    PlayerSource,
    playerSourceHas,
} from "../../gamePlayer";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

interface InteractionBlockerBase {
    allowIds?: string[];
    blockIds?: string[];
    blockComponentType?: BlockComponentTypes;
    showMessage?: boolean;
    message?: string;
}

type InteractionBlockerScope =
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

export type InteractionBlockerOptions =
    InteractionBlockerBase & InteractionBlockerScope;

/** 通用方块交互阻止组件。 */
export class BlockInteractionBlocker extends GameComponent<
    GameState,
    InteractionBlockerOptions
> {
    override onAttach(): void {
        if (!this.options) return;

        const {
            players,
            groupSet,
            allowIds,
            blockIds,
            blockComponentType,
            showMessage = true,
            message,
        } = this.options;
        const source = players ?? groupSet;
        if (!source) {
            throw new Error("BlockInteractionBlocker requires players or groupSet");
        }

        const allowIdSet =
            allowIds && allowIds.length > 0 ? new Set(allowIds) : undefined;
        const blockIdSet =
            blockIds && blockIds.length > 0 ? new Set(blockIds) : undefined;

        this.subscribe(world.beforeEvents.playerInteractWithBlock, (event) => {
            const { player, block } = event;

            if (!playerSourceHas(source, player.id)) return;
            if (allowIdSet?.has(block.typeId)) return;
            if (blockIdSet && !blockIdSet.has(block.typeId)) return;

            if (blockComponentType) {
                const component = block.getComponent(blockComponentType);
                if (!component) return;
            }

            event.cancel = true;

            if (showMessage) {
                system.run(() =>
                    player.onScreenDisplay.setActionBar(
                        message ?? "§c你无法与该方块交互！"
                    )
                );
            }
        });
    }
}
