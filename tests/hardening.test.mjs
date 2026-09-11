import { expect, test } from "vitest";
import {
    BEGameConfig,
    CubeRegion,
    DisconnectTimeoutComponent,
    Game,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
    PlayerGroupSet,
    RegionEventType,
    SAPIGameConfig,
} from "../packages/core/dist/main.js";
import {
    Duration,
    vanilaData,
} from "../packages/core/dist/utils/index.js";
import {
    BEGameTestEngine,
    virtualMinecraft,
} from "../packages/test/dist/index.js";

class HardeningPlayer extends GamePlayer {}

class PlayersContext extends GameContext {
    constructor(config = {}) {
        super();
        this.players = config.players ?? [];
        this.trace = config.trace ?? [];
        this.joinResult = undefined;
        this.groupSet = undefined;
        this.releaseOnTimeout = config.releaseOnTimeout;
    }
}

class OccupyGame extends GameEngine {
    static gameType = "test-hardening-occupy";
    constructor(owner, key, config) { super(HardeningPlayer, owner, key, config); }
    buildContext(config) { return new PlayersContext(config); }
    onStart() {
        const result = this.playerManager.joinAll(this.context.players);
        if (!result.allowed) throw new Error(`occupy failed: ${result.playerId}`);
    }
    onStop() {}
}

class BatchGame extends GameEngine {
    static gameType = "test-hardening-batch";
    constructor(owner, key, config) { super(HardeningPlayer, owner, key, config); }
    buildContext(config) { return new PlayersContext(config); }
    onStart() {
        this.context.joinResult = this.playerManager.joinAll(this.context.players);
    }
    onStop() {}
}

class BuildContextFailureGame extends GameEngine {
    static gameType = "test-hardening-build-failure";
    constructor(owner, key, config) { super(HardeningPlayer, owner, key, config); }
    buildContext(config = {}) {
        const result = this.playerManager.joinAll(config.players ?? []);
        if (!result.allowed) throw new Error(`setup failed: ${result.playerId}`);
        throw new Error("intentional buildContext failure");
    }
    onStart() {}
    onStop() {}
}

class DaemonViewGame extends GameEngine {
    static gameType = "test-hardening-daemon-view";
    get isDaemon() { return true; }
    constructor(owner, key, config) { super(HardeningPlayer, owner, key, config); }
    buildContext(config) { return new PlayersContext(config); }
    onStart() {}
    onStop() {}
}

class ScopedDisconnectState extends GameState {
    onEnter() {
        this.addComponent(DisconnectTimeoutComponent, {
            timeout: Duration.fromTicks(3),
            ...(this.context.releaseOnTimeout === undefined
                ? {}
                : { releaseOnTimeout: this.context.releaseOnTimeout }),
            groupSet: this.context.groupSet,
            onOffline: (id) => this.context.trace.push(`offline:${id}`),
            onTimeout: (id) => this.context.trace.push(`timeout:${id}`),
        });
    }
    onExit() {}
}

class ScopedDisconnectGame extends GameEngine {
    static gameType = "test-hardening-scoped-disconnect";
    constructor(owner, key, config) { super(HardeningPlayer, owner, key, config); }
    buildContext(config) { return new PlayersContext(config); }
    onStart() {
        const result = this.playerManager.joinAll(this.context.players);
        if (!result.allowed) throw new Error(`join failed: ${result.playerId}`);
        const scopedGroup = this.groupBuilder.fromPlayers([this.context.players[0]]);
        this.context.groupSet = new PlayerGroupSet([scopedGroup]);
        this.resetState(ScopedDisconnectState);
    }
    onStop() {}
}

test("buildContext failure releases memberships created during construction", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("hardening-alice", "Alice");
    const bob = env.connectPlayer("hardening-bob", "Bob");

    expect(() =>
        env.startGame(BuildContextFailureGame, { players: [alice, bob] })
    ).toThrow(/intentional buildContext failure/);

    expect(env.getGame(BuildContextFailureGame)).toBeUndefined();
    expect(env.manager.participation.has(alice.id)).toBe(false);
    expect(env.manager.participation.has(bob.id)).toBe(false);
    env.reset();
});

