import { GamePlayer, PlayerGroupSet } from "@sapi-game/gamePlayer";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { GameState } from "@sapi-game/gameState";
import { Game } from "@sapi-game/main";
import { Duration } from "@sapi-game/utils";
import { GameComponent } from "../gameComponent";

interface PlayerRegionMonitorOptions<P extends GamePlayer> {
    /**区域 */
    region: GameRegion;
    /**检测间隔 */
    interval: Duration;
    /**玩家组集合 */
    groups: PlayerGroupSet<P>;
    /**区域外的玩家执行 */
    onLeave: (player: P) => void;
}

/**玩家区域监测 */
export class PlayerRegionMonitor<P extends GamePlayer> extends GameComponent<
    GameState,
    PlayerRegionMonitorOptions<P>
> {
    override onAttach(): void {
        if (!this.options) return;
        this.subscribe(
            Game.events.interval,
            () => this.detectOutOfRegionPlayers(),
            this.options.interval
        );
    }

    private detectOutOfRegionPlayers() {
        const region = this.options!.region;
        this.options!.groups.forEach((p) => {
            if (!region.isInside(p.player.location)) {
                this.options!.onLeave(p);
            }
        });
    }
}
