import { expect, test, vi } from "vitest";
import {
    BEGameConfig,
    BuiltinTraceEventType,
    EventManager,
    Game,
    GameComponent,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
    Utils,
    defineTraceEvent,
    traceError,
} from "../packages/core/dist/main.js";
import {
    BinaryReader,
    BinaryWriter,
    utf8ByteLength,
    writeRawValue,
} from "../packages/core/dist/trace/binary.js";
import { BEGameTestEngine } from "../packages/test/dist/index.js";

const businessEvent = defineTraceEvent("test.player.scored", {
    player: "player",
    score: "uint",
    reason: "string",
});

class TracePlayer extends GamePlayer {}
class TraceContext extends GameContext {}

class TraceComponent extends GameComponent {
    onAttach() {
        this.trace.emit(businessEvent, {
            player: "trace-alice",
            score: 7,
            reason: "component-attached",
        });
    }
}

class TraceState extends GameState {
    onEnter() {
        this.addComponent(TraceComponent);
    }
}

class StructuredTraceGame extends GameEngine {
    static gameType = "structured-trace-test";
    constructor(owner, key, config) {
        super(TracePlayer, owner, key, config);
    }
    buildContext() {
        return new TraceContext();
    }
    onStart() {
        this.playerManager.join(this._testPlayer);
        this.resetState(TraceState);
    }
    onStop() {}
    set _testPlayer(player) {
        this.__testPlayer = player;
    }
    get _testPlayer() {
        return this.__testPlayer;
    }
}

// Use config through a tiny subclass so buildContext does not need to retain Minecraft objects.
class ConfiguredStructuredTraceGame extends StructuredTraceGame {
    static gameType = "structured-trace-test";
    constructor(owner, key, config) {
        super(owner, key, config);
        this._testPlayer = config.player;
    }
    onStart() {
        this.playerManager.join(this._testPlayer);
        this.resetState(TraceState);
    }
}

test("Game Trace encodes and decodes a complete structured session", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const player = env.connectPlayer("trace-alice", "Trace Alice");
    const game = env.startGame(ConfiguredStructuredTraceGame, { player });
    env.stopGame(ConfiguredStructuredTraceGame);

    expect(game.lifecycle).toBe("disposed");
    const bytes = env.gameTrace.toBytes();
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("BEGT");

    const decoded = env.gameTrace.decode();
    expect(decoded.header.gameType).toBe("structured-trace-test");
    expect(decoded.end.status).toBe("completed");
    expect(decoded.end.chunkCount).toBeGreaterThan(0);

    const types = decoded.events.map((event) => event.type);
    expect(types).toContain("game.created");
    expect(types).toContain("game.starting");
    expect(types).toContain("participation.acquire");
    expect(types).toContain("participation.joined");
    expect(types).toContain("player.connect");
    expect(types).toContain("state.push");
    expect(types).toContain("state.enter");
    expect(types).toContain("component.attach_started");
    expect(types).toContain("component.attached");
    expect(types).toContain("test.player.scored");
    expect(types).toContain("component.detached");
    expect(types).toContain("game.disposed");

    const business = decoded.events.find((event) => event.type === "test.player.scored");
    expect(business?.payload).toEqual({
        player: "trace-alice",
        score: 7,
        reason: "component-attached",
    });

    decoded.events.forEach((event, index) => {
        expect(event.sequence).toBe(index + 1);
        if (index > 0) expect(event.tick).toBeGreaterThanOrEqual(decoded.events[index - 1].tick);
    });
});

test("Trace binary strings round-trip UTF-8 without TextEncoder/TextDecoder", () => {
    const samples = [
        "ASCII trace",
        "溪枫境·小游戏追踪",
        "玩家😀获胜 🎮",
        "混合 UTF-8 / 日本語 / 한국어 / emoji 🧪",
    ];

    const writer = new BinaryWriter();
    for (const sample of samples) writer.writeString(sample);

    const reader = new BinaryReader(writer.toUint8Array());
    for (const sample of samples) expect(reader.readString()).toBe(sample);
    expect(reader.remaining).toBe(0);
});

test("Event callback errors are captured as event.callback_error", async () => {
    const env = new BEGameTestEngine();
    env.reset();

    class CallbackErrorState extends GameState {
        onEnter() {
            this.subscribe(
                Game.events.interval,
                () => {
                    throw new Error("callback-boom");
                },
                Utils.Duration.fromTicks(1)
            );
        }
    }

    class CallbackErrorGame extends GameEngine {
        static gameType = "callback-error-test";
        constructor(owner, key, config) {
            super(TracePlayer, owner, key, config);
        }
        buildContext() {
            return new TraceContext();
        }
        onStart() {
            this.resetState(CallbackErrorState);
        }
        onStop() {}
    }

    env.startGame(CallbackErrorGame);
    await env.advanceTicks(1);
    env.stopGame(CallbackErrorGame);

    const decoded = env.gameTrace.decode();
    const events = decoded.events.filter(
        (event) => event.type === "event.callback_error"
    );
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
        signal: "IntervalEventSignal",
        error: { name: "Error", message: "callback-boom" },
    });
    expect(events[0].source).toMatchObject({
        kind: "state",
        name: "CallbackErrorState",
    });
    expect(typeof events[0].source.ref).toBe("number");
    // A captured callback error is an issue, not a lifecycle crash: the
    // session itself must still finish normally.
    expect(decoded.end.status).toBe("completed");
});

