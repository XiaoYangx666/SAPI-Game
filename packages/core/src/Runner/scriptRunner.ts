import { system } from "@minecraft/server";

export class ScriptCancelledError extends Error {
    constructor(id: string) {
        super(`ScriptRunner with ID '${id}' was cancelled.`);
        this.name = "ScriptCancelledError";
    }
}

/**
 * Settlement handle for one pending `system.waitTicks` call.
 *
 * `system.waitTicks` cannot be cancelled: the engine keeps its timer and the
 * promise pending until the requested ticks elapse, and it retains whatever is
 * attached to that promise for the whole delay. Attaching a closure that
 * captures the `ScriptRunner` therefore pinned the runner — and through its
 * `onFinish` callback the whole RunnerManager → State → Game graph — until the
 * delay expired (a BGM replay cycle is ~117 s).
 *
 * This box deliberately holds no reference back to the runner. The engine's
 * pending promise retains only the box; `cancel()` settles it immediately so the
 * awaiting script unwinds and the rest of the graph becomes collectable.
 */
interface WaitHandle {
    arm(resolve: () => void, reject: (error: unknown) => void): void;
    fulfil(): void;
    fail(error: unknown): void;
    cancel(): void;
}

function createWaitHandle(): WaitHandle {
    let resolveFn: (() => void) | undefined;
    let rejectFn: ((error: unknown) => void) | undefined;
    let settled = false;
    return {
        arm(resolve, reject) {
            resolveFn = resolve;
            rejectFn = reject;
        },
        fulfil() {
            if (settled) return;
            settled = true;
            const resolve = resolveFn;
            resolveFn = undefined;
            rejectFn = undefined;
            resolve?.();
        },
        fail(error) {
            if (settled) return;
            settled = true;
            const reject = rejectFn;
            resolveFn = undefined;
            rejectFn = undefined;
            reject?.(error);
        },
        cancel() {
            if (settled) return;
            settled = true;
            const reject = rejectFn;
            resolveFn = undefined;
            rejectFn = undefined;
            reject?.(new ScriptCancelledError("cancelled"));
        },
    };
}

export class ScriptRunner {
    private cancelled = false;
    /** Handles parked on `system.waitTicks`, settled early by `cancel()`. */
    private waitHandles: Set<WaitHandle> | undefined;

    constructor(public readonly id: string, private readonly onFinish: (id: string) => void) {}

    private checkCancelled() {
        if (this.cancelled) {
            throw new ScriptCancelledError(this.id);
        }
    }

    async wait(ticks: number): Promise<void> {
        this.checkCancelled();

        const handle = createWaitHandle();
        const handles = (this.waitHandles ??= new Set());
        handles.add(handle);
        try {
            await new Promise<void>((resolve, reject) => {
                handle.arm(resolve, reject);
                // Only `handle` is captured here, never `this`.
                system.waitTicks(ticks).then(
                    () => handle.fulfil(),
                    (error) => handle.fail(error)
                );
            });
        } finally {
            handles.delete(handle);
        }
        // Cancellation may have raced a successful wait.
        this.checkCancelled();
    }

    do<T>(fn: () => T): T;

    do<T>(fn: () => Promise<T>): Promise<T>;

    do<T>(fn: () => T | Promise<T>): Promise<T> | T {
        this.checkCancelled();
        return fn();
    }

    async runSteps(steps: Array<() => void | Promise<void>>): Promise<void> {
        for (const step of steps) {
            await this.do(step);
        }
    }

    async doDelay<T>(fn: () => T | Promise<T>, ticks: number): Promise<T> {
        await this.wait(ticks);
        return this.do(fn);
    }

    cancel() {
        if (this.cancelled) return;
        this.cancelled = true;
        const handles = this.waitHandles;
        this.waitHandles = undefined;
        if (!handles) return;
        for (const handle of [...handles]) {
            try {
                handle.cancel();
            } catch {
                // One uncooperative waiter must not block the others.
            }
        }
    }

    async run(script: (r: ScriptRunner) => Promise<void> | void): Promise<void> {
        try {
            await script(this);
        } catch (e) {
            if (!(e instanceof ScriptCancelledError)) {
                throw e;
            }
        } finally {
            this.onFinish(this.id);
        }
    }

    isCancelled(): boolean {
        return this.cancelled;
    }
}
