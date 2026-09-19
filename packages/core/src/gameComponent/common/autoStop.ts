import type { CustomEventSignal } from "../../gameEvent/eventSignal";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

/**
 * A room membership policy, not a disconnect policy.
 * Default membership is this game's Participation (offline players remain
 * members until the configured disconnect policy explicitly releases them).
 */
export interface AutoStopOptions {
    /** Default true. A newly created room does not stop until it has had members. */
    stopWhenEmpty?: boolean;
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
    private hasBeenNonEmpty = false;
    private pendingCheck?: string;

    protected override onAttach(): void {
        if (this.options?.getMemberIds && !this.options.memberChanged) {
            throw new Error("AutoStopComponent requires memberChanged for a custom member source");
        }

        this.hasBeenNonEmpty = this.getMemberIds().length > 0;
        if (this.options?.memberChanged) {
            this.subscribe(this.options.memberChanged, () => this.observeAndReconcile());
        } else {
            this.subscribe(this.state.participation.changed, () => this.observeAndReconcile());
        }
    }

    private observeAndReconcile(): void {
        // Record the first real membership as soon as it occurs, even if join
        // and leave happen in the same tick before the deferred check runs.
        if (this.getMemberIds().length > 0) this.hasBeenNonEmpty = true;
        this.reconcile();
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
        const members = this.getMemberIds();
        if (members.length > 0) {
            this.hasBeenNonEmpty = true;
            return;
        }
        if (!this.hasBeenNonEmpty || this.options?.stopWhenEmpty === false) return;
        if (this.options?.canStop?.() === false) return;

        // Current state, not the reason for the most recent event, is authoritative.
        this.state.stopGame("auto-stop-empty");
    }

    private getMemberIds(): readonly string[] {
        return this.options?.getMemberIds?.() ?? this.state.participation.getAll();
    }

    protected override onDetach(): void {
        if (this.pendingCheck !== undefined) {
            this.runner.cancel(this.pendingCheck, "autostop-detach");
            this.pendingCheck = undefined;
        }
    }
}