test("event.callback_error source points at the subscribing component", async () => {
    const env = new BEGameTestEngine();
    env.reset();

    class CallbackErrorComponent extends GameComponent {
        onAttach() {
            this.subscribe(
                Game.events.interval,
                () => {
                    throw new Error("component-callback-boom");
                },
                Utils.Duration.fromTicks(1)
            );
        }
    }

    class ComponentCallbackState extends GameState {
        onEnter() {
            this.addComponent(CallbackErrorComponent);
        }
    }

    class ComponentCallbackGame extends GameEngine {
        static gameType = "component-callback-error-test";
        constructor(owner, key, config) {
            super(TracePlayer, owner, key, config);
        }
        buildContext() {
            return new TraceContext();
        }
        onStart() {
            this.resetState(ComponentCallbackState);
        }
        onStop() {}
    }

    env.startGame(ComponentCallbackGame);
    await env.advanceTicks(1);
    env.stopGame(ComponentCallbackGame);

    const event = env.gameTrace
        .decode()
        .events.find((entry) => entry.type === "event.callback_error");
    expect(event.payload).toMatchObject({
        signal: "IntervalEventSignal",
        error: { message: "component-callback-boom" },
    });
    expect(event.source).toMatchObject({
        kind: "component",
        name: "CallbackErrorComponent",
    });
    expect(typeof event.source.ref).toBe("number");
});

test("EventManager wrapping keeps callback identity and rethrows the original error", () => {
    class FakeSignal {
        constructor() {
            this.callbacks = new Set();
        }
        subscribe(callback) {
            this.callbacks.add(callback);
            return callback;
        }
        unsubscribe(callback) {
            this.callbacks.delete(callback);
        }
    }

    const manager = new EventManager();
    const builtins = [];
    const subscriber = {
        trace: {
            enabled: true,
            builtin(type, payload) {
                builtins.push({ type, payload });
            },
        },
    };
    const signal = new FakeSignal();
    const originalError = new Error("wrapped-boom");
    const originalCallback = () => {
        throw originalError;
    };
    const record = manager.subscribe(subscriber, signal, originalCallback);

    // The signal must only ever see the wrapper; the original callback identity
    // must never leak into the subscription set.
    expect(signal.callbacks.size).toBe(1);
    expect(signal.callbacks.has(originalCallback)).toBe(false);
    const [wrapped] = [...signal.callbacks];

    let caught;
    try {
        wrapped();
    } catch (error) {
        caught = error;
    }
    expect(caught).toBe(originalError);
    expect(builtins).toEqual([
        {
            type: BuiltinTraceEventType.EventCallbackError,
            payload: {
                signal: "FakeSignal",
                error: expect.objectContaining({
                    name: "Error",
                    message: "wrapped-boom",
                }),
            },
        },
    ]);

    manager.unsubscribe(record);
    expect(signal.callbacks.size).toBe(0);
});

test("async event callbacks trigger a one-time development warning", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    BEGameConfig.update({ debugMode: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
        class AsyncCallbackState extends GameState {
            onEnter() {
                this.subscribe(
                    Game.events.interval,
                    async () => {},
                    Utils.Duration.fromTicks(1)
                );
            }
        }

        class AsyncCallbackGame extends GameEngine {
            static gameType = "async-callback-test";
            constructor(owner, key, config) {
                super(TracePlayer, owner, key, config);
            }
            buildContext() {
                return new TraceContext();
            }
            onStart() {
                this.resetState(AsyncCallbackState);
            }
            onStop() {}
        }

        env.startGame(AsyncCallbackGame);
        await env.advanceTicks(3);
        env.stopGame(AsyncCallbackGame);

        const warnings = warn.mock.calls.filter((call) =>
            String(call[0]).includes("EventManager")
        );
        expect(warnings).toHaveLength(1);
        expect(String(warnings[0][0])).toContain("runner.run");
    } finally {
        warn.mockRestore();
        BEGameConfig.reset();
    }
});

test("AggregateError root causes survive Trace serialization", () => {
    const env = new BEGameTestEngine();
    env.reset();

    class ExitFailState extends GameState {
        onEnter() {}
        onExit() {
            throw new Error("exit-boom");
        }
    }

    class ExitFailGame extends GameEngine {
        static gameType = "exit-fail-test";
        constructor(owner, key, config) {
            super(TracePlayer, owner, key, config);
        }
        buildContext() {
            return new TraceContext();
        }
        onStart() {
            this.resetState(ExitFailState);
        }
        onStop() {}
    }

    env.startGame(ExitFailGame);
    expect(() => env.stopGame(ExitFailGame)).toThrowError();

    const decoded = env.gameTrace.decode();
    const removed = decoded.events.find(
        (event) =>
            event.type === "state.remove" && event.payload.success === false
    );
    expect(removed).toBeDefined();
    expect(removed.payload.error.name).toBe("AggregateError");
    expect(removed.payload.error.errors).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ message: "exit-boom" }),
        ])
    );

    const disposed = decoded.events.find(
        (event) => event.type === "game.disposed"
    );
    expect(JSON.stringify(disposed.payload)).toContain("exit-boom");
});

