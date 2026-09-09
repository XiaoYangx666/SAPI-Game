export * from "./virtualMinecraft";

import {
    ItemComponentTypes as BaseItemComponentTypes,
    ItemStack,
    Player,
} from "./virtualMinecraft";

// Keep tiny per-value state only for ScriptAPI methods that game lifecycle code
// expects to call. This deliberately does not model Minecraft world behavior.
const spawnPoints = new WeakMap<Player, any>();
const canPlaceOn = new WeakMap<ItemStack, string[]>();
const canDestroy = new WeakMap<ItemStack, string[]>();
const durabilityComponents = new WeakMap<ItemStack, any>();
const enchantableComponents = new WeakMap<ItemStack, any>();

export const ItemComponentTypes = {
    ...BaseItemComponentTypes,
    Enchantable: "minecraft:enchantable",
} as const;

export const EnchantmentTypes = {
    get(id: string) {
        return { id };
    },
    getAll() {
        return [];
    },
};

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
itemStackPrototype.getComponent = function (type: any) {
    const key = String(type);
    if (type === ItemComponentTypes.Durability || key.includes("durability")) {
        let component = durabilityComponents.get(this);
        if (!component) {
            component = { damage: 0, maxDurability: 100 };
            durabilityComponents.set(this, component);
        }
        return component;
    }
    if (type === ItemComponentTypes.Enchantable || key.includes("enchantable")) {
        let component = enchantableComponents.get(this);
        if (!component) {
            const enchantments: any[] = [];
            component = {
                addEnchantment(enchantment: any) {
                    enchantments.push(enchantment);
                },
                getEnchantments() {
                    return [...enchantments];
                },
            };
            enchantableComponents.set(this, component);
        }
        return component;
    }
    return undefined;
};
