export * from "./virtualMinecraft";

import { ItemStack, Player } from "./virtualMinecraft";

// Keep tiny per-value state only for ScriptAPI methods that game lifecycle code
// expects to call. This deliberately does not model Minecraft world behavior.
const spawnPoints = new WeakMap<Player, any>();
const canPlaceOn = new WeakMap<ItemStack, string[]>();
const canDestroy = new WeakMap<ItemStack, string[]>();

const playerPrototype = Player.prototype as any;
playerPrototype.setSpawnPoint = function (spawnPoint?: any) {
    if (spawnPoint === undefined) {
        spawnPoints.delete(this);
        return;
    }
    spawnPoints.set(this, { ...spawnPoint });
};
playerPrototype.getSpawnPoint = function () {
    const spawnPoint = spawnPoints.get(this);
    return spawnPoint === undefined ? undefined : { ...spawnPoint };
};
playerPrototype.getRotation = function () {
    return { x: 0, y: 0 };
};

const itemStackPrototype = ItemStack.prototype as any;
itemStackPrototype.setCanPlaceOn = function (blockIdentifiers: string[]) {
    canPlaceOn.set(this, [...blockIdentifiers]);
};
itemStackPrototype.getCanPlaceOn = function () {
    return [...(canPlaceOn.get(this) ?? [])];
};
itemStackPrototype.setCanDestroy = function (blockIdentifiers: string[]) {
    canDestroy.set(this, [...blockIdentifiers]);
};
itemStackPrototype.getCanDestroy = function () {
    return [...(canDestroy.get(this) ?? [])];
};
