import { system } from "@minecraft/server";
import { GamePlayer, PlayerGroup } from "@sapi-game/gamePlayer";
import { GameState } from "@sapi-game/gameState";
import { GameComponent } from "../gameComponent";
import { SidebarScoreboardView } from "./sidebarScoreboard";

export interface TeamScoreBoardTeamData<T extends GamePlayer = GamePlayer> {
    /** 队伍对象。 */
    team: PlayerGroup<T>;
    /** 前缀。 */
    prefix?: string;
    /** 自定义方法，会覆盖前缀。 */
    buildName?: (player: T) => string;
    /** 同组排序方法。 */
    teamSort?: (p1: T, p2: T) => number;
    /** 组内过滤。 */
    teamFilter?: (p: T) => boolean;
    /** 展示失效玩家，默认否。 */
    showInvalid?: boolean;
}

export interface TeamScoreBoardOptions<P extends GamePlayer> {
    /** 计分板名。 */
    scoreboardName: string;
    /** 计分板显示名。 */
    displayName: string;
    /** 传入队伍数组。 */
    teams: TeamScoreBoardTeamData<P>[];
}

export class TeamScoreBoard<P extends GamePlayer> extends GameComponent<
    GameState<P>,
    TeamScoreBoardOptions<P>
> {
    private view?: SidebarScoreboardView;
    private lastRefresh = -1;

    override onAttach(): void {
        if (!this.options) return;
        this.view = new SidebarScoreboardView(
            this.options.scoreboardName,
            this.options.displayName
        );
        this.view.clear();
    }

    override onDetach(): void {
        this.view?.dispose();
        this.view = undefined;
    }

    /** 显示。 */
    show() {
        this.view?.show();
    }

    /** 隐藏但保留当前内容。 */
    hide() {
        this.view?.hide();
    }

    /** 刷新选队计分板；同一 tick 内重复调用只执行一次。 */
    refreshScoreBoard() {
        if (!this.options || !this.view) return;
        if (this.lastRefresh === system.currentTick) return;

        const scores: string[] = [];
        for (const team of this.options.teams) {
            let players = team.team.getAll();

            if (team.teamFilter) {
                players = players.filter(team.teamFilter);
            }
            if (team.teamSort) {
                players.sort(team.teamSort);
            }

            for (const player of players) {
                if (!(team.showInvalid ?? false) && !player.isValid) continue;
                scores.push(
                    team.buildName
                        ? team.buildName(player)
                        : (team.prefix ?? "") + player.name
                );
            }
        }

        // 保留旧 TeamScoreBoard 的分数顺序：第一个条目为 0，后续递增。
        this.view.updateLines(scores, (index) => index);
        this.lastRefresh = system.currentTick;
    }
}
