import {
    DisplaySlotId,
    ScoreboardObjective,
    world,
} from "@minecraft/server";

export type SidebarScoreResolver = (index: number, total: number) => number;

/**
 * 进程内 objective 所有权。脚本重载后该表会重置，因此仍可接管世界里
 * 上一轮脚本遗留的同名 objective；但同一运行时两个组件不能同时占用同一 ID。
 */
const activeObjectiveOwners = new Map<string, symbol>();

export class SidebarScoreboardView {
    private objective?: ScoreboardObjective;
    private readonly entries = new Map<string, number>();
    private readonly owner = Symbol("SidebarScoreboardView");
    private disposed = false;

    constructor(
        private readonly objectiveId: string,
        private readonly displayName: string
    ) {
        if (activeObjectiveOwners.has(objectiveId)) {
            throw new Error(
                `Scoreboard objective "${objectiveId}" 已被另一个 SidebarScoreboardView 占用`
            );
        }
        activeObjectiveOwners.set(objectiveId, this.owner);
    }

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
        if (this.disposed) return;
        this.disposed = true;

        const errors: unknown[] = [];
        const objective = this.objective;

        try {
            this.hide();
        } catch (err) {
            errors.push(err);
        }
        try {
            if (objective?.isValid) {
                world.scoreboard.removeObjective(objective);
            }
        } catch (err) {
            errors.push(err);
        } finally {
            this.entries.clear();
            this.objective = undefined;
            if (activeObjectiveOwners.get(this.objectiveId) === this.owner) {
                activeObjectiveOwners.delete(this.objectiveId);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                `Scoreboard objective "${this.objectiveId}" 清理失败`
            );
        }
    }

    private getObjective() {
        if (this.disposed) {
            throw new Error(
                `Scoreboard objective "${this.objectiveId}" 已释放`
            );
        }
        if (this.objective?.isValid) return this.objective;

        const existing = world.scoreboard.getObjective(this.objectiveId);
        this.objective =
            existing ??
            world.scoreboard.addObjective(
                this.objectiveId,
                this.displayName
            );

        for (const participant of this.objective.getParticipants()) {
            this.objective.removeParticipant(participant);
        }
        this.entries.clear();
        return this.objective;
    }
}

function makeUniqueLines(lines: readonly string[]): string[] {
    const counts = new Map<string, number>();
    return lines.map((line) => {
        const base = line === "" ? "§r" : line;
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        return count === 0 ? base : base + "§r".repeat(count);
    });
}
