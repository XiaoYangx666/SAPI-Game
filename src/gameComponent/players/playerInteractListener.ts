import { Player, world } from "@minecraft/server";
import { GameState } from "@sapi-game/gameState";
import { GameComponent } from "../gameComponent";

/**监听玩家和指定实体的互动 */
export class EntityInteractionListener extends GameComponent<GameState<any, any>> {
    callbacks: Map<string, (source: Player) => void> = new Map();

    override onAttach(): void {
        this.subscribe(world.afterEvents.playerInteractWithEntity, (t) => {
            const callback = this.callbacks.get(t.target.typeId);
            if (callback) {
                callback(t.player);
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
