import { expect, test } from "vitest";
import { BEGameTestEngine } from "../packages/test/dist/index.js";
import {
    BlockPermutation,
    BlockVolume,
    Entity,
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

test("virtual ScriptAPI supports blocks, player records, dynamic properties and score filters", () => {
    const env = new BEGameTestEngine();
    env.reset();
    const alice = env.connectPlayer("runtime-alice", "Alice");
    const bob = env.connectPlayer("runtime-bob", "Bob");
    const overworld = world.getDimension("minecraft:overworld");

    overworld.setBlockPermutation(
        { x: 1, y: 2, z: 3 },
        BlockPermutation.resolve("minecraft:stone", { facing_direction: 2 })
    );
    expect(overworld.getBlock({ x: 1, y: 2, z: 3 }).typeId).toBe(
        "minecraft:stone"
    );

    virtualMinecraft.setRedstonePower(
        "minecraft:overworld",
        { x: 1, y: 2, z: 3 },
        12
    );
    expect(overworld.getBlock({ x: 1, y: 2, z: 3 }).getRedstonePower()).toBe(12);

    const volume = new BlockVolume(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 3 }
    );
    expect(volume.getSpan()).toEqual({ x: 2, y: 3, z: 4 });
    expect(volume.getCapacity()).toBe(24);
    expect(volume.isInside({ x: 1, y: 1, z: 1 })).toBe(true);

    alice.addTag("ready");
    alice.playSound("random.levelup");
    alice.onScreenDisplay.setTitle("go");
    alice.onScreenDisplay.setActionBar("running");
    expect(alice.hasTag("ready")).toBe(true);
    expect(alice.sounds).toContain("random.levelup");
    expect(alice.titles.at(-1)?.title).toBe("go");
    expect(alice.actionbars.at(-1)).toBe("running");

    const chicken = new Entity();
    chicken.addTag("cvs-team");
    expect(chicken.hasTag("cvs-team")).toBe(true);

    world.setDynamicProperty("database", "ok");
    expect(world.getDynamicProperty("database")).toBe("ok");

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
