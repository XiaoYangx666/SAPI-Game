type Callback<T = any> = (event: T) => void;

class VirtualEventSignal<T = any> {
    private readonly callbacks = new Set<Callback<T>>();

    subscribe(callback: Callback<T>) {
        this.callbacks.add(callback);
        return callback;
    }

    unsubscribe(callback: Callback<T>) {
        this.callbacks.delete(callback);
    }

    emit(event: T) {
        for (const callback of [...this.callbacks]) callback(event);
    }

    clear() {
        this.callbacks.clear();
    }

    get size() {
        return this.callbacks.size;
    }
}

class SignalCollection {
    private readonly signals = new Map<string | symbol, VirtualEventSignal>();

    readonly proxy = new Proxy(
        {},
        {
            get: (_target, key) => this.get(key),
        }
    ) as Record<string, VirtualEventSignal>;

    get(key: string | symbol) {
        let signal = this.signals.get(key);
        if (!signal) {
            signal = new VirtualEventSignal();
            this.signals.set(key, signal);
        }
        return signal;
    }

    clear() {
        for (const signal of this.signals.values()) signal.clear();
        this.signals.clear();
    }
}

interface ScheduledRun {
    callback: () => void;
    nextTick: number;
    interval?: number;
}

interface TickWaiter {
    targetTick: number;
    resolve: () => void;
}

class VirtualSystem {
    private nextId = 1;
    private readonly runs = new Map<number, ScheduledRun>();
    private readonly jobs = new Map<number, Generator<void, void, void>>();
    private readonly waiters: TickWaiter[] = [];
    private readonly beforeSignals = new SignalCollection();
    private readonly afterSignals = new SignalCollection();

    currentTick = 0;
    readonly beforeEvents = this.beforeSignals.proxy;
    readonly afterEvents = this.afterSignals.proxy;

    run(callback: () => void) {
        return this.runTimeout(callback, 1);
    }

    runTimeout(callback: () => void, tickDelay = 0) {
        const id = this.nextId++;
        this.runs.set(id, {
            callback,
            nextTick: this.currentTick + Math.max(1, Math.floor(tickDelay)),
        });
        return id;
    }

    runInterval(callback: () => void, tickInterval = 1) {
        const interval = Math.max(1, Math.floor(tickInterval));
        const id = this.nextId++;
        this.runs.set(id, {
            callback,
            nextTick: this.currentTick + interval,
            interval,
        });
        return id;
    }

    clearRun(id: number) {
        this.runs.delete(id);
    }

    waitTicks(ticks: number) {
        const targetTick = this.currentTick + Math.max(0, Math.floor(ticks));
        return new Promise<void>((resolve) => {
            if (targetTick <= this.currentTick) {
                resolve();
                return;
            }
            this.waiters.push({ targetTick, resolve });
        });
    }

    runJob(generator: Generator<void, void, void>) {
        const id = this.nextId++;
        this.jobs.set(id, generator);
        return id;
    }

    clearJob(id: number) {
        this.jobs.delete(id);
    }

    async advanceTicks(ticks: number) {
        const count = Math.max(0, Math.floor(ticks));
        for (let i = 0; i < count; i++) {
            this.currentTick++;

            for (const [id, run] of [...this.runs]) {
                if (run.nextTick > this.currentTick) continue;
                run.callback();
                if (run.interval) run.nextTick += run.interval;
                else this.runs.delete(id);
            }

            for (const [id, job] of [...this.jobs]) {
                const next = job.next();
                if (next.done) this.jobs.delete(id);
            }

            for (let index = this.waiters.length - 1; index >= 0; index--) {
                if (this.waiters[index].targetTick > this.currentTick) continue;
                const [waiter] = this.waiters.splice(index, 1);
                waiter.resolve();
            }

            await Promise.resolve();
            await Promise.resolve();
        }
    }

    resetScriptResources() {
        this.runs.clear();
        this.jobs.clear();
        for (const waiter of this.waiters.splice(0)) waiter.resolve();
        this.beforeSignals.clear();
        this.afterSignals.clear();
    }
}

class VirtualContainer {
    readonly items: any[] = [];

    addItem(item: any) {
        this.items.push(item);
        return undefined;
    }

    getItem(slot: number) {
        return this.items[slot];
    }

    setItem(slot: number, item?: any) {
        if (item === undefined) this.items.splice(slot, 1);
        else this.items[slot] = item;
    }
}

