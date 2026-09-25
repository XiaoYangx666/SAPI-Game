import { expect, test, vi } from "vitest";
import {
    BlockInteractionBlocker,
    EntityInteractionBlocker,
    FriendlyFireProtector,
    Game,
    GameComponent,
    LazyLoader,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
    PlayerGroup,
    PlayerGroupSet,
    PlayerTextPrimitive,
    PlayerRegionMonitor,
    PvpController,
    RegionProtector,
    RegionTeamChooser,
    RespawnComponent,
    SpawnPointProtector,
    SphereRegion,
    StopWatch,
    Timer,
    playerInfoText,
    playerNameText,
} from "../packages/core/dist/main.js";
import { BEGameTestEngine, virtualMinecraft } from "../packages/test/dist/index.js";

class CombatContext extends GameContext {
    constructor() {
        super();
        this.teamA = new PlayerGroup(GamePlayer);
        this.teamB = new PlayerGroup(GamePlayer);
        this.groupSet = new PlayerGroupSet([this.teamA, this.teamB]);
    }
}

class CombatState extends GameState {
    onEnter() {
        this.addComponent(FriendlyFireProtector, {
            groupSet: this.context.groupSet,
        });
        this.addComponent(PvpController, {
            players: this.context.groupSet,
        });
        this.addComponent(
            PlayerTextPrimitive,
            playerInfoText({
                players: this.context.groupSet,
                // group 上下文由 PlayerTextPrimitive 直接传给 preset，
                // 业务层无需再 groupSet.findById()。
                nameColor: (_player, group) =>
                    group === this.context.teamA ? "§c" : "§9",
            })
        );
    }
}

class CombatGame extends GameEngine {
    static gameType = "test-combat-components";

    constructor(owner, key, config) {
        super(GamePlayer, owner, key, config);
    }

    buildContext(config) {
        const context = new CombatContext();
        context.players = config?.players ?? [];
        return context;
    }

    onStart() {
        const { teamA, teamB } = this.context;
        this.context.players.forEach((p, index) => {
            const decision = this.playerManager.join(p);
            if (decision.allowed) {
                (index < 2 ? teamA : teamB).add(decision.player);
            }
        });
        this.resetState(CombatState);
    }

    onStop() {}
}

function hurt(victim, attacker) {
    return {
        hurtEntity: victim,
        damageSource: { damagingEntity: attacker },
        damage: 1,
        cancel: false,
    };
}

test("PvpController / FriendlyFireProtector / PlayerTextPrimitive 基础行为", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const a = env.connectPlayer("pvp-a", "A");
    const b = env.connectPlayer("pvp-b", "B");
    const c = env.connectPlayer("pvp-c", "C");

    const game = env.startGame(CombatGame, { players: [a, b, c] });
    const state = game.getState(CombatState);

    // 名字 + 血量共用一个 textPrimitive，因此仍然只有每人一个 shape。
    await env.advanceTicks(1);
    let shapes = virtualMinecraft.primitiveShapesManager.getShapes();
    expect(shapes.length).toBe(3);
    const texts = shapes.map((shape) => String(shape.text));
    expect(texts.every((value) => value.includes("\n"))).toBe(true);
    expect(texts.some((value) => value.startsWith("§cA§r\n"))).toBe(true);
    expect(texts.every((value) => value.includes("20"))).toBe(true);

    // playerNameText 同样支持按玩家动态决定颜色。
    const dynamicName = playerNameText({
        players: [],
        color: (player) => (player.name === "A" ? "§c" : "§9"),
    });
    expect(dynamicName.text({ name: "A" })).toBe("§cA");
    expect(dynamicName.text({ name: "B" })).toBe("§9B");

    // 先开启 PvP，单独验证友伤保护：同队 a/b 取消，跨队 a/c 放行。
    const pvp = state.getComponent(PvpController);
    pvp.enable();

    const ally = hurt(a, b);
    env.emitWorldBeforeEvent("entityHurt", ally);
    expect(ally.cancel).toBe(true);

    const rival = hurt(a, c);
    env.emitWorldBeforeEvent("entityHurt", rival);
    expect(rival.cancel).toBe(false);

    // PvP 控制：关闭 -> 取消，开启 -> 放行。
    pvp.disable();
    const off = hurt(a, c);
    env.emitWorldBeforeEvent("entityHurt", off);
    expect(off.cancel).toBe(true);

    pvp.enable();
    const on = hurt(a, c);
    env.emitWorldBeforeEvent("entityHurt", on);
    expect(on.cancel).toBe(false);

    // hide 清理 primitive，show 恢复。
    const text = state.getComponent(PlayerTextPrimitive);
    text.hide();
    expect(virtualMinecraft.primitiveShapesManager.getShapes().length).toBe(0);
    text.show();
    await env.advanceTicks(1);
    shapes = virtualMinecraft.primitiveShapesManager.getShapes();
    expect(shapes.length).toBe(3);

    // 游戏结束时组件卸载，不留残余。
    env.stopGame(CombatGame);
    expect(virtualMinecraft.primitiveShapesManager.getShapes().length).toBe(0);

    env.reset();
    expect(Game.manager.getGame(CombatGame)).toBeUndefined();
});

