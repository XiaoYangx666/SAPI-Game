import {
    DisplaySlotId,
    EntityComponentTypes,
    ScoreboardObjective,
    world,
} from "@minecraft/server";
import { GameState } from "@sapi-game/gameState";
import { Game } from "@sapi-game/main";
import { Duration } from "@sapi-game/utils";
import { GameComponent } from "..";

export interface PlayerHealthIndicatorOptions {
    /**计分板名 */
    scoreBoardName: string;
    /**显示名称 */
    displayName: string;
    /**刷新间隔 */
    refreshInterval: Duration;
}

export class PlayerHealthIndicator extends GameComponent<
    GameState,
    PlayerHealthIndicatorOptions
> {
    private obj?: ScoreboardObjective;
    override onAttach(): void {
        if (!this.options) return;
        this.subscribe(
            Game.events.interval,
            () => this.refresh(),
            this.options.refreshInterval
        );
    }

    override onDetach(): void {
        if (this.obj?.isValid) {
            world.scoreboard.removeObjective(this.obj);
        }
    }

    private getObj() {
        if (this.obj && this.obj.isValid) return this.obj;
        this.obj =
            world.scoreboard.getObjective(this.options!.scoreBoardName) ??
            world.scoreboard.addObjective(
                this.options!.scoreBoardName,
                this.options!.displayName
            );
        return this.obj;
    }

    /**展示 */
    show() {
        const obj = this.getObj();
        world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.BelowName, {
            objective: obj,
        });
    }

    /**刷新计分板 */
    refresh() {
        const obj = this.getObj();
        Game.server.getAllPlayers().forEach((p) => {
            const comp = p.getComponent(EntityComponentTypes.Health);
            if (!comp) return;
            const cur = comp.currentValue;
            obj.setScore(p, cur);
        });
    }
}
