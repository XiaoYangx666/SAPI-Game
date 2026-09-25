import { BlockComponentTypes, system, world } from "@minecraft/server";
import {
    PlayerGroupSet,
    PlayerSource,
    playerSourceHas,
} from "../../gamePlayer";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

export interface InteractionBlockerOptions {
    /** 被限制的玩家来源。 */
    players?: PlayerSource;
    /** @deprecated 使用 players。 */
    groupSet?: PlayerGroupSet;

    /**
     * 可选：始终允许交互的方块 ID 列表。
     * allowIds 优先级最高，命中后不会再进行 blockIds / component 匹配。
     */
    allowIds?: string[];

    /**
     * 可选：指定要阻止交互的方块 ID 列表。
     * 若不设置或为空，则表示不按 ID 限制。
     */
    blockIds?: string[];

    /**
     * 可选：指定要阻止的方块组件类型（例如 BlockComponentTypes.Inventory）。
     * 若不设置，则不按组件过滤。
     */
    blockComponentType?: BlockComponentTypes;

    /** 是否给玩家提示，默认 true。 */
    showMessage?: boolean;

    /** 提示信息。 */
    message?: string;
}

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
