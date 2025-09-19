import { system } from "@minecraft/server";

/**
 * A custom error thrown when a ScriptRunner's execution is cancelled.
 * This allows cancellation to be handled as a specific control flow event, not a generic error.
 */
export class ScriptCancelledError extends Error {
    constructor(id: string) {
        super(`ScriptRunner with ID '${id}' was cancelled.`);
        this.name = "ScriptCancelledError";
    }
}

export class ScriptRunner {
    private cancelled = false;

    constructor(
        public readonly id: string,
        private readonly onFinish: (id: string) => void
    ) {}

    private checkCancelled() {
        if (this.cancelled) {
            throw new ScriptCancelledError(this.id);
        }
    }

    async wait(ticks: number): Promise<void> {
        this.checkCancelled();
        return system.waitTicks(ticks);
    }

    async do(fn: () => void | Promise<void>): Promise<void> {
        this.checkCancelled();
        await fn();
    }

    async step(
        fn: () => void | Promise<void>,
        delayTicks: number
    ): Promise<void> {
        await this.do(fn);
        await this.wait(delayTicks);
    }

    cancel() {
        this.cancelled = true;
    }

    async run(
        script: (r: ScriptRunner) => Promise<void> | void
    ): Promise<void> {
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