test("PvpController 支持按区域范围控制", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const a = env.connectPlayer("region-a", "A");
    const b = env.connectPlayer("region-b", "B");
    const c = env.connectPlayer("region-c", "C");
    const inside = { x: 0, y: 0, z: 0 };

    // a/b 同队，c 跨队：区域用例用 a 与 c，避免友伤保护干扰。
    const game = env.startGame(CombatGame, { players: [a, b, c] });
    const state = game.getState(CombatState);

    // CombatState 自带的玩家范围控制器会拦截全部，先开启避免干扰区域用例。
    state.getComponent(PvpController).enable();

    const region = new SphereRegion("minecraft:overworld", inside, 5);
    state.addComponent(PvpController, { region }, "region");

    // 双方都在区域内 -> 拦截。
    a.location = { x: 0, y: 0, z: 0 };
    c.location = { x: 1, y: 0, z: 0 };
    const insideEvent = hurt(a, c);
    env.emitWorldBeforeEvent("entityHurt", insideEvent);
    expect(insideEvent.cancel).toBe(true);

    // 双方都在区域外 -> 放行。
    a.location = { x: 100, y: 0, z: 100 };
    c.location = { x: 101, y: 0, z: 100 };
    const outsideEvent = hurt(a, c);
    env.emitWorldBeforeEvent("entityHurt", outsideEvent);
    expect(outsideEvent.cancel).toBe(false);

    // 默认 either：只有攻击者在区域内也拦截。
    a.location = { x: 0, y: 0, z: 0 };
    const edgeEvent = hurt(c, a);
    env.emitWorldBeforeEvent("entityHurt", edgeEvent);
    expect(edgeEvent.cancel).toBe(true);

    // regionScope: "both"：只有一方在区域内则放行。
    state.getComponent(PvpController, "region").enable();
    state.addComponent(
        PvpController,
        { region, regionScope: "both" },
        "both"
    );
    const partialEvent = hurt(c, a);
    env.emitWorldBeforeEvent("entityHurt", partialEvent);
    expect(partialEvent.cancel).toBe(false);

    c.location = { x: 1, y: 0, z: 0 };
    const bothEvent = hurt(c, a);
    env.emitWorldBeforeEvent("entityHurt", bothEvent);
    expect(bothEvent.cancel).toBe(true);

    env.reset();
});

test("RegionTeamChooser 的 Leave 不会创建 participation", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const a = env.connectPlayer("chooser-a", "A");
    const outsider = env.connectPlayer("chooser-outsider", "Outsider");

    const game = env.startGame(CombatGame, { players: [a] });
    const state = game.getState(CombatState);
    const region = new SphereRegion(
        "minecraft:overworld",
        { x: 0, y: 0, z: 0 },
        5
    );
    const team = new PlayerGroup(GamePlayer);
    const data = { region, team };

    state.addComponent(
        RegionTeamChooser,
        { config: [data], removeOnLeave: true },
        "chooser"
    );
    const chooser = state.getComponent(RegionTeamChooser, "chooser");

    // 直接回归内部事件处理：一个从未参加本局的玩家触发 Leave，不能因此被 join。
    chooser.handleRegionEvent(
        { player: outsider, type: "leave", region },
        data
    );

    expect(game.playerManager.hasParticipant(outsider.id)).toBe(false);
    expect(team.has(outsider)).toBe(false);
    env.reset();
});

