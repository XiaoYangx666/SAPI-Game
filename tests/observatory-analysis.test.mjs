import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
    eventFamily,
    eventSeverity,
    eventSubtype,
    isInternalEvent,
    summarizeEvent,
} from "../packages/observatory/src/analysis.mjs";
import { decodeTracePayload } from "../packages/observatory/src/decode.mjs";

function realTrace() {
    return readFileSync(new URL("../traces/a.txt", import.meta.url));
}

test("analysis is generic: families come from type namespaces only", () => {
    expect(eventFamily("game.created")).toBe("game");
    expect(eventFamily("state.push")).toBe("state");
    expect(eventFamily("component.attached")).toBe("component");
    expect(eventFamily("participation.joined")).toBe("participation");
    expect(eventFamily("player.connect")).toBe("connection");
    expect(eventFamily("disconnect_timeout.expired")).toBe("timeout");
    expect(eventFamily("runner.cancelled")).toBe("runtime");
    expect(eventFamily("debug.message")).toBe("debug");
    expect(eventFamily("anything.custom")).toBe("domain");
    expect(eventFamily("plain")).toBe("domain");
});

test("severity and internal classification are namespace-based", () => {
    expect(eventSeverity("component.error")).toBe("error");
    expect(eventSeverity("x.transition.rejected")).toBe("error");
    expect(eventSeverity("state.transition")).toBe("accent");
    expect(eventSeverity("state.enter")).toBe("muted");
    expect(eventSeverity("game.started")).toBe("normal");

    expect(isInternalEvent("runner.cancelled")).toBe(true);
    expect(isInternalEvent("component.attach_started")).toBe(true);
    expect(isInternalEvent("component.attach_failed")).toBe(false);
    expect(isInternalEvent("doudizhu.event")).toBe(false);
});

test("envelope subtype and summary are read generically", () => {
    const event = {
        sequence: 1,
        tick: 0,
        typeId: 0,
        type: "anything.event",
        source: { kind: "game" },
        payload: { type: "round.started", seat: 2, ok: true, nested: { a: 1 } },
    };
    expect(eventSubtype(event)).toBe("round.started");
    // Only scalar fields are summarized; `type` is the subtype, not a field.
    expect(summarizeEvent(event)).toBe("seat=2 ok=true");
    expect(eventSubtype({ ...event, payload: {} })).toBeUndefined();
});

test("real trace analysis is structured without any game-specific rules", () => {
    const result = decodeTracePayload(realTrace());
    expect(result.ok).toBe(true);
    const analysis = result.analysis;
    expect(analysis).toBeTruthy();
    expect(analysis.gameType).toBe("doudizhu");

    // The real trace's noise is framework internals, not domain events.
    expect(analysis.families.runtime).toBeGreaterThan(100);
    expect(analysis.internalCount).toBeGreaterThan(100);
    expect(analysis.internalByType["runner.cancelled"]).toBeGreaterThan(100);

    // Business events are recognised as an envelope and keep their subtype.
    expect(analysis.families.domain).toBeGreaterThan(100);
    const played = analysis.domainTypes.find((entry) => entry.subtype === "cards.played");
    expect(played?.count).toBeGreaterThan(10);

    // Exactly one diagnostic, and it is the rejected transition.
    expect(analysis.errorCount).toBe(1);
    expect(analysis.diagnostics[0].type).toBe("doudizhu.transition.rejected");

    // Participants and structure come from the generic context builder.
    expect(analysis.players).toHaveLength(4);
    expect(analysis.seats).toHaveLength(3);
    expect(analysis.components.length).toBeGreaterThan(5);
    expect(analysis.stateTree.length).toBeGreaterThan(1);
});
