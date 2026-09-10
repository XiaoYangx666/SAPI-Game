import { expect, test, vi } from "vitest";
import {
    Game,
    GameContext,
    GameEngine,
    GamePlayer,
    initBEGame,
} from "../packages/core/dist/main.js";
import { BEGameTestEngine } from "../packages/test/dist/index.js";

class StorePlayer extends GamePlayer {}
class StoreContext extends GameContext {}

class StoreGame extends GameEngine {
    static gameType = "trace-store-test";
    constructor(owner, key, config) {
        super(StorePlayer, owner, key, config);
    }
    buildContext() {
        return new StoreContext();
    }
    onStart() {}
    onStop() {}
}

test("WorldTraceStore can be configured and toggled at runtime without truncating an accepted session", async () => {
    const env = new BEGameTestEngine();
    Game.trace.store.disable();
    env.reset();

    try {
        initBEGame({
            traceStore: {
                enabled: true,
                maxSessions: 10,
                maxBytes: 256 * 1024,
                maxAgeMs: 60_000,
                cleanupIntervalTicks: 20,
            },
        });
        expect(Game.trace.store.enabled).toBe(true);

        env.startGame(StoreGame, undefined, "first");
        // Runtime disable affects new sessions only. The already accepted first
        // session must still receive its final chunk/footer.
        Game.trace.store.disable();
        env.stopGame(StoreGame, "first");

        const firstSummary = Game.trace.store
            .list()
            .find((entry) => entry.gameKey === "trace-store-test:first");
        expect(firstSummary?.status).toBe("completed");
        expect(firstSummary?.chunkCount).toBeGreaterThan(0);

        const beforeDisabledGame = Game.trace.store.list().length;
        env.startGame(StoreGame, undefined, "disabled");
        env.stopGame(StoreGame, "disabled");
        expect(Game.trace.store.list()).toHaveLength(beforeDisabledGame);

        Game.trace.store.enable();
        env.startGame(StoreGame, undefined, "third");
        env.stopGame(StoreGame, "third");
        const thirdSummary = Game.trace.store
            .list()
            .find((entry) => entry.gameKey === "trace-store-test:third");
        expect(thirdSummary?.status).toBe("completed");

        // Once worldLoad has fired, runtime reconfiguration can clean up
        // immediately; only early-execution initialization is gated on worldLoad.
        Game.trace.store.configure({ maxSessions: 1 });
        expect(Game.trace.store.list()).toHaveLength(1);

        const stored = Game.trace.store.list()[0];
        const bytes = Game.trace.store.toBytes(stored.sessionId);
        expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("BEGT");

        const warnings = [];
        const warn = vi
            .spyOn(console, "warn")
            .mockImplementation((message) => warnings.push(String(message)));
        const exported = Game.trace.exportToConsole(stored.sessionId);
        warn.mockRestore();

        expect(exported.binaryBytes).toBe(bytes.length);
        expect(exported.partCount).toBeGreaterThanOrEqual(1);
        expect(warnings).toHaveLength(exported.partCount);
        expect(warnings[0]).toMatch(
            new RegExp(
                `^\\[BEGAME_TRACE:v1:${stored.sessionId}:1/${exported.partCount}\\]`
            )
        );

        initBEGame({ traceStore: false });
        expect(Game.trace.store.enabled).toBe(false);
        // Disabling persistence never deletes existing history.
        expect(Game.trace.store.list()).toHaveLength(1);
    } finally {
        Game.trace.store.disable();
        env.reset();
    }
});
