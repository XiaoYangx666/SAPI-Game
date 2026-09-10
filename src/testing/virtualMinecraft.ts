declare const setImmediate: (callback: () => void) => unknown;

type Callback<T = any> = (event: T) => void;
type Vector3 = { x: number; y: number; z: number };

const DEFAULT_TICK_DURATION_MS = 50;
const DEFAULT_VIRTUAL_EPOCH_MS = 1_700_000_000_000;
let virtualNowMs = DEFAULT_VIRTUAL_EPOCH_MS;

// Headless tests use tick time instead of wall-clock time so timers can be
// advanced deterministically together with the game lifecycle.
Date.now = () => virtualNowMs;

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
    private readonly persistentKeys = new Set<string | symbol>();

    constructor(persistentKeys: Iterable<string | symbol> = []) {
        for (const key of persistentKeys) this.persistentKeys.add(key);
    }

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
        for (const [key, signal] of [...this.signals]) {
            if (this.persistentKeys.has(key)) continue;
            signal.clear();
            this.signals.delete(key);
        }
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
    tickDurationMs = DEFAULT_TICK_DURATION_MS;
    readonly beforeEvents = this.beforeSignals.proxy;
    readonly afterEvents = this.afterSignals.proxy;

    get currentTimeMs() {
        return virtualNowMs;
    }

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

    emitBeforeEvent(name: string, event: any) {
        this.beforeSignals.get(name).emit(event);
    }

    emitAfterEvent(name: string, event: any) {
        this.afterSignals.get(name).emit(event);
    }

    async advanceTicks(ticks: number) {
        const count = Math.max(0, Math.floor(ticks));
        for (let i = 0; i < count; i++) {
            this.currentTick++;
            virtualNowMs += this.tickDurationMs;

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

            // Promise adoption may add more microtasks than two Promise.resolve()
            // turns. Crossing one macrotask boundary settles the whole tick before
            // the next virtual tick begins.
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
    }

    resetScriptResources() {
        this.runs.clear();
        this.jobs.clear();
        for (const waiter of this.waiters.splice(0)) waiter.resolve();
        this.beforeSignals.clear();
        this.afterSignals.clear();
    }

    resetClock() {
        this.currentTick = 0;
        virtualNowMs = DEFAULT_VIRTUAL_EPOCH_MS;
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

/**
 * Lightweight ScriptAPI value shell. It intentionally does not model world
 * block state; tests should inject the game event they want to exercise.
 */
export class BlockPermutation {
    constructor(
        public readonly typeName: string,
        public readonly states: Record<string, any> = {}
    ) {}

    static resolve(typeName: string, states: Record<string, any> = {}) {
        return new BlockPermutation(typeName, states);
    }

    getState(name: string) {
        return this.states[name];
    }

    getAllStates() {
        return { ...this.states };
    }

    withState(name: string, value: any) {
        return new BlockPermutation(this.typeName, {
            ...this.states,
            [name]: value,
        });
    }
}

export class BlockType {
    constructor(public readonly id: string) {}
    get name() {
        return this.id;
    }
}

export class BlockLocationIterator {}

export class Player {
    private _online = true;
    private readonly tags = new Set<string>();
    private readonly equipment = new Map<any, any>();
    private gameMode: any = GameMode.Adventure;
    readonly messages: any[] = [];
    readonly commands: string[] = [];
    readonly effects: Array<{ type: any; duration: number; options?: any }> = [];
    readonly inventory = new VirtualContainer();
    readonly onScreenDisplay = {
        setTitle: (_title: any, _options?: any) => undefined,
        setActionBar: (_text: any) => undefined,
    };
    readonly camera = {
        clear: () => undefined,
        fadeIn: (_options?: any) => undefined,
        fadeOut: (_options?: any) => undefined,
        setCamera: (_preset: any, _options?: any) => undefined,
    };
    location: Vector3 = { x: 0, y: 0, z: 0 };
    dimension: Dimension;
    isOnGround = true;
    level = 0;

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

    playSound(_soundId: string, _options?: any) {}

    hasTag(tag: string) {
        return this.tags.has(tag);
    }

    addTag(tag: string) {
        const size = this.tags.size;
        this.tags.add(tag);
        return this.tags.size !== size;
    }

    removeTag(tag: string) {
        return this.tags.delete(tag);
    }

    getTags() {
        return [...this.tags];
    }

    getComponent(type: any) {
        const key = String(type);
        if (type === EntityComponentTypes.Inventory || key.includes("inventory")) {
            return { container: this.inventory };
        }
        if (type === EntityComponentTypes.Health || key.includes("health")) {
            return {
                currentValue: 20,
                defaultValue: 20,
                effectiveMax: 20,
            };
        }
        if (type === EntityComponentTypes.Equippable || key.includes("equippable")) {
            return {
                getEquipment: (slot: any) => this.equipment.get(slot),
                setEquipment: (slot: any, item?: any) => {
                    if (item === undefined) this.equipment.delete(slot);
                    else this.equipment.set(slot, item);
                    return true;
                },
            };
        }
        return undefined;
    }

    addEffect(type: any, duration: number, options?: any) {
        this.effects.push({ type, duration, options });
    }

    teleport(location: Vector3, options?: any) {
        this.location = { ...location };
        if (options?.dimension) this.dimension = options.dimension;
    }

    setSpawnPoint(_spawnPoint?: any) {}

    setGameMode(mode: any) {
        this.gameMode = mode;
    }

    getGameMode() {
        return this.gameMode;
    }

    getVelocity() {
        return { x: 0, y: 0, z: 0 };
    }

    clearVelocity() {}
    applyImpulse(_impulse: Vector3) {}

    getHeadLocation() {
        return { ...this.location };
    }

    addLevels(levels: number) {
        this.level += levels;
        return this.level;
    }

    resetLevel() {
        this.level = 0;
    }
}

export class Entity {
    private readonly tags = new Set<string>();
    isValid = true;
    location: Vector3 = { x: 0, y: 0, z: 0 };
    dimension = virtualMinecraft.getDimension("minecraft:overworld");

    hasTag(tag: string) {
        return this.tags.has(tag);
    }

    addTag(tag: string) {
        const size = this.tags.size;
        this.tags.add(tag);
        return this.tags.size !== size;
    }

    removeTag(tag: string) {
        return this.tags.delete(tag);
    }

    getTags() {
        return [...this.tags];
    }

    teleport(location: Vector3, options?: any) {
        this.location = { ...location };
        if (options?.dimension) this.dimension = options.dimension;
    }
}

export class Block {
    location: Vector3 = { x: 0, y: 0, z: 0 };
    typeId = "minecraft:air";
    dimension = virtualMinecraft.getDimension("minecraft:overworld");
    permutation = BlockPermutation.resolve("minecraft:air");

    getComponent(_type: any) {
        return undefined;
    }

    setPermutation(permutation: BlockPermutation) {
        // Deliberately local only: the headless runtime does not maintain a
        // persistent block world.
        this.permutation = permutation;
        this.typeId = permutation.typeName;
    }

    getRedstonePower() {
        return 0;
    }
}

export class Dimension {
    constructor(public readonly id: string) {}

    getPlayers(options?: any) {
        return virtualMinecraft
            .queryPlayers(options)
            .filter((player) => player.dimension.id === this.id);
    }

    getEntities(_options?: any) {
        return [];
    }

    getBlock(location: Vector3) {
        const block = new Block();
        block.location = { ...location };
        block.dimension = this;
        return block;
    }

    setBlockType(_location: Vector3, _blockType: string | BlockType) {}
    setBlockPermutation(_location: Vector3, _permutation: BlockPermutation) {}

    fillBlocks(_volume: any, _block: any) {
        return 0;
    }

    getTopmostBlock(_location: any) {
        return undefined;
    }

    getBlockFromRay(_location: any, _direction: any, _options?: any) {
        return undefined;
    }

    runCommand(_command: string) {
        return { successCount: 1 };
    }

    spawnEntity(_type: string, location: Vector3) {
        const entity = new Entity();
        entity.location = { ...location };
        entity.dimension = this;
        return entity;
    }

    spawnItem(_item: any, location: Vector3) {
        return this.spawnEntity("minecraft:item", location);
    }
}

/** Import-compatible shell only; geometry is intentionally not simulated. */
export class BlockVolume {
    constructor(public readonly from: Vector3, public readonly to: Vector3) {}
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
    isValid = true;

    constructor(public readonly id: string, displayName?: string) {
        this.displayName = displayName ?? id;
    }

    setScore(participant: any, score: number) {
        this.scores.set(participant, score);
        return score;
    }

    getScore(participant: any) {
        if (this.scores.has(participant)) return this.scores.get(participant);
        const id = participant?.id ?? participant?.displayName ?? participant;
        if (this.scores.has(id)) return this.scores.get(id);
        return undefined;
    }

    hasParticipant(participant: any) {
        return this.getScore(participant) !== undefined;
    }

    addScore(participant: any, score: number) {
        const next = (this.getScore(participant) ?? 0) + score;
        this.scores.set(participant, next);
        return next;
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
    private readonly displaySlots = new Map<string, any>();

    addObjective(id: string, displayName?: string) {
        const objective = new VirtualObjective(id, displayName);
        this.objectives.set(id, objective);
        return objective;
    }

    getObjective(id: string) {
        return this.objectives.get(id);
    }

    removeObjective(idOrObjective: string | VirtualObjective) {
        const id =
            typeof idOrObjective === "string" ? idOrObjective : idOrObjective.id;
        const objective = this.objectives.get(id);
        if (objective) objective.isValid = false;
        return this.objectives.delete(id);
    }

    getObjectives() {
        return [...this.objectives.values()];
    }

    setObjectiveAtDisplaySlot(slot: any, options: any) {
        this.displaySlots.set(String(slot), options);
        return options?.objective;
    }

    getObjectiveAtDisplaySlot(slot: any) {
        return this.displaySlots.get(String(slot));
    }

    clearObjectiveAtDisplaySlot(slot: any) {
        const existing = this.displaySlots.get(String(slot));
        this.displaySlots.delete(String(slot));
        return existing?.objective;
    }

    clear() {
        for (const objective of this.objectives.values()) {
            objective.isValid = false;
        }
        this.objectives.clear();
        this.displaySlots.clear();
    }
}

class VirtualMinecraftRuntime {
    readonly system = new VirtualSystem();
    private readonly afterSignals = new SignalCollection(["worldLoad"]);
    private readonly beforeSignals = new SignalCollection();
    private readonly dimensions = new Map<string, Dimension>();
    private readonly players = new Map<string, Player>();
    private readonly dynamicProperties = new Map<string, any>();

    readonly scoreboard = new VirtualScoreboard();
    readonly worldCommands: string[] = [];
    difficulty: any;
    timeOfDay: any;
    readonly gameRules: Record<string, any> = {};

    readonly world = {
        afterEvents: this.afterSignals.proxy,
        beforeEvents: this.beforeSignals.proxy,
        scoreboard: this.scoreboard,
        gameRules: this.gameRules,
        structureManager: {
            get: (_id: string) => undefined,
            createFromWorld: (
                _id: string,
                _dimension: Dimension,
                _from: any,
                _to: any,
                _options?: any
            ) => ({}),
            place: (
                _structure: any,
                _dimension: Dimension,
                _location: any,
                _options?: any
            ) => undefined,
            delete: (_id: string) => false,
        },
        getAllPlayers: () => this.getAllPlayers(),
        getPlayers: (options?: any) => this.queryPlayers(options),
        getDimension: (id: string) => this.getDimension(id),
        sendMessage: (_message: any) => undefined,
        runCommand: (command: string) => {
            this.worldCommands.push(command);
            return { successCount: 1 };
        },
        setDifficulty: (difficulty: any) => {
            this.difficulty = difficulty;
        },
        setTimeOfDay: (time: any) => {
            this.timeOfDay = time;
        },
        getAbsoluteTime: () => this.system.currentTick,
        setDynamicProperty: (key: string, value?: any) =>
            this.setDynamicProperty(key, value),
        getDynamicProperty: (key: string) => this.dynamicProperties.get(key),
        getDynamicPropertyIds: () => [...this.dynamicProperties.keys()],
        clearDynamicProperties: () => this.dynamicProperties.clear(),
        spawnParticle: (_effect: any, _location: any, _options?: any) => undefined,
        playMusic: (_id: any, _options?: any) => undefined,
        stopMusic: () => undefined,
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

    queryPlayers(options?: any) {
        let players = this.getAllPlayers();
        if (!options) return players;

        if (options.name !== undefined) {
            players = players.filter((player) => player.name === options.name);
        }
        if (Array.isArray(options.excludeNames)) {
            players = players.filter(
                (player) => !options.excludeNames.includes(player.name)
            );
        }
        if (Array.isArray(options.tags)) {
            players = players.filter((player) =>
                options.tags.every((tag: string) => player.hasTag(tag))
            );
        }
        if (Array.isArray(options.excludeTags)) {
            players = players.filter((player) =>
                options.excludeTags.every((tag: string) => !player.hasTag(tag))
            );
        }
        if (options.gameMode !== undefined) {
            players = players.filter(
                (player) => player.getGameMode() === options.gameMode
            );
        }
        if (Array.isArray(options.excludeGameModes)) {
            players = players.filter(
                (player) => !options.excludeGameModes.includes(player.getGameMode())
            );
        }
        if (Array.isArray(options.scoreOptions)) {
            players = players.filter((player) =>
                options.scoreOptions.every((scoreOption: any) => {
                    const objectiveId =
                        scoreOption.objective?.id ?? scoreOption.objective;
                    const objective = this.scoreboard.getObjective(objectiveId);
                    const score = objective?.getScore(player);
                    let matches = score !== undefined;
                    if (
                        matches &&
                        scoreOption.minScore !== undefined &&
                        score! < scoreOption.minScore
                    ) {
                        matches = false;
                    }
                    if (
                        matches &&
                        scoreOption.maxScore !== undefined &&
                        score! > scoreOption.maxScore
                    ) {
                        matches = false;
                    }
                    return scoreOption.exclude ? !matches : matches;
                })
            );
        }
        return players;
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
        this.afterSignals
            .get("playerSpawn")
            .emit({ player, initialSpawn: true });
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

    setDynamicProperty(key: string, value?: any) {
        if (value === undefined) this.dynamicProperties.delete(key);
        else this.dynamicProperties.set(key, value);
    }

    emitAfterEvent(name: string, event: any) {
        this.afterSignals.get(name).emit(event);
    }

    emitBeforeEvent(name: string, event: any) {
        this.beforeSignals.get(name).emit(event);
    }

    emitSystemAfterEvent(name: string, event: any) {
        this.system.emitAfterEvent(name, event);
    }

    emitSystemBeforeEvent(name: string, event: any) {
        this.system.emitBeforeEvent(name, event);
    }

    emitWorldLoad() {
        this.afterSignals.get("worldLoad").emit({});
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
        this.dynamicProperties.clear();
        this.worldCommands.length = 0;
        this.difficulty = undefined;
        this.timeOfDay = undefined;
        for (const key of Object.keys(this.gameRules)) delete this.gameRules[key];
        this.system.resetClock();
    }
}

function registry() {
    return {
        get(id: string) {
            return { id };
        },
        getAll() {
            return [];
        },
    };
}

export const virtualMinecraft = new VirtualMinecraftRuntime();
export const system = virtualMinecraft.system;
export const world = virtualMinecraft.world;

export const BlockTypes = registry();
export const ItemTypes = registry();
export const EntityTypes = registry();
export const EffectTypes = registry();

export const EntityComponentTypes = {
    Inventory: "minecraft:inventory",
    Health: "minecraft:health",
    Equippable: "minecraft:equippable",
} as const;

export const BlockComponentTypes = {} as const;

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

export const ItemLockMode = {
    inventory: "inventory",
    slot: "slot",
    hotbar: "hotbar",
    none: "none",
} as const;

export const Difficulty = {
    Peaceful: "Peaceful",
    Easy: "Easy",
    Normal: "Normal",
    Hard: "Hard",
} as const;

export const TimeOfDay = {
    Day: 1000,
    Noon: 6000,
    Sunset: 12000,
    Night: 13000,
    Midnight: 18000,
    Sunrise: 23000,
} as const;

export const StructureAnimationMode = {
    Blocks: "Blocks",
    None: "None",
} as const;

export const DisplaySlotId = {
    Sidebar: "Sidebar",
    List: "List",
    BelowName: "BelowName",
} as const;
export const ObjectiveSortOrder = { Ascending: 0, Descending: 1 } as const;
export const StructureSaveMode = { Memory: "Memory", World: "World" } as const;
export const StructureRotation = {} as const;
export const StructureMirrorAxis = {} as const;
export const Direction = {} as const;
export const ScoreboardIdentityType = {} as const;
export const CommandPermissionLevel = {
    Any: 0,
    GameDirectors: 1,
    Admin: 2,
    Host: 3,
    Owner: 4,
} as const;
export const CustomCommandParamType = {
    String: "String",
    Integer: "Integer",
    Boolean: "Boolean",
    PlayerSelector: "PlayerSelector",
} as const;
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