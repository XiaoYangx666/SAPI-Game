import {
    DisplaySlotId,
    ScoreboardObjective,
    world,
} from "@minecraft/server";

export type SidebarScoreResolver = (index: number, total: number) => number;

/**
 * 侧边栏 objective 的轻量资源管理器。
 *
 * - objective 在组件生命周期内保持稳定，不再通过 remove/recreate 刷新内容；
 * - 只增量删除/更新当前管理的行；
 * - 同名行会自动追加不可见格式码，避免 scoreboard participant 冲突；
 * - dispose 时主动释放 sidebar 槽位并删除 objective。
 */
export class SidebarScoreboardView {
    private objective?: ScoreboardObjective;
    private readonly entries = new Map<string, number>();

    constructor(
        private readonly objectiveId: string,
        private readonly displayName: string
    ) {}

    get isShown() {
        const objective = this.objective;
        if (!objective?.isValid) return false;
        return (
            world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar)
                ?.objective.id === objective.id
        );
    }

    show() {
        world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
            objective: this.getObjective(),
        });
    }

    hide() {
        const objective = this.objective;
        if (!objective?.isValid) return;
        const current =
            world.scoreboard.getObjectiveAtDisplaySlot(DisplaySlotId.Sidebar)
                ?.objective;
        if (current?.id === objective.id) {
            world.scoreboard.clearObjectiveAtDisplaySlot(
                DisplaySlotId.Sidebar
            );
        }
    }

    clear() {
        const objective = this.getObjective();
        for (const participant of this.entries.keys()) {
            objective.removeParticipant(participant);
        }
        this.entries.clear();
    }

    updateLines(lines: readonly string[], score: SidebarScoreResolver) {
        const objective = this.getObjective();
        const rendered = makeUniqueLines(lines);
        const next = new Map<string, number>();

        for (let i = 0; i < rendered.length; i++) {
            next.set(rendered[i], score(i, rendered.length));
        }

        for (const participant of this.entries.keys()) {
            if (!next.has(participant)) {
                objective.removeParticipant(participant);
            }
        }

        for (const [participant, value] of next) {
            if (this.entries.get(participant) !== value) {
                objective.setScore(participant, value);
            }
        }

        this.entries.clear();
        for (const entry of next) this.entries.set(...entry);
    }

    dispose() {
        this.hide();
        const objective = this.objective;
        this.entries.clear();
        this.objective = undefined;
        if (objective?.isValid) {
            world.scoreboard.removeObjective(objective);
        }
    }

    private getObjective() {
        if (this.objective?.isValid) return this.objective;

        const existing = world.scoreboard.getObjective(this.objectiveId);
        this.objective =
            existing ??
            world.scoreboard.addObjective(
                this.objectiveId,
                this.displayName
            );

        // 兼容脚本重载后遗留的同名 objective：接管时只清空参与项，
        // 不通过删除 objective 触发 sidebar 闪烁。
        for (const participant of this.objective.getParticipants()) {
            this.objective.removeParticipant(participant);
        }
        this.entries.clear();
        return this.objective;
    }
}

/**
 * Scoreboard fake participant 名必须唯一；重复文本在末尾追加 §r，
 * 空行则用纯格式码占位，视觉上保持不变。
 */
function makeUniqueLines(lines: readonly string[]): string[] {
    const counts = new Map<string, number>();
    return lines.map((line) => {
        const base = line === "" ? "§r" : line;
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        return count === 0 ? base : base + "§r".repeat(count);
    });
}
