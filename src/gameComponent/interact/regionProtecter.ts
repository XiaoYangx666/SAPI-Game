import {
    PlayerBreakBlockBeforeEvent,
    PlayerInteractWithBlockBeforeEvent,
    world,
} from "@minecraft/server";
import { PlayerGroupSet } from "@sapi-game/gamePlayer";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { GameState } from "@sapi-game/gameState";
import { GameComponent } from "../gameComponent";

export interface RegionProtectionOptions {
    /** 需要保护的区域 */
    region: GameRegion;
    /** 是否阻止区域内方块被破坏 */
    blockBreakInside?: boolean;
    /** 是否阻止区域内方块被交互 */
    blockInteractInside?: boolean;
    /** 是否阻止区域外方块被破坏 */
    blockBreakOutside?: boolean;
    /** 是否阻止区域外方块被交互 */
    blockInteractOutside?: boolean;
    /** 生效的玩家组集合 */
    groupSet?: PlayerGroupSet<any>;
}

export class RegionProtector extends GameComponent<
    GameState,
    RegionProtectionOptions
> {
    protected override onAttach(): void {
        if (!this.options) return;

        // 处理破坏方块
        if (this.options.blockBreakInside || this.options.blockBreakOutside) {
            this.subscribe(world.beforeEvents.playerBreakBlock, (t) => {
                if (
                    this.options?.groupSet &&
                    !this.options.groupSet.has(t.player.id)
                ) {
                    return;
                }
                this.handleBreak(t);
            });
        }

        // 处理方块交互
        if (
            this.options.blockInteractOutside ||
            this.options.blockInteractInside
        ) {
            this.subscribe(world.beforeEvents.playerInteractWithBlock, (t) => {
                if (
                    this.options?.groupSet &&
                    !this.options.groupSet.has(t.player.id)
                ) {
                    return;
                }
                this.handleInteract(t);
            });
        }
    }

    private handleBreak(t: PlayerBreakBlockBeforeEvent) {
        if (
            this.options!.blockBreakInside &&
            this.options!.region.isBlockInside(t.block.location)
        ) {
            t.cancel = true;
        } else if (
            this.options!.blockBreakOutside &&
            !this.options!.region.isBlockInside(t.block.location)
        ) {
            t.cancel = true;
        }
    }

    private handleInteract(t: PlayerInteractWithBlockBeforeEvent) {
        if (
            this.options!.blockInteractInside &&
            this.options!.region.isBlockInside(t.block.location)
        ) {
            t.cancel = true;
        } else if (
            this.options!.blockInteractOutside &&
            !this.options!.region.isBlockInside(t.block.location)
        ) {
            t.cancel = true;
        }
    }
}
