/**
 * Minecraft binding for BEGame Trace.
 *
 * This is the only module in the package that knows about Minecraft, and the
 * only one that depends on `@begame/core`. It supplies the three storage seams
 * — world dynamic properties, the tick scheduler and the worldLoad gate — and
 * assembles the runtime that `@begame/core` is handed.
 *
 * It is a separate entry rather than part of the root so that importing the
 * codec never pulls `@minecraft/server` or `@begame/core`.
 */
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, system, world } from "@minecraft/server";
import { isWorldLoaded, runAfterWorldLoad } from "@begame/core/world-ready";
import { TraceManager } from "./manager";
import { encodeBase64 } from "./base64";
import {
    TRACE_BRIDGE_OBJECTIVE,
    TRACE_BRIDGE_PROTOCOL,
    buildTraceBridgeEntry,
    buildTraceBridgeEntryPrefix,
} from "./bridgeRegistry";
import type { TraceBridgeInfo } from "./bridgeRegistry";
import type { TraceStorage, TraceStoredValue } from "./storage";
import type { TraceSessionOptions } from "./types";

export * from "./bridgeRegistry";

export function createMinecraftTraceStorage(): TraceStorage {
    return {
        kv: {
            set(key, value) {
                world.setDynamicProperty(key, value);
            },
            get(key) {
                return world.getDynamicProperty(key) as TraceStoredValue;
            },
            keys() {
                return world.getDynamicPropertyIds();
            },
        },
        scheduler: {
            every: (ticks, callback) => system.runInterval(callback, ticks),
            cancel: (handle) => system.clearRun(handle),
        },
        gate: {
            isReady: () => isWorldLoaded(),
            afterReady: (callback) => runAfterWorldLoad(callback),
        },
    };
}

export interface CreateTraceRuntimeOptions extends TraceSessionOptions {
    /** Tick source used to stamp events. Defaults to `system.currentTick`. */
    readonly tick?: () => number;
}

/**
 * Builds the trace runtime to hand to `@begame/core`.
 *
 * Internal trace failures are reported through `onInternalError` and never
 * propagate into gameplay; the default writes to the Content Log so a broken
 * sink is visible during development.
 */
export function createTraceRuntime(
    options: CreateTraceRuntimeOptions = {}
): TraceManager {
    const { tick, ...sessionOptions } = options;
    return new TraceManager(tick ?? (() => system.currentTick), {
        onInternalError(error) {
            console.error("[BEGame] Trace internal error:", error);
        },
        ...sessionOptions,
        storage: createMinecraftTraceStorage(),
    });
}

export const CONNECT_PART_CHARS = 8192;
const PAGE_SIZE = 10;
const PREFIX = "BGTRACE1:";

/** Options for {@link registerTraceConnectCommands}. */
export interface TraceConnectCommandOptions {
    /**
     * Namespace the bridge commands are registered under.
     *
     * Bedrock permits exactly one custom-command namespace per add-on
     * (`CustomCommandErrorReason.NamespaceMismatch`), so this must match the
     * namespace the pack already uses, e.g. `game` for PartyGames or `ddz` for
     * Dou Dizhu. Defaults to `begame` for the standalone probe pack.
     */
    readonly namespace?: string;
    /**
     * When set, the pack also advertises itself in
     * {@link TRACE_BRIDGE_OBJECTIVE} after worldLoad, so a `/connect` client can
     * discover its namespace with `/scoreboard players list`.
     */
    readonly bridge?: TraceBridgeInfo;
}

function success(value: unknown) {
    return { status: CustomCommandStatus.Success, message: PREFIX + JSON.stringify(value) };
}

function failure(message: string) {
    return { status: CustomCommandStatus.Failure, message: PREFIX + JSON.stringify({ error: message }) };
}

function normalizeNamespace(namespace?: string): string | undefined {
    const value = namespace?.trim() || "begame";
    return /^[a-z0-9_]+$/.test(value) ? value : undefined;
}

