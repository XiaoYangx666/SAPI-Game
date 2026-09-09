import test from "node:test";
import assert from "node:assert/strict";
import {
    DisconnectTimeoutComponent,
    GameComponent,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
} from "../dist/main.js";
import { Duration } from "../dist/utils/index.js";
import { SAPIGameTestEngine } from "../dist/testing/index.js";

class TraceContext extends GameContext {
    constructor(config = {}) {
        super();
        this.trace = config.trace ?? [];
        this.initialPlayer = config.initialPlayer;
        this.timeoutTicks = config.timeoutTicks ?? 5;
        this.stopGameWhenEmpty = config.stopGameWhenEmpty ?? false;
        this.counter = config.counter ?? 0;
    }
}

class TracePlayer extends GamePlayer {}

class TraceComponent extends GameComponent {
    onAttach() {
        this.context.trace.push("component:attach");
    }

    onDetach() {
        this.context.trace.push("component:detach");
    }
}

class ChildState extends GameState {
    onEnter() {
        this.context.trace.push("child:enter");
    }

    onExit() {
        this.context.trace.push("child:exit");
    }
}

class RootState extends GameState {
    onEnter() {
        this.context.trace.push("root:enter");
        this.addComponent(TraceComponent);
        this.runner.runDelay(() => {
            this.context.trace.push("runner:delay");
        }, 5);
    }

    onExit() {
        this.context.trace.push("root:exit");
    }
}

class TraceGame extends GameEngine {
    static gameType = "test-trace";

    constructor(owner, key, config) {
        super(TracePlayer, owner, key, config);
    }

    buildContext(config) {
        return new TraceContext(config);
    }

    onStart() {
        this.context.trace.push("game:start");
        if (this.context.initialPlayer) {
            const joined = this.playerManager.join(this.context.initialPlayer);
            assert.equal(joined.allowed, true);
        }
        this.resetState(RootState);
    }

    onStop() {
        this.context.trace.push("game:stop");
    }
}

class DisconnectRootState extends GameState {
    onEnter() {
        this.context.trace.push("disconnect-root:enter");
        this.addComponent(DisconnectTimeoutComponent, {
            timeout: new Duration(this.context.timeoutTicks),
            stopGameWhenEmpty: this.context.stopGameWhenEmpty,
            onOffline: (id) => this.context.trace.push(`offline:${id}`),
            onOnline: (id) => this.context.trace.push(`online:${id}`),
            onTimeout: (id) => this.context.trace.push(`timeout:${id}`),
        });
    }

    onExit() {
        this.context.trace.push("disconnect-root:exit");
    }
}

class DisconnectGame extends TraceGame {
    static gameType = "test-disconnect";

    onStart() {
        this.context.trace.push("game:start");
        if (this.context.initialPlayer) {
            const joined = this.playerManager.join(this.context.initialPlayer);
            assert.equal(joined.allowed, true);
        }
        this.resetState(DisconnectRootState);
    }
}

class ReloadGame extends GameEngine {
    static gameType = "test-reload";

    constructor(owner, key, config) {
        super(TracePlayer, owner, key, config);
    }

    buildContext(config = {}) {
        const context = new TraceContext(config);
        context.players = config.players ?? [];
        return context;
    }

    onStart() {
        this.context.trace.push("reload-game:start");
        for (const player of this.context.players) {
            const joined = this.playerManager.join(player);
            assert.equal(joined.allowed, true);
        }
        this.resetState(DisconnectRootState);
    }

    onStop() {
        this.context.trace.push("reload-game:stop");
    }

    snapshot() {
        return {
            counter: this.context.counter,
            participants: this.participation.getAll(),
        };
    }
}

test("headless engine preserves Game/State/Component/Runner lifecycle ordering", async () => {
    const env = new SAPIGameTestEngine();
    env.reset();
    const trace = [];

    const game = env.startGame(TraceGame, { trace });
    assert.equal(game.lifecycle, "running");
    assert.deepEqual(trace, ["game:start", "root:enter", "component:attach"]);

    await env.advanceTicks(4);
    assert.equal(trace.includes("runner:delay"), false);
    await env.advanceTicks(1);
    assert.equal(trace.at(-1), "runner:delay");

    game.pushState(ChildState);
    assert.equal(trace.at(-1), "child:enter");

    env.stopGame(TraceGame);
    assert.equal(game.lifecycle, "disposed");
    assert.deepEqual(trace.slice(-5), [
        "child:enter",
        "game:stop",
        "child:exit",
        "root:exit",
        "component:detach",
    ]);

    await env.advanceTicks(100);
    assert.equal(trace.filter((item) => item === "runner:delay").length, 1);
    env.reset();
});

test("disconnect grace period can reconnect before timeout or leave after timeout", async () => {
    const env = new SAPIGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");

    const game = env.startGame(DisconnectGame, {
        trace,
        initialPlayer: alice,
        timeoutTicks: 5,
        stopGameWhenEmpty: true,
    });

    assert.equal(game.participation.has("alice"), true);
    env.disconnectPlayer("alice");
    assert.equal(trace.at(-1), "offline:alice");

    await env.advanceTicks(4);
    assert.equal(game.participation.has("alice"), true);

    const reconnected = env.connectPlayer("alice", "Alice");
    assert.equal(reconnected, alice, "reconnect keeps a stable Player wrapper");
    assert.equal(trace.at(-1), "online:alice");

    await env.advanceTicks(2);
    assert.equal(game.participation.has("alice"), true);
    assert.equal(trace.includes("timeout:alice"), false);

    env.disconnectPlayer("alice");
    await env.advanceTicks(5);

    assert.equal(trace.includes("timeout:alice"), true);
    assert.equal(game.participation.has("alice"), false);
    assert.equal(env.getGame(DisconnectGame), undefined);
    assert.equal(game.lifecycle, "disposed");
    env.reset();
});

test("reload keeps virtual world players but rebuilds game runtime from snapshot", async () => {
    const env = new SAPIGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");
    const bob = env.connectPlayer("bob", "Bob");

    const before = env.startGame(ReloadGame, {
        trace,
        players: [alice, bob],
        counter: 42,
        timeoutTicks: 5,
    });
    assert.deepEqual(before.participation.getAll().sort(), ["alice", "bob"]);

    const after = await env.reload({
        snapshot: () => before.snapshot(),
        restore: (snapshot) => {
            const players = snapshot.participants.map((id) => env.getPlayer(id));
            return env.startGame(ReloadGame, {
                trace,
                players,
                counter: snapshot.counter,
                timeoutTicks: 5,
            });
        },
    });

    assert.notEqual(after, before);
    assert.equal(before.lifecycle, "disposed");
    assert.equal(after.lifecycle, "running");
    assert.equal(after.context.counter, 42);
    assert.deepEqual(after.participation.getAll().sort(), ["alice", "bob"]);
    assert.equal(env.getPlayer("alice"), alice);
    assert.equal(env.getPlayer("bob"), bob);
    assert.equal(alice.isValid, true);
    assert.equal(bob.isValid, true);
    assert.equal(trace.includes("reload-game:stop"), false, "reload uses silent dispose, not normal onStop");
    env.reset();
});
