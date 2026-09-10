import { GameMode } from "@minecraft/server";
import {
    PlayerRegionEvent,
    RegionEventType,
} from "@sapi-game/gameEvent/events/regionEvents";
import { Game } from "@sapi-game/main";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameRegion } from "../../gameRegion/gameRegion";
import { GameState } from "../../gameState/gameState";
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
    /**当玩家离开区域时是否从队伍中删除(默认否) */
    removeOnLeave?: boolean;
    /**是否允许旁观者进队(默认否) */
    allowSpectator?: boolean;
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

    private handleRegionEvent(
        event: PlayerRegionEvent,
        data: RegionTeamChooserData<P>
    ) {
        // 区域选择器本身就是“加入游戏”的入口，因此这里显式 join，
        // 不再依赖 playerManager.get() 的隐式副作用。
        const joined = this.state.playerManager.join(event.player);
        if (!joined.allowed) {
            if (event.player.isValid) {
                event.player.sendMessage("暂时无法进入队伍");
            }
            return;
        }

        const gamePlayer = joined.player;
        switch (event.type) {
            case RegionEventType.Enter:
                this.handlePlayerEnter(gamePlayer, data);
                break;
            case RegionEventType.Leave:
                this.handlePlayerLeave(gamePlayer, data);
                break;
        }
    }

    private handlePlayerEnter(
        gamePlayer: P,
        configData: RegionTeamChooserData<P>
    ) {
        if (
            !(this.options?.allowSpectator ?? false) &&
            gamePlayer.player?.getGameMode() === GameMode.Spectator
        ) {
            return;
        }

        const newTeam = configData.team;
        const alreadyInTeam = newTeam.has(gamePlayer);
        configData.onEnter?.(gamePlayer);

        this.options?.config.forEach((d) => {
            if (d.team !== newTeam) {
                d.team.delete(gamePlayer);
            }
        });

        newTeam.add(gamePlayer);
        if (!alreadyInTeam) {
            configData.onJoin?.(gamePlayer);
        }
    }

    private handlePlayerLeave(
        gamePlayer: P,
        configData: RegionTeamChooserData<P>
    ) {
        if (this.options?.removeOnLeave ?? false) {
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