/**
 * Writes (or refreshes) this pack's registry entry. Scoreboard access is only
 * safe after worldLoad, and a failed advertisement must never affect gameplay.
 */
export function publishTraceBridgeEntry(
    namespace: string,
    info: TraceBridgeInfo = {}
): void {
    try {
        const board = world.scoreboard;
        const objective =
            board.getObjective(TRACE_BRIDGE_OBJECTIVE) ??
            board.addObjective(TRACE_BRIDGE_OBJECTIVE, "BEGameBridge");
        const entry = buildTraceBridgeEntry(namespace, info);
        const ownPrefix = buildTraceBridgeEntryPrefix(namespace);
        // Drop this pack's stale advertisements (e.g. an older version) before
        // writing the current one, so discovery never sees duplicates.
        for (const identity of objective.getParticipants()) {
            const name = identity.displayName;
            if (name !== entry && name.startsWith(ownPrefix)) {
                objective.removeParticipant(name);
            }
        }
        objective.setScore(entry, TRACE_BRIDGE_PROTOCOL);
    } catch (error) {
        console.warn("[BEGame] Trace bridge registry write failed:", error);
    }
}

/**
 * Register read-only commands that return trace data through commandResponse,
 * and optionally advertise the pack in the shared scoreboard registry.
 *
 * The caller must invoke this while registering its behavior pack, before
 * `system.beforeEvents.startup`. Replies to /connect requests use
 * commandResponse; manually running these commands may display their payload
 * in chat.
 */
export function registerTraceConnectCommands(
    trace: TraceManager,
    options: TraceConnectCommandOptions = {}
): void {
    const namespace = normalizeNamespace(options.namespace);
    if (!namespace) {
        console.error(
            `[BEGame] Invalid trace bridge namespace: ${JSON.stringify(options.namespace)}`
        );
        return;
    }
    const bridge = options.bridge;
    if (bridge) {
        runAfterWorldLoad(() => publishTraceBridgeEntry(namespace, bridge));
    }

    let cached: { id: string; base64: string } | undefined;
    system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
        customCommandRegistry.registerCommand({
            name: `${namespace}:tracelist`,
            description: "List stored BEGame trace sessions for a /connect client",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [{ name: "page", type: CustomCommandParamType.Integer }],
        }, (_origin, page: number) => {
            if (!Number.isSafeInteger(page) || page < 0) return failure("invalid_page");
            try {
                const all = trace.store.list();
                return success({ kind: "list", page, total: all.length, sessions: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) });
            } catch { return failure("store_unavailable"); }
        });

        customCommandRegistry.registerCommand({
            name: `${namespace}:traceinfo`,
            description: "Get a stored BEGame trace container size",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [{ name: "session", type: CustomCommandParamType.String }],
        }, (_origin, id: string) => {
            try {
                const summary = trace.store.list().find((entry) => entry.sessionId === id);
                if (!summary) return failure("not_found");
                cached = { id, base64: encodeBase64(trace.snapshotBytes(id)) };
                return success({ kind: "info", id, chars: cached.base64.length, parts: Math.ceil(cached.base64.length / CONNECT_PART_CHARS) });
            } catch { return failure("trace_unavailable"); }
        });

        customCommandRegistry.registerCommand({
            name: `${namespace}:tracepart`,
            description: "Read a stored BEGame trace container part",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                { name: "session", type: CustomCommandParamType.String },
                { name: "part", type: CustomCommandParamType.Integer },
            ],
        }, (_origin, id: string, part: number) => {
            if (!cached || cached.id !== id) return failure("request_info_first");
            if (!Number.isSafeInteger(part) || part < 0 || part * CONNECT_PART_CHARS >= cached.base64.length) {
                return failure("invalid_part");
            }
            return success({ kind: "part", id, part, data: cached.base64.slice(part * CONNECT_PART_CHARS, (part + 1) * CONNECT_PART_CHARS) });
        });
    });
}
