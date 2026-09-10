import { expect, test } from "vitest";
import { BEGameTestEngine } from "../packages/test/dist/index.js";
import {
    system,
    virtualMinecraft,
    world,
} from "../packages/test/dist/virtualMinecraft.js";

test("virtual ticks fully settle adopted promise chains", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const trace = [];

    async function nestedWait() {
        await virtualMinecraft.system.waitTicks(20);
    }

    async function runnerLikeFlow() {
        trace.push("start");
        await nestedWait();
        await Promise.resolve();
        trace.push("done");
    }

    void runnerLikeFlow();
    await env.advanceTicks(19);
    expect(trace).toEqual(["start"]);

    await env.advanceTicks(1);
    expect(trace).toEqual(["start", "done"]);
    env.reset();
});

test("Date.now advances deterministically with virtual ticks", async () => {
    const env = new BEGameTestEngine();
    env.reset();
    const startedAt = Date.now();

    await env.advanceTicks(20);

    expect(Date.now() - startedAt).toBe(1000);
    expect(env.nowMs).toBe(Date.now());
    env.reset();
});

test("worldLoad subscriptions survive reset and reload", async () => {
    const events = [];
    world.afterEvents.worldLoad.subscribe(() => events.push("load"));
    const env = new BEGameTestEngine();

    expect(events).toEqual(["load"]);
    env.reset();
    expect(events).toEqual(["load", "load"]);

    await env.reload({
        snapshot: () => ({ ok: true }),
        restore: (snapshot) => snapshot,
    });
    expect(events).toEqual(["load", "load", "load"]);
});

test("world and system events accept arbitrary injected payloads", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const player = env.connectPlayer("event-player", "EventPlayer");

    const seen = [];
    world.afterEvents.playerBreakBlock.subscribe((event) => {
        seen.push(["world-after", event.player, event.blockId]);
    });
    world.beforeEvents.itemUse.subscribe((event) => {
        event.cancel = true;
        seen.push(["world-before", event.source, event.itemId]);
    });
    system.afterEvents.scriptEventReceive.subscribe((event) => {
        seen.push(["system-after", event.id, event.message]);
    });
    system.beforeEvents.watchdogTerminate.subscribe((event) => {
        event.cancel = true;
        seen.push(["system-before", event.reason]);
    });

    const itemUse = { source: player, itemId: "minecraft:stick", cancel: false };
    const watchdog = { reason: "test", cancel: false };

    env.emitWorldAfterEvent("playerBreakBlock", {
        player,
        blockId: "minecraft:stone",
    });
    env.emitWorldBeforeEvent("itemUse", itemUse);
    env.emitSystemAfterEvent("scriptEventReceive", {
        id: "begame:test",
        message: "payload",
    });
    env.emitSystemBeforeEvent("watchdogTerminate", watchdog);

    expect(itemUse.cancel).toBe(true);
    expect(watchdog.cancel).toBe(true);
    expect(seen).toEqual([
        ["world-after", player, "minecraft:stone"],
        ["world-before", player, "minecraft:stick"],
        ["system-after", "begame:test", "payload"],
        ["system-before", "test"],
    ]);

    env.reset();
});

test("minimal player query state supports lifecycle scoping", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("runtime-alice", "Alice");
    const bob = env.connectPlayer("runtime-bob", "Bob");

    alice.addTag("ready");
    expect(world.getPlayers({ tags: ["ready"] })).toEqual([alice]);

    const objective = world.scoreboard.addObjective("rank");
    objective.setScore(alice, 5);
    objective.setScore(bob, 1);
    expect(
        world.getPlayers({
            scoreOptions: [{ objective: "rank", minScore: 3 }],
        })
    ).toEqual([alice]);

    env.reset();
});