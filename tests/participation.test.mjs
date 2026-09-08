import test from "node:test";
import assert from "node:assert/strict";
import {
    ParticipationManager,
    SharedParticipationPolicy,
} from "../dist/participation/participationManager.js";

test("default policy keeps participation exclusive", () => {
    const manager = new ParticipationManager();

    assert.deepEqual(manager.join("player-1", "game-a"), { allowed: true });
    assert.equal(manager.join("player-1", "game-b").allowed, false);
    assert.deepEqual(manager.getGames("player-1"), ["game-a"]);
    assert.equal(manager.playerCount, 1);
    assert.equal(manager.membershipCount, 1);
});

test("joining the same game is idempotent", () => {
    const manager = new ParticipationManager();

    assert.equal(manager.join("player-1", "game-a").allowed, true);
    assert.equal(manager.join("player-1", "game-a").allowed, true);
    assert.deepEqual(manager.getGames("player-1"), ["game-a"]);
    assert.equal(manager.membershipCount, 1);
});

test("shared policy allows multiple concurrent games", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());

    assert.equal(manager.join("player-1", "game-a").allowed, true);
    assert.equal(manager.join("player-1", "game-b").allowed, true);
    assert.deepEqual(manager.getGames("player-1"), ["game-a", "game-b"]);
    assert.deepEqual(manager.getPlayers("game-b"), ["player-1"]);
    assert.equal(manager.membershipCount, 2);
});

test("leave and releaseGame remove only the requested memberships", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    manager.join("player-1", "game-a");
    manager.join("player-1", "game-b");
    manager.join("player-2", "game-b");

    assert.equal(manager.leave("player-1", "game-a"), true);
    assert.deepEqual(manager.getGames("player-1"), ["game-b"]);
    assert.deepEqual(manager.releaseGame("game-b").sort(), ["player-1", "player-2"]);
    assert.equal(manager.playerCount, 0);
    assert.equal(manager.membershipCount, 0);
});

test("leaveAll returns the released game keys", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    manager.join("player-1", "game-a");
    manager.join("player-1", "game-b");

    assert.deepEqual(manager.leaveAll("player-1"), ["game-a", "game-b"]);
    assert.equal(manager.has("player-1"), false);
});
