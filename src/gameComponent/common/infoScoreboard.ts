import { DisplaySlotId, ScoreboardObjective, world } from "@minecraft/server";
import { GameState } from "@sapi-game/gameState";
import { GameComponent } from "../gameComponent";

interface infoScoreboardOptions {
    /**计分板名 */
    scoreBoardName: string;
    /**计分板显示名字 */
    displayName: string;
    /**内容的左侧边距 */
    paddingLeft?: number;
    /**头部 */
    header?: () => string[];
    /**底部 */
    footer?: () => string[];
    /**是否立即显示计分板 */
    showOnAttach: boolean;
}

/**信息侧边栏 */
export class InfoScoreboard extends GameComponent<
    GameState,
    infoScoreboardOptions
> {
    private objective: ScoreboardObjective | undefined;
    private initCode = 48;

    getObj() {
        if (this.objective && this.objective.isValid) return this.objective;
        const name = this.options!.scoreBoardName;
        this.objective =
            world.scoreboard.getObjective(name) ??
            world.scoreboard.addObjective(name, this.options!.displayName);
        return this.objective;
    }

    override onAttach(): void {
        if (!this.options) {
            throw new Error("无options");
        }
        if (this.options.showOnAttach) {
            this.show();
        }
    }

    override onDetach(): void {
        if (this.objective?.isValid) {
            world.scoreboard.removeObjective(this.objective);
        }
    }

    /**手动显示计分板 */
    show() {
        if (!this.options) return;
        world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
            objective: this.getObj(),
        });
    }

    /**更新计分板内容 */
    updateLines(lines: string[]) {
        if (!this.options) return;
        const sb = this.getObj();
        const isDisplay =
            world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar)
                ?.objective.id == sb.id;
        world.scoreboard.removeObjective(sb);
        //如果正在显示就恢复显示
        if (isDisplay) {
            this.show();
        }
        //预处理
        let blankCode = this.initCode;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === "") {
                lines[i] = "§" + String.fromCodePoint(blankCode++);
            }
            lines[i] = " ".repeat(this.options.paddingLeft ?? 0) + lines[i];
        }
        //加上header和footer
        const header = this.options?.header;
        const footer = this.options?.footer;
        if (header) {
            lines.unshift(...header());
        }
        if (footer) {
            lines.push(...footer());
        }
        //设置
        for (let i = 0; i < lines.length; i++) {
            sb.setScore(lines[i], lines.length - i - 1);
        }
    }
}
