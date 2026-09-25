import { Player } from "@minecraft/server";
import { RegionEventType } from "@sapi-game/gameEvent/events/regionEvents";
import { GamePlayer } from "@sapi-game/gamePlayer/gamePlayer";
import { PlayerGroupSet } from "@sapi-game/gamePlayer/groupSet";
import { PlayerGroup } from "@sapi-game/gamePlayer/playerGroup";
import { GameRegion } from "@sapi-game/gameRegion/gameRegion";
import { GameState } from "@sapi-game/gameState/gameState";
import { Game } from "@sapi-game/main";
import { GameComponent } from "../gameComponent";

export interface RegionTeamCleanUpOptions<
    P extends GamePlayer = GamePlayer,
    TData = any
> {
    region: GameRegion;
    /** 推荐：直接传完整组集合，可一次定位玩家当前所属组。 */
    groupSet?: PlayerGroupSet<P, TData>;
    /** @deprecated 使用 groupSet。旧写法会继续从所有传入组中删除。 */
    teams?: PlayerGroup<P, TData>[];
    /** 玩家离开区域后触发；保持旧语义，即使玩家原本不在任何队伍也会调用。 */
    onClean?: (player: Player) => void;
}

/** 玩家离开指定区域时将其从队伍移除。 */
export class RegionTeamCleaner<
    P extends GamePlayer = GamePlayer,
    TData = any
> extends GameComponent<GameState, RegionTeamCleanUpOptions<P, TData>> {
    override onAttach(): void {
        const options = this.options;
        if (!options) return;
        if (!options.groupSet && !options.teams) {
            throw new Error("RegionTeamCleaner requires groupSet or teams");
        }

        this.subscribe(
            Game.events.region,
            (event) => {
                if (event.type !== RegionEventType.Leave) return;

                if (options.groupSet) {
                    options.groupSet
                        .findGroupById(event.player.id)
                        ?.delete(event.player, "region-leave");
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
