import { RegionEventType } from "@sapi-game/gameEvent/events/regionEvents";
import { PlayerGroup } from "@sapi-game/gamePlayer/playerGroup";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { GameState } from "@sapi-game/gameState";
import { Game } from "@sapi-game/main";
import { GameComponent } from "../gameComponent";
import { Player } from "@minecraft/server";

interface RegionTeamCleanUpOptions {
    region: GameRegion;
    teams: PlayerGroup<any>[];
    onClean?: (p: Player) => void;
}

/**玩家离开指定区域时将他从team移除 */
export class RegionTeamCleaner extends GameComponent<
    GameState,
    RegionTeamCleanUpOptions
> {
    override onAttach(): void {
        if (!this.options) return;
        this.subscribe(
            Game.events.region,
            (t) => {
                if (t.type == RegionEventType.Leave) {
                    this.options?.teams.forEach((team) =>
                        team.delete(t.player)
                    );
                    this.options?.onClean?.(t.player);
                }
            },
            this.options.region
        );
    }
}
