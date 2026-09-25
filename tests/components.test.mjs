import { expect, test, vi } from "vitest";
import {
    FriendlyFireProtector,
    Game,
    GameContext,
    GameEngine,
    GamePlayer,
    GameState,
    PlayerGroup,
    PlayerGroupSet,
    PlayerTextPrimitive,
    PvpController,
    RegionTeamChooser,
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

