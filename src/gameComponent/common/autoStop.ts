import { TTLPlayer } from "@sapi-game/gamePlayer/gamePlayer";
import { PlayerGroupSet } from "@sapi-game/gamePlayer/groupSet";
import { Game, GameComponent, GameState } from "@sapi-game/main";
import { Duration } from "@sapi-game/utils";

export interface AutoStopConfig<T extends TTLPlayer> {
    groupSet: PlayerGroupSet<T>;
    onLeave?: (p: T) => void;
    onStopGame: () => void;
    immediateDie?: boolean;
    shouldRelease?: boolean;
}

/**在组中所有玩家寄了之后自动结束游戏 */
export class AutoStopComponent<T extends TTLPlayer> extends GameComponent<
    GameState<T, any, any>,
    AutoStopConfig<T>
> {
    override onAttach(): void {
        if (!this.options) return;
        this.subscribe(
            Game.events.interval,
            this.tick.bind(this),
            new Duration(20)
        );
    }

    tick() {
        let liveSize = 0;
        this.options!.groupSet.getAllPlayers().forEach((p) => {
            if (p.ttl > 0) liveSize++;
            if (p.isValid) {
                p.ttl = p.initialTTL;
            } else if (p.ttl > 0) {
                p.ttl--;
                if (this.options?.immediateDie) p.ttl = 0;
                if (p.ttl == 0) {
                    this.options!.onLeave?.(p);
                    if (this.options?.shouldRelease) {
                        this.state.playerManager.leave(p.id);
                    }
                }
            }
        });

        if (liveSize === 0) this.options!.onStopGame();
    }
}
