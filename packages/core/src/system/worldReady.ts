import { world } from "@minecraft/server";

let loaded = false;
const waiters = new Set<() => void>();

world.afterEvents.worldLoad.subscribe(() => {
    loaded = true;
    for (const callback of [...waiters]) {
        waiters.delete(callback);
        try {
            callback();
        } catch (error) {
            console.error("[BEGame] worldLoad callback failed:", error);
        }
    }
});

/** Whether the current script runtime has reached world.afterEvents.worldLoad. */
export function isWorldLoaded() {
    return loaded;
}

/**
 * Run once after worldLoad. If worldLoad has already fired in this runtime,
 * the callback runs immediately. Returns a cancellation function for pending work.
 */
export function runAfterWorldLoad(callback: () => void) {
    if (loaded) {
        callback();
        return () => undefined;
    }

    waiters.add(callback);
    return () => {
        waiters.delete(callback);
    };
}
