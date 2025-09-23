import { Player, world } from "@minecraft/server";
import { GameComponent, GameState } from "@sapi-game/main";
import { EntityTypeIds } from "@sapi-game/utils/vanila-data";

export class PlayerAttackListener extends GameComponent<GameState<any, any>> {
    callbacks: Map<string, (source: Player) => void> = new Map();

    override onAttach(): void {
        this.subscribe(world.afterEvents.entityHitEntity, (t) => {
            if (t.damagingEntity.typeId !== EntityTypeIds.Player) return;
            const callback = this.callbacks.get(t.hitEntity.typeId);
            if (callback) {
                callback(t.damagingEntity as Player);
            }
        });
    }

    override onDetach(): void {
        this.callbacks.clear();
        super.onDetach();
    }

    bind(typeId: string, func: (source: Player) => void) {
        this.callbacks.set(typeId, func);
    }
}
