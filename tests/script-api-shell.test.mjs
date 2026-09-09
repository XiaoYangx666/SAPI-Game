import { expect, test } from "vitest";
import {
    ItemStack,
    Player,
    virtualMinecraft,
} from "../packages/test/dist/scriptApiShell.js";

test("ScriptAPI value shell supports spawn point and rotation without world simulation", () => {
    virtualMinecraft.resetWorld();
    const player = new Player("shell-player", "ShellPlayer");

    expect(player.getSpawnPoint()).toBeUndefined();
    expect(player.getRotation()).toEqual({ x: 0, y: 0 });

    const spawnPoint = {
        dimension: virtualMinecraft.getDimension("minecraft:overworld"),
        x: 1,
        y: 2,
        z: 3,
    };
    player.setSpawnPoint(spawnPoint);
    expect(player.getSpawnPoint()).toEqual(spawnPoint);

    player.setSpawnPoint(undefined);
    expect(player.getSpawnPoint()).toBeUndefined();
});

test("ScriptAPI ItemStack shell stores local placement metadata only", () => {
    const item = new ItemStack("minecraft:iron_bars");

    expect(item.getCanPlaceOn()).toEqual([]);
    expect(item.getCanDestroy()).toEqual([]);

    item.setCanPlaceOn(["minecraft:stone", "minecraft:dirt"]);
    item.setCanDestroy(["minecraft:glass"]);

    expect(item.getCanPlaceOn()).toEqual([
        "minecraft:stone",
        "minecraft:dirt",
    ]);
    expect(item.getCanDestroy()).toEqual(["minecraft:glass"]);
});
