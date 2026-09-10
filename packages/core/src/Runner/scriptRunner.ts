import { system } from "@minecraft/server";

export class ScriptCancelledError extends Error {
    constructor(id: string) {
        super(`ScriptRunner with ID '${id}' was cancelled.`);
        this.name = "ScriptCancelledError";
    }
}

export class ScriptRunner {
    private cancelled = false;

    constructor(public readonly id: string, private readonly onFinish: (id: string) => void) {}

    private checkCancelled() {
        if (this.cancelled) {
            throw new ScriptCancelledError(this.id);
        }
    }

    async wait(ticks: number): Promise<void> {
        this.checkCancelled();
        return new Promise(async (resolve, reject) => {
            await system.waitTicks(ticks);
            if (this.cancelled) {
                reject(new ScriptCancelledError(this.id));
            } else {
                resolve();
            }
        });
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
        this.cancelled = true;
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
