import { expect, test } from "vitest";
import { TraceManager, decodeBegTrace } from "../packages/trace/dist/index.js";
import { zipFiles } from "../packages/observatory/server/zip.ts";

test("running trace snapshots contain recent events without ending the session", () => {
    let tick = 10;
    const trace = new TraceManager(() => tick);
    trace.store.enable();
    const session = trace.beginSession({ gameType: "probe", gameKey: "probe:1" });
    expect(session).toBeDefined();
    session.game.debug("first");
    const first = decodeBegTrace(trace.snapshotBytes(session.header.sessionId));
    expect(first.events.map((event) => event.payload.message)).toContain("first");
    expect(first.end.endReason).toBe("live-snapshot");
    expect(trace.store.list()[0].status).toBe("running");

    tick++;
    session.game.debug("second");
    const next = decodeBegTrace(trace.snapshotBytes(session.header.sessionId));
    expect(next.events.map((event) => event.payload.message)).toEqual(["first", "second"]);
    trace.endSession("probe:1", "completed");
    expect(decodeBegTrace(trace.snapshotBytes(session.header.sessionId)).end.status).toBe("completed");
});

test("batch ZIP contains named trace files", async () => {
    const zip = zipFiles([{ name: "one.begtrace", bytes: Buffer.from("BEGT") }, { name: "two.begtrace", bytes: Buffer.from("data") }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2);
    expect(zip.includes(Buffer.from("one.begtrace"))).toBe(true);
    expect(zip.includes(Buffer.from("two.begtrace"))).toBe(true);
});
