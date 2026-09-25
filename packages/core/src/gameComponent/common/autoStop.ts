import type { CustomEventSignal } from "../../gameEvent/eventSignal";
import type { PlayerGroupSet } from "../../gamePlayer/groupSet";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

/**
 * A room membership policy, not a disconnect policy.
 * Default membership is this game's Participation (offline players remain
 * members until the configured disconnect policy explicitly releases them).
 */
export interface AutoStopOptions {
    /** Default true. Empty rooms are reclaimed even if nobody ever joined. */
    stopWhenEmpty?: boolean;
    /**
     * Optional explicitly managed membership scope. For games with a disconnect
     * grace period, do not use groups that clearInvalid() purges while offline;
     * use Participation (the default) or retain offline members in the group.
     */
    groupSet?: PlayerGroupSet<any, any>;
    /** Optional alternate membership source, e.g. a real lobby roster. */
    getMemberIds?: () => readonly string[];
    /** Required when getMemberIds is customized; must report every real mutation. */
    memberChanged?: CustomEventSignal<unknown>;
    /** Business veto (e.g. finish an in-progress round before stopping). */
    canStop?: () => boolean;
}

export class AutoStopComponent<
    S extends GameState<any, any> = GameState<any, any>
> extends GameComponent<S, AutoStopOptions> {
    private pendingCheck?: string;
    private periodicCheck?: string;
    private static readonly CHECK_INTERVAL_TICKS = 20 * 10;

    protected override onAttach(): void {
        const customMembers = this.options?.getMemberIds !== undefined;
        const customChanges = this.options?.memberChanged !== undefined;
        if (customMembers !== customChanges) {
            throw new Error(
                "AutoStopComponent requires getMemberIds and memberChanged to be configured together"
            );
        }
        if (customMembers && this.options?.groupSet) {
            throw new Error(
                "AutoStopComponent accepts either groupSet or a custom member source, not both"
            );
        }

        // Preserve a startup window for synchronous/asynchronous initial seating.
        // A room that stays empty is still reclaimed by the first periodic pass.
        this.schedulePeriodicCheck();
        if (this.options?.memberChanged) {
            this.subscribe(this.options.memberChanged, () => this.observeAndReconcile());
        } else if (this.options?.groupSet) {
            this.subscribe(this.options.groupSet.changed, () => this.observeAndReconcile());
            // A group can retain stale wrappers after participation release.
            // A scoped member must belong to BOTH the group and this Game.
            this.subscribe(this.state.participation.changed, () => this.observeAndReconcile());
        } else {
            this.subscribe(this.state.participation.changed, () => this.observeAndReconcile());
        }
    }

    private observeAndReconcile(): void {
        this.reconcile();
    }

    private schedulePeriodicCheck(): void {
        if (!this.isAttached || !this.state.isGameActive || this.periodicCheck !== undefined) return;
        this.periodicCheck = this.runner.runDelay(() => {
            this.periodicCheck = undefined;
            this.checkNow();
            // stopGame() can synchronously detach this component.
            this.schedulePeriodicCheck();
        }, AutoStopComponent.CHECK_INTERVAL_TICKS);
    }

    /** Idempotently request a fresh check, including after canStop() changes. */
    reconcile(): void {
        if (!this.isAttached || this.pendingCheck !== undefined) return;
        this.pendingCheck = this.runner.runDelay(() => {
            this.pendingCheck = undefined;
            this.checkNow();
        }, 1);
    }

    private checkNow(): void {
        if (!this.isAttached || !this.state.isGameActive) return;
        if (this.options?.stopWhenEmpty === false) return;
        if (this.hasMembers()) return;
        if (this.options?.canStop?.() === false) return;

        // Current state, not the reason for the most recent event, is authoritative.
        this.state.stopGame("auto-stop-empty");
    }

    private hasMembers(): boolean {
        const custom = this.options?.getMemberIds;
        if (custom) return custom().length > 0;

        const groupSet = this.options?.groupSet;
        if (groupSet) {
            return groupSet.some((player) =>
                this.state.participation.has(player.id)
            );
        }

        return this.state.participation.hasAny;
    }

    protected override onDetach(): void {
        if (this.pendingCheck !== undefined) {
            this.runner.cancel(this.pendingCheck, "autostop-detach");
            this.pendingCheck = undefined;
        }
        if (this.periodicCheck !== undefined) {
            this.runner.cancel(this.periodicCheck, "autostop-detach");
            this.periodicCheck = undefined;
        }
    }
}