export class Player {
    private _online = true;
    readonly messages: any[] = [];
    readonly commands: string[] = [];
    readonly effects: Array<{ type: any; duration: number; options?: any }> = [];
    readonly inventory = new VirtualContainer();
    readonly onScreenDisplay = {
        setTitle: (_title: any, _options?: any) => undefined,
        setActionBar: (_text: any) => undefined,
    };
    location = { x: 0, y: 0, z: 0 };
    dimension: Dimension;

    constructor(
        public readonly id: string,
        public readonly name: string = id,
        dimensionId = "minecraft:overworld"
    ) {
        this.dimension = virtualMinecraft.getDimension(dimensionId);
    }

    get isValid() {
        return this._online;
    }

    _setOnline(value: boolean) {
        this._online = value;
    }

    sendMessage(message: any) {
        this.messages.push(message);
    }

    runCommand(command: string) {
        this.commands.push(command);
        return { successCount: 1 };
    }

    getComponent(type: any) {
        if (type === EntityComponentTypes.Inventory || String(type).includes("inventory")) {
            return { container: this.inventory };
        }
        if (type === EntityComponentTypes.Health || String(type).includes("health")) {
            return { currentValue: 20, defaultValue: 20, effectiveMax: 20 };
        }
        return undefined;
    }

    addEffect(type: any, duration: number, options?: any) {
        this.effects.push({ type, duration, options });
    }

    teleport(location: any, options?: any) {
        this.location = { ...location };
        if (options?.dimension) this.dimension = options.dimension;
    }

    setSpawnPoint(_spawnPoint?: any) {}
    setGameMode(_mode: any) {}
    getGameMode() {
        return GameMode.Adventure;
    }
}

export class Entity {
    isValid = true;
    location = { x: 0, y: 0, z: 0 };
    dimension = virtualMinecraft.getDimension("minecraft:overworld");
}

export class Block {
    location = { x: 0, y: 0, z: 0 };
    typeId = "minecraft:air";
    dimension = virtualMinecraft.getDimension("minecraft:overworld");
}

export class Dimension {
    constructor(public readonly id: string) {}

    getPlayers() {
        return virtualMinecraft.getAllPlayers().filter((player) => player.dimension.id === this.id);
    }

    getEntities() {
        return [];
    }

    getBlock(location: any) {
        const block = new Block();
        block.location = { ...location };
        block.dimension = this;
        return block;
    }

    runCommand(_command: string) {
        return { successCount: 1 };
    }

    spawnEntity(_type: string, location: any) {
        const entity = new Entity();
        entity.location = { ...location };
        entity.dimension = this;
        return entity;
    }

    spawnItem(_item: any, location: any) {
        return this.spawnEntity("minecraft:item", location);
    }
}

export class BlockVolume {
    constructor(public readonly from: any, public readonly to: any) {}
}

export class ItemStack {
    amount = 1;
    nameTag?: string;
    constructor(public readonly typeId: string, amount = 1) {
        this.amount = amount;
    }
}

export class MolangVariableMap {}

class VirtualObjective {
    private readonly scores = new Map<any, number>();
    displayName: string;

    constructor(public readonly id: string, displayName?: string) {
        this.displayName = displayName ?? id;
    }

    setScore(participant: any, score: number) {
        this.scores.set(participant, score);
    }

    getScore(participant: any) {
        return this.scores.get(participant);
    }

    removeParticipant(participant: any) {
        return this.scores.delete(participant);
    }

    getParticipants() {
        return [...this.scores.keys()];
    }
}

class VirtualScoreboard {
    private readonly objectives = new Map<string, VirtualObjective>();

    addObjective(id: string, displayName?: string) {
        const objective = new VirtualObjective(id, displayName);
        this.objectives.set(id, objective);
        return objective;
    }

    getObjective(id: string) {
        return this.objectives.get(id);
    }

    removeObjective(idOrObjective: string | VirtualObjective) {
        return this.objectives.delete(
            typeof idOrObjective === "string" ? idOrObjective : idOrObjective.id
        );
    }

    getObjectives() {
        return [...this.objectives.values()];
    }

    setObjectiveAtDisplaySlot(_slot: any, options: any) {
        return options?.objective;
    }

    clearObjectiveAtDisplaySlot(_slot: any) {}

    clear() {
        this.objectives.clear();
    }
}

