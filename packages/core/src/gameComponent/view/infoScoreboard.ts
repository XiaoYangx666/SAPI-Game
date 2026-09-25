import { GameState } from "@sapi-game/gameState/gameState";
import { GameComponent } from "../gameComponent";
import { SidebarScoreboardView } from "./sidebarScoreboard";

export interface infoScoreboardOptions {
    /** 计分板名。 */
    scoreBoardName: string;
    /** 计分板显示名字。 */
    displayName: string;
    /** 内容的左侧边距。 */
    paddingLeft?: number;
    /** 头部。 */
    header?: () => string[];
    /** 底部。 */
    footer?: () => string[];
    /** 是否立即显示计分板。 */
    showOnAttach: boolean;
}

/** 信息侧边栏。 */
export class InfoScoreboard extends GameComponent<
    GameState,
    infoScoreboardOptions
> {
    private view?: SidebarScoreboardView;

    override onAttach(): void {
        if (!this.options) {
            throw new Error("InfoScoreboard 缺少 options");
        }
        this.view = new SidebarScoreboardView(
            this.options.scoreBoardName,
            this.options.displayName
        );
        // 立即接管/清空可能由上次脚本生命周期留下的同名 objective。
        this.view.clear();

        if (this.options.showOnAttach) {
            this.show();
        }
    }

    override onDetach(): void {
        this.view?.dispose();
        this.view = undefined;
    }

    /** 手动显示计分板。 */
    show() {
        this.view?.show();
    }

    /** 隐藏计分板但保留当前内容。 */
    hide() {
        this.view?.hide();
    }

    /** 更新计分板内容；隐藏状态下也会更新，下次 show 时直接显示最新内容。 */
    updateLines(lines: readonly string[]) {
        if (!this.options || !this.view) return;

        const padding = " ".repeat(this.options.paddingLeft ?? 0);
        const body = lines.map((line) => padding + line);
        const rendered = [
            ...(this.options.header?.() ?? []),
            ...body,
            ...(this.options.footer?.() ?? []),
        ];

        this.view.updateLines(
            rendered,
            (index, total) => total - index - 1
        );
    }
}
