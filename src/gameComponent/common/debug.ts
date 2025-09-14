import { system } from "@minecraft/server";
import { GameComponent } from "@sapi-game/gameComponent/gameComponent";
import { GameState } from "@sapi-game/gameState";

/**一个用于State调试的组件 */
export class StateDebugComponent extends GameComponent<GameState<any, any>> {
    override onAttach(): void {
        this.subscribe(system.afterEvents.scriptEventReceive, (t) => {
            if (t.id != "game:debug") return;
            if (t.message == "event") {
                this.state.eventManager.debug();
            }
        });
    }
}