test("Timer / StopWatch 补偿模式逐秒补发并正确到 0", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const player = env.connectPlayer("timer-a", "A");

    let now = 1_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);

    try {
        const game = env.startGame(CombatGame, { players: [player] });
        const state = game.getState(CombatState);

        state.addComponent(
            Timer,
            { initialTime: 3, autoStart: true, compensate: true },
            "timer"
        );
        const timer = state.getComponent(Timer, "timer");
        const timerTicks = [];
        const timerTimes = [];
        timer.events.tick.subscribe(({ remainingTime }) =>
            timerTicks.push(remainingTime)
        );
        timer.events.onTime.subscribe(() => timerTimes.push(2), { time: 2 });
        timer.events.onTime.subscribe(() => timerTimes.push(1), { time: 1 });

        now += 3_000;
        await env.advanceTicks(1);

        expect(timer.time).toBe(0);
        expect(timer.isRunning).toBe(false);
        expect(timerTicks).toEqual([2, 1, 0]);
        expect(timerTimes).toEqual([2, 1]);

        state.addComponent(
            StopWatch,
            { autoStart: true, compensate: true },
            "stopwatch"
        );
        const stopwatch = state.getComponent(StopWatch, "stopwatch");
        const watchTicks = [];
        const watchTimes = [];
        stopwatch.events.tick.subscribe(({ elapsedTime }) =>
            watchTicks.push(elapsedTime)
        );
        stopwatch.events.onTime.subscribe(() => watchTimes.push(1), { time: 1 });
        stopwatch.events.onTime.subscribe(() => watchTimes.push(2), { time: 2 });
        stopwatch.events.onTime.subscribe(() => watchTimes.push(3), { time: 3 });

        now += 3_000;
        await env.advanceTicks(1);

        expect(stopwatch.time).toBe(3);
        expect(watchTicks).toEqual([1, 2, 3]);
        expect(watchTimes).toEqual([1, 2, 3]);
    } finally {
        nowSpy.mockRestore();
        env.reset();
    }
});

class LazyChildComponent extends GameComponent {
    static attached = 0;
    static detached = 0;

    onAttach() {
        LazyChildComponent.attached++;
    }

    onDetach() {
        LazyChildComponent.detached++;
    }
}

test("LazyLoader 拥有并完整清理子组件", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const player = env.connectPlayer("lazy-a", "A");
    const game = env.startGame(CombatGame, { players: [player] });
    const state = game.getState(CombatState);
    LazyChildComponent.attached = 0;
    LazyChildComponent.detached = 0;

    state.addComponent(
        LazyLoader,
        {
            dimensionId: "minecraft:overworld",
            pos: { x: 0, y: 0, z: 0 },
            interval: { ticks: 1 },
            onLoad(loader) {
                loader
                    .addComponent(LazyChildComponent, undefined, "a")
                    .addComponent(LazyChildComponent, undefined, "b");
            },
        },
        "loader"
    );

    await env.advanceTicks(1);
    const loader = state.getComponent(LazyLoader, "loader");
    expect(loader.isActive).toBe(true);
    expect(LazyChildComponent.attached).toBe(2);

    loader.reload();
    expect(LazyChildComponent.detached).toBe(2);
    expect(LazyChildComponent.attached).toBe(4);

    state.deleteComponent(LazyLoader, "loader");
    expect(LazyChildComponent.detached).toBe(4);
    expect(() => state.getComponent(LazyChildComponent, "a")).toThrow();

    env.reset();
});

