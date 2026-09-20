/**
 * Shared `/connect` bridge registry format.
 *
 * Bedrock lets an add-on register custom commands in exactly one namespace and
 * keeps custom-command names global, so packs cannot know each other's command
 * names in advance. The scoreboard, however, is world-global and exposes
 * (fake) participant names. Each pack therefore advertises its own namespace by
 * writing one participant into {@link TRACE_BRIDGE_OBJECTIVE}; an external
 * `/connect` client runs `/scoreboard players list` to discover them.
 *
 * This module is platform-independent so the observatory can decode entries
 * without importing `@minecraft/server`.
 */

/** Objective that holds every pack's bridge advertisement. */
export const TRACE_BRIDGE_OBJECTIVE = "begame_bridge";
/** Prefix of every registry participant name. Bump with the format, never silently. */
export const TRACE_BRIDGE_ENTRY_PREFIX = "BEGAMEBRIDGE/1|";
/** Protocol version stored as the participant's score. */
export const TRACE_BRIDGE_PROTOCOL = 1;

/** Optional pack metadata advertised alongside the namespace. */
export interface TraceBridgeInfo {
    readonly packName?: string;
    readonly packVersion?: string;
    readonly games?: readonly string[];
}

/** One decoded registry participant name. */
export interface TraceBridgeEntry {
    readonly namespace: string;
    readonly packName: string;
    readonly packVersion: string;
    readonly games: readonly string[];
}

function registryField(value: string): string {
    return value.replace(/[|\r\n]+/g, "_").trim();
}

/** Prefix that matches every registry entry belonging to one namespace. */
export function buildTraceBridgeEntryPrefix(namespace: string): string {
    return `${TRACE_BRIDGE_ENTRY_PREFIX}${registryField(namespace)}|`;
}

/** Builds the participant name that advertises one pack in the registry. */
export function buildTraceBridgeEntry(
    namespace: string,
    info: TraceBridgeInfo = {}
): string {
    return (
        TRACE_BRIDGE_ENTRY_PREFIX +
        [
            registryField(namespace),
            registryField(info.packName ?? ""),
            registryField(info.packVersion ?? ""),
            (info.games ?? []).map(registryField).join(","),
        ].join("|")
    );
}

/** Decodes a registry participant name; returns undefined for foreign entries. */
export function parseTraceBridgeEntry(
    name: string
): TraceBridgeEntry | undefined {
    if (!name.startsWith(TRACE_BRIDGE_ENTRY_PREFIX)) return undefined;
    const [namespace = "", packName = "", packVersion = "", games = ""] = name
        .slice(TRACE_BRIDGE_ENTRY_PREFIX.length)
        .split("|");
    if (!namespace) return undefined;
    return {
        namespace,
        packName,
        packVersion,
        games: games ? games.split(",").filter(Boolean) : [],
    };
}
