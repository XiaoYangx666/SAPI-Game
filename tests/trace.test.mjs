import { expect, test } from "vitest";
import {
    GameComponent,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
    defineTraceEvent,
} from "../packages/core/dist/main.js";
import {
    BinaryReader,
    BinaryWriter,
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