test("LazyLoader 的 onLoad 失败会回滚子组件并保持可重试", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const player = env.connectPlayer("lazy-fail-a", "A");
    const game = env.startGame(CombatGame, { players: [player] });
    const state = game.getState(CombatState);
    LazyChildComponent.attached = 0;
    LazyChildComponent.detached = 0;

    state.addComponent(
        LazyLoader,
        {
            dimensionId: "minecraft:overworld",
            pos: { x: 0, y: 0, z: 0 },
            interval: { ticks: 1 },
            onLoad(loader) {
                loader.addComponent(LazyChildComponent);
                throw new Error("expected load failure");
            },
        },
        "loader-fail"
    );

    await env.advanceTicks(1);
    const loader = state.getComponent(LazyLoader, "loader-fail");
    expect(loader.isActive).toBe(false);
    expect(LazyChildComponent.attached).toBe(1);
    expect(LazyChildComponent.detached).toBe(1);
    expect(() => state.getComponent(LazyChildComponent)).toThrow();

    // inactive，因此下一次检测会重试，而不是卡死在 active=true。
    await env.advanceTicks(1);
    expect(LazyChildComponent.attached).toBe(2);
    expect(LazyChildComponent.detached).toBe(2);

    env.reset();
});

test("PlayerRegionMonitor 每次离开只触发一次并识别维度", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const native = env.connectPlayer("monitor-a", "A");
    const game = env.startGame(CombatGame, { players: [native] });
    const state = game.getState(CombatState);
    const player = game.context.teamA.getById("monitor-a");
    const leaves = [];

    state.addComponent(
        PlayerRegionMonitor,
        {
            region: new SphereRegion(
                "minecraft:overworld",
                { x: 0, y: 0, z: 0 },
                5
            ),
            players: game.context.groupSet,
            interval: { ticks: 1 },
            onLeave(p) {
                leaves.push(p.id);
            },
        },
        "monitor"
    );

    native.location = { x: 10, y: 0, z: 0 };
    await env.advanceTicks(2);
    expect(leaves).toEqual(["monitor-a"]);

    // 回到区域内会解除 outside 状态，下一次离开再次触发。
    native.location = { x: 0, y: 0, z: 0 };
    await env.advanceTicks(1);
    native.dimension = virtualMinecraft.getDimension("minecraft:nether");
    await env.advanceTicks(1);
    expect(leaves).toEqual(["monitor-a", "monitor-a"]);
    expect(player).toBeDefined();

    env.reset();
});

test("RegionProtector 区分维度并支持通用 PlayerSource", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const native = env.connectPlayer("protect-a", "A");
    const ally = env.connectPlayer("protect-ally", "Ally");
    const outsider = env.connectPlayer("protect-b", "B");
    const game = env.startGame(CombatGame, {
        players: [native, ally, outsider],
    });
    const state = game.getState(CombatState);

    state.addComponent(
        RegionProtector,
        {
            region: new SphereRegion(
                "minecraft:overworld",
                { x: 0, y: 0, z: 0 },
                5
            ),
            players: game.context.teamA,
            blockBreakInside: true,
        },
        "inside"
    );

    const overworldBlock = virtualMinecraft
        .getDimension("minecraft:overworld")
        .getBlock({ x: 0, y: 0, z: 0 });
    const netherBlock = virtualMinecraft
        .getDimension("minecraft:nether")
        .getBlock({ x: 0, y: 0, z: 0 });

    const insideEvent = {
        player: native,
        block: overworldBlock,
        cancel: false,
    };
    env.emitWorldBeforeEvent("playerBreakBlock", insideEvent);
    expect(insideEvent.cancel).toBe(true);

    // 相同坐标但不同维度不属于“区域内”。
    const otherDimension = {
        player: native,
        block: netherBlock,
        cancel: false,
    };
    env.emitWorldBeforeEvent("playerBreakBlock", otherDimension);
    expect(otherDimension.cancel).toBe(false);

    // 不在 players 来源中的玩家不受该保护器影响。
    const outOfScope = {
        player: outsider,
        block: overworldBlock,
        cancel: false,
    };
    env.emitWorldBeforeEvent("playerBreakBlock", outOfScope);
    expect(outOfScope.cancel).toBe(false);

    env.reset();
});