test("GamePlayerManager.joinAll rejects atomically when one player is occupied", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("batch-alice", "Alice");
    const bob = env.connectPlayer("batch-bob", "Bob");
    const carol = env.connectPlayer("batch-carol", "Carol");

    env.startGame(OccupyGame, { players: [bob] });
    const batch = env.startGame(BatchGame, { players: [alice, bob, carol] });

    expect(batch.context.joinResult.allowed).toBe(false);
    expect(batch.context.joinResult.playerId).toBe(bob.id);
    expect(batch.participation.getAll()).toEqual([]);
    expect(env.manager.participation.has(alice.id)).toBe(false);
    expect(env.manager.participation.has(carol.id)).toBe(false);
    env.reset();
});

test("daemon view creates a wrapper without participation ownership", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("daemon-alice", "Alice");
    const daemon = env.startGame(DaemonViewGame, {});

    const wrapper = daemon.playerManager.view(alice);
    expect(wrapper).toBeDefined();
    expect(wrapper.isActive).toBe(true);
    expect(daemon.playerManager.get(alice)).toBeUndefined();
    expect(daemon.participation.size).toBe(0);
    expect(env.manager.participation.has(alice.id)).toBe(false);
    env.reset();
});

test("DisconnectTimeout can scope timeout release to a PlayerGroupSet", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("scope-alice", "Alice");
    const bob = env.connectPlayer("scope-bob", "Bob");
    const game = env.startGame(ScopedDisconnectGame, {
        players: [alice, bob],
        trace,
        releaseOnTimeout: true,
    });

    env.disconnectPlayer(alice.id);
    env.disconnectPlayer(bob.id);
    await env.advanceTicks(3);

    expect(trace).toContain(`timeout:${alice.id}`);
    expect(trace).not.toContain(`timeout:${bob.id}`);
    expect(game.participation.has(alice.id)).toBe(false);
    expect(game.participation.has(bob.id)).toBe(true);
    env.reset();
});

test("DisconnectTimeout keeps participation by default", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];
    const alice = env.connectPlayer("retain-alice", "Alice");
    const game = env.startGame(ScopedDisconnectGame, {
        players: [alice],
        trace,
    });

    env.disconnectPlayer(alice.id);
    await env.advanceTicks(3);

    expect(trace).toContain(`timeout:${alice.id}`);
    expect(game.participation.has(alice.id)).toBe(true);
    env.reset();
});

test("Game.server.getAllPlayers filters undefined ScriptAPI entries", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("server-query-alice", "Alice");
    const originalGetAllPlayers = virtualMinecraft.world.getAllPlayers;

    virtualMinecraft.world.getAllPlayers = () => [alice, undefined];
    try {
        expect(Game.server.getAllPlayers()).toEqual([alice]);
    } finally {
        virtualMinecraft.world.getAllPlayers = originalGetAllPlayers;
        env.reset();
    }
});

test("connection is event-only and current player state lives under Game.server", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("connection-api-alice", "Alice");

    expect(Game.server.getAllPlayers().map((player) => player.id)).toContain(alice.id);
    expect(Game.events.connection.isOnline).toBeUndefined();
    expect(Game.events.connection.getOnlinePlayer).toBeUndefined();
    env.reset();
});

test("region transitions are broadcast to every subscriber of the same region", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const region = new CubeRegion(
        vanilaData.DimensionIds.Overworld,
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 2, z: 2 }
    );
    const first = [];
    const second = [];
    const firstSub = Game.events.region.subscribe(
        (event) => first.push(event.type),
        region
    );
    const secondSub = Game.events.region.subscribe(
        (event) => second.push(event.type),
        region
    );

    const alice = env.connectPlayer("region-broadcast-alice", "Alice");
    alice.location = { x: 1, y: 1, z: 1 };
    await env.advanceTicks(1);

    expect(first).toEqual([RegionEventType.Enter]);
    expect(second).toEqual([RegionEventType.Enter]);

    alice.location = { x: 10, y: 1, z: 10 };
    await env.advanceTicks(1);

    expect(first).toEqual([RegionEventType.Enter, RegionEventType.Leave]);
    expect(second).toEqual([RegionEventType.Enter, RegionEventType.Leave]);

    firstSub.unsubscribe();
    secondSub.unsubscribe();
    env.reset();
});

test("small compatibility APIs stay available under canonical BEGame names", () => {
    expect(Duration.fromTicks(7).ticks).toBe(7);
    expect(BEGameConfig).toBe(SAPIGameConfig);
});