class VirtualMinecraftRuntime {
    readonly system = new VirtualSystem();
    private readonly afterSignals = new SignalCollection();
    private readonly beforeSignals = new SignalCollection();
    private readonly dimensions = new Map<string, Dimension>();
    private readonly players = new Map<string, Player>();
    readonly scoreboard = new VirtualScoreboard();

    readonly world = {
        afterEvents: this.afterSignals.proxy,
        beforeEvents: this.beforeSignals.proxy,
        scoreboard: this.scoreboard,
        structureManager: {
            get: (_id: string) => undefined,
            createFromWorld: (_id: string, _dimension: Dimension, _from: any, _to: any, _options?: any) => ({}),
            place: (_structure: any, _dimension: Dimension, _location: any, _options?: any) => undefined,
            delete: (_id: string) => false,
        },
        getAllPlayers: () => this.getAllPlayers(),
        getPlayers: () => this.getAllPlayers(),
        getDimension: (id: string) => this.getDimension(id),
        sendMessage: (_message: any) => undefined,
    };

    getDimension(id: string) {
        let dimension = this.dimensions.get(id);
        if (!dimension) {
            dimension = new Dimension(id);
            this.dimensions.set(id, dimension);
        }
        return dimension;
    }

    getAllPlayers() {
        return [...this.players.values()].filter((player) => player.isValid);
    }

    getPlayer(id: string) {
        return this.players.get(id);
    }

    connectPlayer(id: string, name = id) {
        let player = this.players.get(id);
        if (!player) {
            player = new Player(id, name);
            this.players.set(id, player);
        }
        player._setOnline(true);
        this.afterSignals.get("playerSpawn").emit({ player, initialSpawn: true });
        return player;
    }

    disconnectPlayer(id: string) {
        const player = this.players.get(id);
        if (!player || !player.isValid) return false;
        player._setOnline(false);
        this.afterSignals.get("playerLeave").emit({
            playerId: player.id,
            playerName: player.name,
        });
        return true;
    }

    emitAfterEvent(name: string, event: any) {
        this.afterSignals.get(name).emit(event);
    }

    emitBeforeEvent(name: string, event: any) {
        this.beforeSignals.get(name).emit(event);
    }

    emitSystemBeforeEvent(name: string, event: any) {
        (this.system.beforeEvents[name] as VirtualEventSignal).emit(event);
    }

    async advanceTicks(ticks: number) {
        await this.system.advanceTicks(ticks);
    }

    resetScriptResources() {
        this.system.resetScriptResources();
        this.afterSignals.clear();
        this.beforeSignals.clear();
    }

    resetWorld() {
        this.resetScriptResources();
        this.players.clear();
        this.dimensions.clear();
        this.scoreboard.clear();
        this.system.currentTick = 0;
    }
}

export const virtualMinecraft = new VirtualMinecraftRuntime();
export const system = virtualMinecraft.system;
export const world = virtualMinecraft.world;

export const EntityComponentTypes = {
    Inventory: "minecraft:inventory",
    Health: "minecraft:health",
    Equippable: "minecraft:equippable",
} as const;

export const ItemComponentTypes = {
    Durability: "minecraft:durability",
} as const;

export const EquipmentSlot = {
    Head: "Head",
    Chest: "Chest",
    Legs: "Legs",
    Feet: "Feet",
    Mainhand: "Mainhand",
    Offhand: "Offhand",
} as const;

export const GameMode = {
    Survival: "Survival",
    Creative: "Creative",
    Adventure: "Adventure",
    Spectator: "Spectator",
} as const;

export const DisplaySlotId = { Sidebar: "Sidebar", List: "List", BelowName: "BelowName" } as const;
export const ObjectiveSortOrder = { Ascending: 0, Descending: 1 } as const;
export const StructureSaveMode = { Memory: "Memory", World: "World" } as const;
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 } as const;
export const CustomCommandParamType = { String: "String", Integer: "Integer", Boolean: "Boolean", PlayerSelector: "PlayerSelector" } as const;
export const CustomCommandStatus = { Success: 0, Failure: 1 } as const;
export const EntityDamageCause = {} as const;
export const EasingType = {} as const;
export const InputPermissionCategory = {} as const;
export const PlayerPermissionLevel = {} as const;
export const MinecraftDimensionTypes = {
    Overworld: "minecraft:overworld",
    Nether: "minecraft:nether",
    TheEnd: "minecraft:the_end",
} as const;