test("交互阻止器支持 PlayerSource 且只拦截作用范围内玩家", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const a = env.connectPlayer("blocker-a", "A");
    const b = env.connectPlayer("blocker-b", "B");
    const c = env.connectPlayer("blocker-c", "C");
    const game = env.startGame(CombatGame, { players: [a, b, c] });
    const state = game.getState(CombatState);

    state.addComponent(
        BlockInteractionBlocker,
        {
            players: game.context.teamA,
            blockIds: ["minecraft:stone"],
            showMessage: false,
        },
        "block"
    );
    state.addComponent(
        EntityInteractionBlocker,
        {
            players: game.context.teamA,
            entityIds: ["minecraft:zombie"],
            showMessage: false,
        },
        "entity"
    );

    const block = virtualMinecraft
        .getDimension("minecraft:overworld")
        .getBlock({ x: 0, y: 0, z: 0 });
    block.typeId = "minecraft:stone";

    const blockA = { player: a, block, cancel: false };
    env.emitWorldBeforeEvent("playerInteractWithBlock", blockA);
    expect(blockA.cancel).toBe(true);

    const blockC = { player: c, block, cancel: false };
    env.emitWorldBeforeEvent("playerInteractWithBlock", blockC);
    expect(blockC.cancel).toBe(false);

    const zombie = {
        typeId: "minecraft:zombie",
        getComponent() {
            return undefined;
        },
    };
    const entityA = { player: a, target: zombie, cancel: false };
    env.emitWorldBeforeEvent("playerInteractWithEntity", entityA);
    expect(entityA.cancel).toBe(true);

    const entityC = { player: c, target: zombie, cancel: false };
    env.emitWorldBeforeEvent("playerInteractWithEntity", entityC);
    expect(entityC.cancel).toBe(false);

    env.reset();
});

test("RespawnComponent 自动广播不再强制要求 buildNameFunc", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("respawn-a", "Alice");
    const bob = env.connectPlayer("respawn-b", "Bob");
    const charlie = env.connectPlayer("respawn-c", "Charlie");
    const game = env.startGame(CombatGame, {
        players: [alice, bob, charlie],
    });
    const state = game.getState(CombatState);

    state.addComponent(
        RespawnComponent,
        {
            groupSet: game.context.groupSet,
            autoBroadcast: true,
        },
        "respawn"
    );

    env.emitWorldAfterEvent("entityDie", {
        deadEntity: alice,
        damageSource: { damagingEntity: charlie },
    });

    const message = alice.messages.map(String).join("\n");
    expect(message).toContain("Alice");
    expect(message).toContain("Charlie");
    expect(bob.messages.map(String).join("\n")).toContain("Alice");

    env.reset();
});

test("SpawnPointProtector 只保护目标队伍与目标维度", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const a = env.connectPlayer("spawn-a", "A");
    const ally = env.connectPlayer("spawn-ally", "Ally");
    const outsider = env.connectPlayer("spawn-b", "B");
    const game = env.startGame(CombatGame, {
        players: [a, ally, outsider],
    });
    const state = game.getState(CombatState);
    const overworld = virtualMinecraft.getDimension("minecraft:overworld");
    const nether = virtualMinecraft.getDimension("minecraft:nether");

    state.addComponent(
        SpawnPointProtector,
        {
            playerGroup: game.context.teamA,
            spawnPoint: { x: 0, y: 10, z: 0 },
            dimension: overworld,
            autoSetSpawnPoint: false,
        },
        "spawn"
    );

    const protectedOverworld = overworld.getBlock({ x: 0, y: 9, z: 0 });
    const protectedNether = nether.getBlock({ x: 0, y: 9, z: 0 });

    const memberEvent = {
        player: a,
        block: protectedOverworld,
        cancel: false,
    };
    env.emitWorldBeforeEvent("playerInteractWithBlock", memberEvent);
    expect(memberEvent.cancel).toBe(true);

    const outsiderEvent = {
        player: outsider,
        block: protectedOverworld,
        cancel: false,
    };
    env.emitWorldBeforeEvent("playerInteractWithBlock", outsiderEvent);
    expect(outsiderEvent.cancel).toBe(false);

    const otherDimension = {
        player: a,
        block: protectedNether,
        cancel: false,
    };
    env.emitWorldBeforeEvent("playerInteractWithBlock", otherDimension);
    expect(otherDimension.cancel).toBe(false);

    env.reset();
});

