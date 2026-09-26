import { Player } from "@minecraft/server";
import { RegionEventType } from "@sapi-game/gameEvent/events/regionEvents";
import { GamePlayer } from "@sapi-game/gamePlayer/gamePlayer";
import { PlayerGroupSet } from "@sapi-game/gamePlayer/groupSet";
import { PlayerGroup } from "@sapi-game/gamePlayer/playerGroup";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { GameState } from "@sapi-game/gameState/gameState";
import { Game } from "@sapi-game/main";
import { GameComponent } from "../gameComponent";

interface RegionTeamCleanUpBase {
    region: GameRegion;
    /** 玩家离开区域后触发；即使玩家原本不在任何队伍也会调用。 */
    onClean?: (player: Player) => void;
}

type RegionTeamCleanUpScope<
    P extends GamePlayer,
    TData
> =
    | {
          /** 推荐：直接传完整组集合。 */
          groupSet: PlayerGroupSet<P, TData>;
          /** @deprecated 使用 groupSet。 */
          teams?: PlayerGroup<P, TData>[];
      }
    | {
          groupSet?: PlayerGroupSet<P, TData>;
          /** @deprecated 使用 groupSet。 */
          teams: PlayerGroup<P, TData>[];
      };

export type RegionTeamCleanUpOptions<
    P extends GamePlayer = GamePlayer,
    TData = any
> = RegionTeamCleanUpBase & RegionTeamCleanUpScope<P, TData>;

/**
 * 玩家离开指定区域时将其从所有匹配队伍移除。
 * @deprecated 选队大厅请使用 RegionTeamChooser.membershipRegion；
 * 其他边界清理请使用 RegionBoundary。
 */
export class RegionTeamCleaner<
    P extends GamePlayer = GamePlayer,
    TData = any
> extends GameComponent<GameState, RegionTeamCleanUpOptions<P, TData>> {
    override onAttach(): void {
        const options = this.options;
        if (!options) return;

        this.subscribe(
            Game.events.region,
            (event) => {
                if (event.type !== RegionEventType.Leave) return;

                if (options.groupSet) {
                    options.groupSet.removePlayer(event.player, "region-leave");
                } else {
                    for (const team of options.teams ?? []) {
                        team.delete(event.player, "region-leave");
                    }
                }

                options.onClean?.(event.player);
            },
            options.region
        );
    }
}
