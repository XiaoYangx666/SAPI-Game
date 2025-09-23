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
        return system.waitTicks(ticks);
    }

    async do<T>(fn: () => T | Promise<T>): Promise<T> {
        this.checkCancelled();
        return await fn();
    }

    async runSteps(steps: Array<() => unknown | Promise<unknown>>): Promise<void> {
        for (const step of steps) {
            this.checkCancelled();

            await this.do(step);
        }
    }

    async doDelay<T>(fn: () => T | Promise<T>, ticks: number): Promise<T> {
        await this.wait(ticks);
        return await this.do(fn);
    }

    cancel() {
        this.cancelled = true;
    }

    async run(script: (r: ScriptRunner) => Promise<void> | void): Promise<void> {
        try {
            await script(this);
        } catch (e) {
            if (!(e instanceof ScriptCancelledError)) {
                console.error(
                    `Runner ${this.id} encountered an error:`,
                    e,
                    e instanceof Error ? e.stack : ""
                );
            }
        } finally {
            this.onFinish(this.id);
        }
    }

    isCancelled(): boolean {
        return this.cancelled;
    }
}
