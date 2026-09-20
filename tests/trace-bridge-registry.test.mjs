import { expect, test } from "vitest";
import {
    buildTraceBridgeEntry,
    buildTraceBridgeEntryPrefix,
    parseTraceBridgeEntry,
    TRACE_BRIDGE_ENTRY_PREFIX,
    TRACE_BRIDGE_OBJECTIVE,
} from "../packages/trace/dist/index.js";

test("bridge entries round-trip the pack advertisement", () => {
    const name = buildTraceBridgeEntry("game", {
        packName: "小游戏行为包",
        packVersion: "1.0",
        games: ["pixelParty", "pof"],
    });

    expect(TRACE_BRIDGE_OBJECTIVE).toBe("begame_bridge");
    expect(name.startsWith(TRACE_BRIDGE_ENTRY_PREFIX)).toBe(true);
    expect(parseTraceBridgeEntry(name)).toEqual({
        namespace: "game",
        packName: "小游戏行为包",
        packVersion: "1.0",
        games: ["pixelParty", "pof"],
    });
});

test("only entries with the reserved prefix are recognized", () => {
    expect(parseTraceBridgeEntry("NotABridge")).toBeUndefined();
    expect(parseTraceBridgeEntry(TRACE_BRIDGE_ENTRY_PREFIX)).toBeUndefined();
    expect(buildTraceBridgeEntryPrefix("ddz")).toBe(`${TRACE_BRIDGE_ENTRY_PREFIX}ddz|`);
});

test("registry fields never contain the separator", () => {
    const name = buildTraceBridgeEntry("ddz", {
        packName: "a|b",
        packVersion: "1\r\n2",
    });

    expect(parseTraceBridgeEntry(name)?.packName).toBe("a_b");
    expect(parseTraceBridgeEntry(name)?.packVersion).toBe("1_2");
});
