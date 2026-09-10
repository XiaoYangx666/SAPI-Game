import {
    DisplaySlotId,
    ScoreboardObjective,
    system,
    world,
} from "@minecraft/server";
import { GamePlayer, PlayerGroup } from "@sapi-game/gamePlayer";
import { GameState } from "@sapi-game/gameState";
import { GameComponent } from "../gameComponent";

export interface TeamScoreBoardTeamData<T extends GamePlayer = GamePlayer> {
    /**队伍对象 */
    team: PlayerGroup<T>;
    /**前缀 */
    prefix?: string;
    /**自定义方法，会覆盖前缀 */
    buildName?: (player: T) => string;
    /**同组排序方法 */
    teamSort?: (p1: T, p2: T) => number;
    /**组内过滤 */
    teamFilter?: (p: T) => boolean;
    /** 展示失效玩家(默认否)*/
    showInvalid?: boolean;
}

export interface TeamScoreBoardOptions<P extends GamePlayer> {
    /**计分板名 */
    scoreboardName: string;
    /**计分板显示名 */
    displayName: string;
    /**传入队伍数组 */
    teams: TeamScoreBoardTeamData<P>[];
}

export class TeamScoreBoard<P extends GamePlayer> extends GameComponent<
    GameState<P>,
    TeamScoreBoardOptions<P>
> {
    private obj?: ScoreboardObjective;
    private lastRefresh: number = 0;

    override onAttach(): void {
        if (!this.options) return;
        this.reset();
    }

    private getObj() {
        if (this.obj && this.obj.isValid) return this.obj;
        this.obj =
            world.scoreboard.getObjective(this.options!.scoreboardName) ??
            world.scoreboard.addObjective(
                this.options!.scoreboardName,
                this.options!.displayName
            );
        return this.obj;
    }

    private reset() {
        const obj = this.getObj();
        const isDisplay =
            world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar)
                ?.objective.id == obj.id;
        world.scoreboard.removeObjective(obj);
        if (isDisplay) {
            this.show();
        }
    }

    /**显示 */
    show() {
        if (!this.options) return;
        world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
            objective: this.getObj(),
        });
    }

    /**刷新选队计分板 */
    refreshScoreBoard() {
        if (!this.options) return;
        if (this.lastRefresh == system.currentTick) return;
        //清空计分板
        this.reset();
        //构建计分项
        const scores: string[] = [];
        const teams = this.options.teams;
        for (const team of teams) {
            let sortedTeam = team.team.getAll();
            //过滤
            if (team.teamFilter) {
                sortedTeam = sortedTeam.filter(team.teamFilter);
            }
            //排序
            if (team.teamSort) {
                sortedTeam.sort(team.teamSort);
            }
            sortedTeam.forEach((p) => {
                if (!(team.showInvalid ?? false) && !p.isValid) {
                    return;
                }
                const text = team.buildName
                    ? team.buildName(p)
                    : (team.prefix ?? "") + p.name;
                scores.push(text);
            });
        }
        //设置积分项
        const obj = this.getObj();
        for (let i = 0; i < scores.length; i++) {
            obj.setScore(scores[i], i);
        }
        this.lastRefresh = system.currentTick;
    }

    override onDetach(): void {
        if (this.obj?.isValid) {
            world.scoreboard.removeObjective(this.obj);
        }
    }
}
