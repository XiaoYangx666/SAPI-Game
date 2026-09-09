import { expect, test } from "vitest";
import {
    DisconnectTimeoutComponent,
    GameComponent,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
} from "../packages/core/dist/main.js";
import { Duration } from "../packages/core/dist/utils/index.js";
import { BEGameTestEngine } from "../packages/test/dist/index.js";

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
    onAttach() { this.context.trace.push("component:attach"); }
    onDetach() { this.context.trace.push("component:detach"); }
}

class ChildState extends GameState {
    onEnter() { this.context.trace.push("child:enter"); }
    onExit() { this.context.trace.push("child:exit"); }
}

class RootState extends GameState {
    onEnter() {
        this.context.trace.push("root:enter");
        this.addComponent(TraceComponent);
        this.runner.runDelay(() => this.context.trace.push("runner:delay"), 5);
    }
    onExit() { this.context.trace.push("root:exit"); }
}

class TraceGame extends GameEngine {
    static gameType = "test-trace";
    constructor(owner, key, config) { super(TracePlayer, owner, key, config); }
    buildContext(config) { return new TraceContext(config); }
    onStart() {
        this.context.trace.push("game:start");
        if (this.context.initialPlayer) {
            expect(this.playerManager.join(this.context.initialPlayer).allowed).toBe(true);
        }
        this.resetState(RootState);
    }
    onStop() { this.context.trace.push("game:stop"); }
}

class DisconnectRootState extends GameState {
    onEnter() {
        this.context.trace.push("disconnect-root:enter");
        this.addComponent(DisconnectTimeoutComponent, {
            timeout: new Duration(this.context.timeoutTicks),
            releaseOnTimeout: true,
            stopGameWhenEmpty: this.context.stopGameWhenEmpty,
            onOffline: (id) => this.context.trace.push(`offline:${id}`),
            onOnline: (id) => this.context.trace.push(`online:${id}`),
            onTimeout: (id) => this.context.trace.push(`timeout:${id}`),
        });
    }
    onExit() { this.context.trace.push("disconnect-root:exit"); }
}

class DisconnectGame extends TraceGame {
    static gameType = "test-disconnect";
    onStart() {
        this.context.trace.push("game:start");
        if (this.context.initialPlayer) {
            expect(this.playerManager.join(this.context.initialPlayer).allowed).toBe(true);
        }
        this.resetState(DisconnectRootState);
    }
}

class ReloadGame extends GameEngine {
    static gameType = "test-reload";
    constructor(owner, key, config) { super(TracePlayer, owner, key, config); }
    buildContext(config = {}) {
        const context = new TraceContext(config);
        context.players = config.players ?? [];
        return context;
    }
    onStart() {
        this.context.trace.push("reload-game:start");
        for (const player of this.context.players) {
            expect(this.playerManager.join(player).allowed).toBe(true);
        }
        this.resetState(DisconnectRootState);
    }
    onStop() { this.context.trace.push("reload-game:stop"); }
    snapshot() {
        return { counter: this.context.counter, participants: this.participation.getAll() };
    }
}

class FailingState extends GameState {
    onEnter() {
        this.context.trace.push("failing:enter");
        this.addComponent(TraceComponent);
        throw new Error("intentional state failure");
    }
}

class FailingGame extends TraceGame {
    static gameType = "test-failing";
    onStart() {
        this.context.trace.push("game:start");
        if (this.context.initialPlayer) {
            expect(this.playerManager.join(this.context.initialPlayer).allowed).toBe(true);
        }
        this.resetState(FailingState);
    }
}

class DaemonGame extends TraceGame {
    static gameType = "test-daemon";
    get isDaemon() { return true; }
}

test("headless engine preserves Game/State/Component/Runner lifecycle ordering", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const game = env.startGame(TraceGame, { trace });
    expect(game.lifecycle).toBe("running");
    expect(trace).toEqual(["game:start", "root:enter", "component:attach"]);
    await env.advanceTicks(4);
    expect(trace).not.toContain("runner:delay");
    await env.advanceTicks(1);
    expect(trace.at(-1)).toBe("runner:delay");
    game.pushState(ChildState);
    expect(trace.at(-1)).toBe("child:enter");
    env.stopGame(TraceGame);
    expect(game.lifecycle).toBe("disposed");
    expect(trace.slice(-5)).toEqual(["child:enter", "game:stop", "child:exit", "root:exit", "component:detach"]);
    await env.advanceTicks(100);
    expect(trace.filter((item) => item === "runner:delay")).toHaveLength(1);
    env.reset();
});

test("disconnect grace period can reconnect before timeout or leave after timeout", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");
    const game = env.startGame(DisconnectGame, {
        trace,
        initialPlayer: alice,
        timeoutTicks: 5,
        stopGameWhenEmpty: true,
    });
    expect(game.participation.has("alice")).toBe(true);
    env.disconnectPlayer("alice");
    expect(trace.at(-1)).toBe("offline:alice");
    await env.advanceTicks(4);
    expect(game.participation.has("alice")).toBe(true);
    expect(env.connectPlayer("alice", "Alice")).toBe(alice);
    expect(trace.at(-1)).toBe("online:alice");
    await env.advanceTicks(2);
    expect(trace).not.toContain("timeout:alice");
    env.disconnectPlayer("alice");
    await env.advanceTicks(5);
    expect(trace).toContain("timeout:alice");
    expect(game.participation.has("alice")).toBe(false);
    expect(env.getGame(DisconnectGame)).toBeUndefined();
    expect(game.lifecycle).toBe("disposed");
    env.reset();
});

test("reload keeps virtual world players but rebuilds game runtime from snapshot", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");
    const bob = env.connectPlayer("bob", "Bob");
    const before = env.startGame(ReloadGame, { trace, players: [alice, bob], counter: 42, timeoutTicks: 5 });
    const after = await env.reload({
        snapshot: () => before.snapshot(),
        restore: (snapshot) => env.startGame(ReloadGame, {
            trace,
            players: snapshot.participants.map((id) => env.getPlayer(id)),
            counter: snapshot.counter,
            timeoutTicks: 5,
        }),
    });
    expect(after).not.toBe(before);
    expect(before.lifecycle).toBe("disposed");
    expect(after.lifecycle).toBe("running");
    expect(after.context.counter).toBe(42);
    expect(after.participation.getAll().sort()).toEqual(["alice", "bob"]);
    expect(env.getPlayer("alice")).toBe(alice);
    expect(env.getPlayer("bob")).toBe(bob);
    expect(trace).not.toContain("reload-game:stop");
    env.reset();
});

test("failed game startup rolls back state resources and participation atomically", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");
    expect(() => env.startGame(FailingGame, { trace, initialPlayer: alice })).toThrow(/intentional state failure/);
    expect(env.getGame(FailingGame)).toBeUndefined();
    expect(env.manager.participation.has("alice")).toBe(false);
    expect(trace).toEqual(["game:start", "failing:enter", "component:attach", "component:detach"]);
    env.reset();
});

test("test reset disposes daemon games as a real script reload would", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const daemon = env.startGame(DaemonGame, { trace: [] });
    expect(daemon.lifecycle).toBe("running");
    env.reset();
    expect(daemon.lifecycle).toBe("disposed");
    expect(env.getGame(DaemonGame)).toBeUndefined();
});
