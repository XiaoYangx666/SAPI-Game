import { expect, test } from "vitest";
import {
    EnchantmentTypes,
    ItemComponentTypes,
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

test("ScriptAPI ItemStack shell exposes minimal durability and enchantable components", () => {
    const item = new ItemStack("minecraft:diamond_pickaxe");
    const durability = item.getComponent(ItemComponentTypes.Durability);
    const enchantable = item.getComponent(ItemComponentTypes.Enchantable);

    expect(durability.damage).toBe(0);
    durability.damage = durability.maxDurability;
    expect(durability.damage).toBe(durability.maxDurability);

    enchantable.addEnchantment({
        type: EnchantmentTypes.get("efficiency"),
        level: 5,
    });
    expect(enchantable.getEnchantments()).toEqual([
        { type: { id: "efficiency" }, level: 5 },
    ]);
});
