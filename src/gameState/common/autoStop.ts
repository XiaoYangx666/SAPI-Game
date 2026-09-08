import { TTLPlayer } from "@sapi-game/gamePlayer/gamePlayer";
import { PlayerGroupSet } from "@sapi-game/gamePlayer/groupSet";
import { Game, GameState } from "@sapi-game/main";
import { Duration } from "@sapi-game/utils";

interface AutoStopStateConfig<T extends TTLPlayer> {
    groupSet: PlayerGroupSet<T>;
    onLeave?: (p: T) => void;
    /**是否立即离开(下线就死)  默认否*/
    immediateDie?: boolean;
    /**是否释放玩家 默认是 */
    shouldRelease?: boolean;
}

/**自动在groupSet所有玩家寄了之后停止游戏 */
export class AutoStopState<T extends TTLPlayer = any> extends GameState<
    T,
    any,
    AutoStopStateConfig<T>
> {
    override onEnter(): void {
        if (!this.config?.groupSet) return;
        this.subscribe(
            Game.events.interval,
            this.tick.bind(this),
            new Duration(20)
        );
    }

    tick() {
        let liveSize = 0;
        this.config!.groupSet.getAllPlayers().forEach((p) => {
            if (p.ttl > 0) liveSize++;
            if (p.isValid) {
                p.ttl = p.initialTTL;
            } else if (p.ttl > 0) {
                p.ttl--;
                if (this.config?.immediateDie) p.ttl = 0;
                if (p.ttl == 0) {
                    this.config!.onLeave?.(p);
                    if (this.config?.shouldRelease ?? true) {
                        this.playerManager.leave(p.id);
                    }
                }
            }
        });

        if (liveSize === 0) {
            this.logger.debug("检测到玩家已全部下线超时，游戏结束");
            this.engine.stopGame();
        }
    }
}
