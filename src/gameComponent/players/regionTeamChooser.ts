import { PlayerRegionEvent, RegionEventType } from "@sapi-game/gameEvent/events/regionEvents";
import { Game } from "@sapi-game/main";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameState } from "../../gameState";
import { GameRegion } from "../../utils/gameRegion";
import { GameComponent } from "../gameComponent";

export interface RegionTeamChooserData<P extends GamePlayer> {
    /**指定范围 */
    region: GameRegion;
    /**玩家进入区域时执行 */
    onEnter?: (player: P) => void;
    /**玩家首次加入本队时执行 */
    onJoin?: (player: P) => void;
    /**指定队伍*/
    team: PlayerGroup<P>;
}

interface RegionTeamChooserConfig<P extends GamePlayer> {
    config: RegionTeamChooserData<P>[];
    /**当玩家离开区域时是否从队伍中删除 */
    removeOnLeave?: boolean;
}

/**区域队伍选择器 */
export class RegionTeamChooser<
    P extends GamePlayer,
    S extends GameState<P, any> = GameState<P, any>
> extends GameComponent<S, RegionTeamChooserConfig<P>> {
    override onAttach() {
        if (!this.options) return;
        this.options.config.forEach((data) => {
            this.subscribe(
                Game.events.region,
                (event) => this.handleRegionEvent(event, data),
                data.region
            );
        });
    }

    private handleRegionEvent(event: PlayerRegionEvent, data: RegionTeamChooserData<P>) {
        const gamePlayer = this.state.playerManager.get(event.player);
        if (!gamePlayer) return;

        switch (event.type) {
            case RegionEventType.Enter:
                this.handlePlayerEnter(gamePlayer, data);
                break;
            case RegionEventType.Leave:
                this.handlePlayerLeave(gamePlayer, data);
                break;
        }
    }

    private handlePlayerEnter(gamePlayer: P, configData: RegionTeamChooserData<P>) {
        const newTeam = configData.team;
        const alreadyInTeam = newTeam.has(gamePlayer);
        if (configData.onEnter) {
            configData.onEnter(gamePlayer);
        }
        //从所有队伍清除目标玩家
        this.options?.config.forEach((d) => {
            if (d.team !== newTeam) {
                d.team.delete(gamePlayer);
            }
        });
        //添加到新队伍
        newTeam.add(gamePlayer);
        //执行回调
        if (configData.onJoin && !alreadyInTeam) {
            configData.onJoin(gamePlayer);
        }
    }

    private handlePlayerLeave(gamePlayer: P, configData: RegionTeamChooserData<P>) {
        const shouldRemoveOnLeave = this.options?.removeOnLeave ?? false;
        if (shouldRemoveOnLeave) {
            configData.team.delete(gamePlayer);
        }
    }

    override onDetach(): void {
        super.onDetach();
        if (this.options) {
            this.options.config.forEach((t) => t.team.clearInvalid());
        }
    }
}
