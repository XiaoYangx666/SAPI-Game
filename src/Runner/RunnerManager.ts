import { ScriptRunner } from "./scriptRunner";

export class RunnerManager {
    private runners = new Map<string, ScriptRunner>();
    private idCounter = 0;

    run(script: (runner: ScriptRunner) => Promise<void> | void): string {
        const id = `runner-${++this.idCounter}`;
        const runner = new ScriptRunner(id, (finishedId) => {
            this.runners.delete(finishedId);
        });

        this.runners.set(id, runner);
        runner.run(script);
        return id;
    }

    cancel(id: string): boolean {
        const runner = this.runners.get(id);
        if (runner) {
            runner.cancel();
            return true;
        }
        return false;
    }

    dispose() {
        for (const runner of this.runners.values()) {
            runner.cancel();
        }
        this.runners.clear();
    }

    get size(): number {
        return this.runners.size;
    }
}
