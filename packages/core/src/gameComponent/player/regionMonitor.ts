import { GamePlayer, PlayerSource, resolvePlayers } from "@sapi-game/gamePlayer";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { GameState } from "@sapi-game/gameState";
import { Game } from "@sapi-game/main";
import { Duration } from "@sapi-game/utils";
import { GameComponent } from "../gameComponent";

interface PlayerRegionMonitorBase<P extends GamePlayer> {
    /** 区域。玩家处于其他维度时也视为区域外。 */
    region: GameRegion;
    /** 检测间隔，默认 10 tick。 */
    interval?: Duration;
    /**
     * 玩家进入区域外时执行。
     * 同一次“在区域外”期间只触发一次；重新进入区域后再次离开才会再次触发。
     */
    onLeave: (player: P) => void;
}

type PlayerRegionMonitorSource<P extends GamePlayer> =
    | {
          /** 要监测的玩家来源。 */
          players: PlayerSource<P>;
          /** @deprecated 使用 players。 */
          groups?: PlayerSource<P>;
      }
    | {
          players?: PlayerSource<P>;
          /** @deprecated 使用 players。 */
          groups: PlayerSource<P>;
      };

export type PlayerRegionMonitorOptions<P extends GamePlayer> =
    PlayerRegionMonitorBase<P> & PlayerRegionMonitorSource<P>;

/** 监测玩家是否离开指定区域。 */
export class PlayerRegionMonitor<P extends GamePlayer> extends GameComponent<
    GameState,
    PlayerRegionMonitorOptions<P>
> {
    private readonly outsidePlayers = new Set<string>();

    override onAttach(): void {
        if (!this.options) return;
        const source = this.options.players ?? this.options.groups;
        if (!source) {
            throw new Error("PlayerRegionMonitor requires players or groups");
        }

        this.subscribe(
            Game.events.interval,
            () => this.detectOutOfRegionPlayers(),
            this.options.interval ?? new Duration(10)
        );
    }

    override onDetach(): void {
        this.outsidePlayers.clear();
    }

    private detectOutOfRegionPlayers() {
        const options = this.options;
        if (!options) return;

        const source = options.players ?? options.groups;
        if (!source) return;

        const aliveIds = new Set<string>();

        for (const player of resolvePlayers(source)) {
            if (!player.isValid || !player.player) continue;
            aliveIds.add(player.id);

            const nativePlayer = player.player;
            const outside =
                nativePlayer.dimension.id !== options.region.dimensionId ||
                !options.region.isInside(nativePlayer.location);

            if (!outside) {
                this.outsidePlayers.delete(player.id);
                continue;
            }
            if (this.outsidePlayers.has(player.id)) continue;

            this.outsidePlayers.add(player.id);
            options.onLeave(player);
        }

        for (const id of [...this.outsidePlayers]) {
            if (!aliveIds.has(id)) this.outsidePlayers.delete(id);
        }
    }
}
