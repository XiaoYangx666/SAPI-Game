import { EntityComponentTypes, system, world } from "@minecraft/server";
import { PlayerGroupSet } from "@sapi-game/gamePlayer/groupSet";
import { GameComponent, GameState } from "@sapi-game/main";

interface EntityInteractionBlockerOptions {
    /** 被限制的玩家组 */
    groupSet: PlayerGroupSet;

    /**
     * 可选：要阻止交互的实体 ID 列表。
     * 若不设置或为空，则阻止与所有实体交互。
     */
    entityIds?: string[];

    /**
     * 可选：要阻止的实体组件类型。
     * 若设置，则仅阻止拥有该组件的实体。
     */
    entityComponentTypes?: EntityComponentTypes[];

    /**
     * 可选：是否给玩家提示（默认 true）
     */
    showMessage?: boolean;

    /**
     * 可选：提示信息
     */
    message?: string;
}

/**
 * 通用实体交互阻止组件
 */
export class EntityInteractionBlocker extends GameComponent<
    GameState,
    EntityInteractionBlockerOptions
> {
    override onAttach(): void {
        if (!this.options) return;
        const {
            groupSet,
            entityIds,
            entityComponentTypes,
            showMessage = true,
            message,
        } = this.options;

        this.subscribe(world.beforeEvents.playerInteractWithEntity, (t) => {
            const { player, target } = t;
            console.log(target.typeId);

            // 1️⃣ 不在限制组内 -> 放行
            if (!groupSet.findById(player.id)) return;

            // 2️⃣ 若有实体类型限制，且当前实体不在其中 -> 放行
            if (
                entityIds &&
                entityIds.length > 0 &&
                !entityIds.includes(target.typeId)
            ) {
                return;
            }

            // 3️⃣ 若指定组件类型数组，且实体不含任意一个组件 -> 放行
            if (entityComponentTypes && entityComponentTypes.length > 0) {
                const hasComponent = entityComponentTypes.some((type) => {
                    try {
                        return !!target.getComponent(type);
                    } catch {
                        return false;
                    }
                });
                if (!hasComponent) return;
            }

            // 4️⃣ 阻止交互
            t.cancel = true;

            // 5️⃣ 提示
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