test("traceError serializes AggregateError.errors and tolerates cycles", () => {
    const aggregate = new AggregateError(
        [new Error("inner-boom"), "text-reason"],
        "aggregate"
    );
    const serialized = traceError(aggregate);
    expect(serialized.name).toBe("AggregateError");
    expect(serialized.errors[0]).toMatchObject({ message: "inner-boom" });
    expect(serialized.errors[1]).toEqual({ message: "text-reason" });

    const cyclic = new Error("cyclic");
    cyclic.cause = cyclic;
    expect(traceError(cyclic).cause).toMatchObject({
        message: "[Circular error]",
    });
});

test("traceError keeps pathological AggregateErrors within a byte budget", () => {
    const children = [];
    for (let index = 0; index < 100; index++) {
        const child = new Error(`child-${index}-` + "x".repeat(4000));
        child.stack = `stack-${index}-` + "y".repeat(20_000);
        children.push(child);
    }
    const serialized = traceError(
        new AggregateError(children, "aggregate-" + "z".repeat(4000))
    );

    expect(serialized.truncated).toBe(true);
    expect(serialized.omitted).toBe(100 - (16 - 1));
    expect(serialized.errors).toHaveLength(15);

    const writer = new BinaryWriter();
    writeRawValue(writer, serialized);
    expect(writer.length).toBeLessThan(12 * 1024);
});

test("traceError preserves top-level stacks and caps nested stacks", () => {
    const top = new Error("top");
    top.stack = "s".repeat(10_000);
    const topResult = traceError(top);
    expect(utf8ByteLength(topResult.stack)).toBe(4096);

    const leaf = new Error("leaf");
    leaf.stack = "l".repeat(10_000);
    const nestedResult = traceError(new AggregateError([leaf], "nested"));
    expect(utf8ByteLength(nestedResult.errors[0].stack)).toBe(256);
});

test("traceError truncates multibyte messages by UTF-8 bytes", () => {
    const result = traceError("测".repeat(500));
    expect(result.truncated).toBe(true);
    expect(utf8ByteLength(result.message)).toBeLessThanOrEqual(512);
    expect(utf8ByteLength(result.message)).toBeGreaterThan(500);
});

test("traceError never throws on hostile thrown values", () => {
    const throwingToString = {
        toString() {
            throw new Error("toString boom");
        },
        [Symbol.toPrimitive]() {
            throw new Error("toPrimitive boom");
        },
    };
    const poisonedProxy = new Proxy(
        {},
        {
            getPrototypeOf() {
                throw new Error("proxy getPrototypeOf boom");
            },
            get() {
                throw new Error("proxy get boom");
            },
        }
    );
    const poisonedError = new Error("visible message");
    Object.defineProperty(poisonedError, "stack", {
        get() {
            throw new Error("stack boom");
        },
    });
    Object.defineProperty(poisonedError, "cause", {
        get() {
            throw new Error("cause boom");
        },
    });
    Object.defineProperty(poisonedError, "errors", {
        get() {
            throw new Error("errors boom");
        },
    });
    const poisonedAggregate = new AggregateError(
        [poisonedProxy, new Error("readable child")],
        "hostile aggregate"
    );
    Object.defineProperty(poisonedAggregate, "errors", {
        get() {
            throw new Error("aggregate errors boom");
        },
    });
    const poisonedArray = [];
    poisonedArray[0] = new Error("hidden");
    const arrayProxy = new Proxy(poisonedArray, {
        get(target, key) {
            if (key === "length") throw new Error("length boom");
            return target[key];
        },
    });

    const samples = [
        null,
        undefined,
        42,
        true,
        "plain",
        Symbol("sym"),
        10n,
        Object.create(null),
        throwingToString,
        poisonedProxy,
        poisonedError,
        poisonedAggregate,
        arrayProxy,
    ];

    for (const sample of samples) {
        expect(() => traceError(sample)).not.toThrow();
    }
    expect(traceError("plain")).toEqual({ message: "plain" });
    expect(traceError(null)).toEqual({ message: "null" });
    expect(traceError(poisonedError)).toMatchObject({
        name: "Error",
        message: "visible message",
    });

    // A poisoned child must not prevent readable siblings from being recorded.
    const mixed = new AggregateError(
        [new Error("readable"), poisonedProxy],
        "mixed"
    );
    const serialized = traceError(mixed);
    expect(serialized.errors[0]).toMatchObject({ message: "readable" });
    expect(typeof serialized.errors[1].message).toBe("string");
});
