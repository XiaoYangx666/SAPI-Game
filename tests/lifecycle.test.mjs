import { expect, test, vi } from "vitest";
import {
    DisconnectTimeoutComponent,
    Game,
    GameComponent,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
} from "../packages/core/dist/main.js";
import { Logger } from "../packages/core/dist/utils/logger.js";
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

test("last online player explicitly leaving stops an empty game without a disconnect event", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");
    const game = env.startGame(DisconnectGame, {
        trace, initialPlayer: alice, timeoutTicks: 5, stopGameWhenEmpty: true,
    });

    expect(game.playerManager.leave("alice", "hub")).toBe(true);
    expect(game.participation.size).toBe(0);
    // Empty-room checks run after the caller finishes its leave transition.
    expect(game.lifecycle).toBe("running");
    await env.advanceTicks(1);
    expect(env.getGame(DisconnectGame)).toBeUndefined();
    expect(game.lifecycle).toBe("disposed");
    expect(trace.filter(item => item === "game:stop")).toHaveLength(1);
    env.reset();
});

test("same-tick replacement participant prevents an obsolete empty-room stop", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("alice", "Alice");
    const bob = env.connectPlayer("bob", "Bob");
    const game = env.startGame(DisconnectGame, {
        trace, initialPlayer: alice, timeoutTicks: 5, stopGameWhenEmpty: true,
    });

    game.playerManager.leave("alice", "hub");
    expect(game.playerManager.join(bob).allowed).toBe(true);
    await env.advanceTicks(1);
    expect(game.lifecycle).toBe("running");
    expect(game.participation.getAll()).toEqual(["bob"]);
    expect(trace).not.toContain("game:stop");
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

/**
 * 回归：一个 interval 回调在同步执行中触发了 State 清理（真实场景是
 * TableEntityLifetimeComponent 检测到区块卸载后 stopGame），清理会把其它
 * 组件的订阅一起注销。tick 事先快照了回调列表，若不在调用前复查就会继续调用
 * 那个已经失效的回调，让它去访问已被删除的组件并抛错。
 */
class ReentrantStopComponent extends GameComponent {
    onAttach() {
        // 触发者必须先注册：这样它在同一 tick 的快照里排在观察者前面，
        // 才能重现「先同步 stopGame 清理，再调用已失效的观察者」这个真实顺序
        // （实际项目里 TableEntityLifetimeComponent 早于 display 组件注册）。
        this.subscribe(
            Game.events.interval,
            () => {
                this.context.trace.push("stopper:tick");
                if (!this.context.stopped) {
                    this.context.stopped = true;
                    this.state.stopGame("reentrant-stop");
                }
            },
            Duration.fromTicks(1)
        );
        // 后注册的观察者：清理发生后它已被注销，本轮不应再被调用。
        this.subscribe(
            Game.events.interval,
            () => {
                let probeAlive = true;
                try {
                    this.state.getComponent(ProbeComponent);
                } catch {
                    probeAlive = false;
                }
                if (!probeAlive) {
                    throw new Error("observer ran after its sibling was deleted");
                }
                this.context.trace.push("observer:tick");
            },
            Duration.fromTicks(1)
        );
    }
}

class ProbeComponent extends GameComponent {
    onAttach() { this.context.trace.push("probe:attach"); }
    onDetach() { this.context.trace.push("probe:detach"); }
}

class ReentrantState extends GameState {
    onEnter() {
        // 观察者先注册，触发者后注册，保证顺序稳定。
        this.addComponent(ReentrantStopComponent);
        this.addComponent(ProbeComponent);
    }
}

class ReentrantGame extends GameEngine {
    static gameType = "test-reentrant-stop";
    constructor(owner, key, config) { super(TracePlayer, owner, key, config); }
    buildContext(config) { return new TraceContext({ ...config, stopped: false }); }
    onStart() { this.resetState(ReentrantState); }
    onStop() { this.context.trace.push("game:stop"); }
}

test("interval callbacks unsubscribed by a reentrant stop are not invoked", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const game = env.startGame(ReentrantGame, { trace });

    // tick 会吞掉回调异常并只写日志，所以失败不会自然冒泡；必须显式盯住
    // Logger.error，否则这个回归测试即使在有 bug 的版本上也会通过。
    const errors = [];
    const loggerError = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation((...args) => { errors.push(args); });

    try {
        // 一整个 tick 内：stopper 触发清理并注销 observer。同一 tick 的快照里
        // 还有 observer，它必须被跳过，而不是去访问已删除的组件。
        await env.advanceTicks(1);
    } finally {
        loggerError.mockRestore();
    }

    expect(game.lifecycle).toBe("disposed");
    expect(trace).toContain("probe:detach");
    expect(errors).toEqual([]);

    // 之后再推进若干 tick，不应有任何残留回调继续跑。
    const before = trace.length;
    await env.advanceTicks(50);
    expect(trace.length).toBe(before);
    env.reset();
});
