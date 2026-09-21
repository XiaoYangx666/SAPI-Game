/**
 * Regenerates `tests/fixtures/observatory-sample.begtrace`.
 *
 * The observatory tests used to read `traces/a.txt`, which `.gitignore`
 * excludes. That made them depend on whatever a developer happened to have
 * locally: on a fresh clone the file is missing, and even locally the counts
 * baked into the assertions drift as soon as anyone records a new trace. The
 * tests therefore failed for reasons unrelated to the code under test.
 *
 * The fixture is generated through the real `TraceManager`, so the bytes are
 * always a valid container and the event mix is deterministic. Run this after
 * changing the trace format:
 *
 * ```bash
 * npm run build && node scripts/make-observatory-fixture.mjs
 * ```
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BuiltinTraceEventType, TraceManager, defineTraceEvent } from "../packages/trace/dist/index.js";

const OUTPUT = fileURLToPath(
    new URL("../tests/fixtures/observatory-sample.begtrace", import.meta.url)
);

/** Business events use the custom-schema path, like a real game would. */
const cardsPlayed = defineTraceEvent("cards.played", { seat: "int", count: "int" });
const roundStarted = defineTraceEvent("round.started", { seat: "int" });
const matchFinished = defineTraceEvent("match.finished", { winner: "int" });
const transitionRejected = defineTraceEvent("doudizhu.transition.rejected", {
    from: "string",
    to: "string",
    reason: "string",
});
const participationJoined = defineTraceEvent("participation.joined", {
    player: "string",
    // `seat` plus `kind` is what lets the workbench build its seat grid; the
    // context builder needs both on the same event.
    seat: "int",
    kind: "string",
});

// A fixed tick source keeps every byte of the output reproducible.
let tick = 100;
const trace = new TraceManager(() => tick);
// Without a sink or an accepting store, `beginSession` returns undefined.
trace.store.enable();
const session = trace.beginSession({ gameType: "doudizhu", gameKey: "doudizhu:fixture" });

// Framework internals: these are what `families.runtime` counts. `builtin`
// takes the numeric enum member; a bare string is silently dropped.
for (let index = 0; index < 12; index++) {
    session.game.builtin(BuiltinTraceEventType.RunnerCancelled, { reason: "replaced", index });
}

// Domain events: business facts that must stay classified as `domain`.
for (let round = 0; round < 5; round++) {
    tick += 10;
    session.game.emit(cardsPlayed, { seat: round % 3, count: 2 });
    session.game.emit(roundStarted, { seat: round % 3 });
}
tick += 10;
session.game.emit(matchFinished, { winner: 0 });

// Exactly one rejected transition, so the diagnostics path has one entry.
tick += 10;
session.game.emit(transitionRejected, { from: "bidding", to: "playing", reason: "illegal" });

// Participants, so the generic context builder has something to summarise.
// Seats are 0-based, matching how the game reports them.
for (const [seat, player] of ["Alice", "Bob", "Carol", "Dave"].entries()) {
    session.participation.emit(participationJoined, { player, seat, kind: "player" });
}

tick += 10;
trace.endSession("doudizhu:fixture", "completed");

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, trace.snapshotBytes(session.header.sessionId));
console.log(`Wrote ${resolve(OUTPUT)}`);

// `TraceManager` may hold timers (store maintenance); this script has no more
// work to do once the file is written.
process.exit(0);
