import type { CustomEventSignal } from "../gameEvent/eventSignal";
import type { Subscription } from "../gameEvent/subscription";
import type { GamePlayer } from "./gamePlayer";

export interface PlayerGroupChange<T extends GamePlayer> {
    readonly type: "added" | "removed";
    readonly player: T;
    readonly reason: string;
}

/** Minimal lazily observed event; no globally cached group membership copy. */
export class ObservableGroupSignal<E> implements CustomEventSignal<E> {
    private readonly callbacks = new Set<(event: E) => void>();

    subscribe(callback: (event: E) => void): Subscription {
        this.callbacks.add(callback);
        let active = true;
        return { unsubscribe: () => {
            if (!active) return;
            active = false;
            this.callbacks.delete(callback);
        } };
    }

    publish(event: E): void {
        for (const callback of [...this.callbacks]) {
            try { callback(event); }
            catch (error) { console.error("PlayerGroup membership callback error:", error); }
        }
    }
}

/** Observable membership changes; never emits merely because a Player is offline. */
export class GroupMembershipSignal<T extends GamePlayer>
    extends ObservableGroupSignal<PlayerGroupChange<T>> {}
