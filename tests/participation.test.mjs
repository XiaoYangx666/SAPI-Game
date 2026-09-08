import test from "node:test";
import assert from "node:assert/strict";
import {
    GameParticipation,
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

test("joinAll is atomic when one player is rejected", () => {
    const manager = new ParticipationManager();
    manager.join("player-2", "other-game");

    const result = manager.joinAll(
        ["player-1", "player-2", "player-3"],
        "table-game"
    );

    assert.equal(result.allowed, false);
    assert.equal(result.playerId, "player-2");
    assert.deepEqual(manager.getPlayers("table-game"), []);
    assert.deepEqual(manager.getGames("player-1"), []);
    assert.deepEqual(manager.getGames("player-3"), []);
});

test("game-scoped participation works with stable player ids only", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    const table = new GameParticipation(manager, "doudizhu:table-1");

    assert.deepEqual(table.joinAll(["alice", "bob", "carol"]), {
        allowed: true,
    });
    assert.equal(table.has("alice"), true);
    assert.equal(table.size, 3);
    assert.deepEqual(table.getAll(), ["alice", "bob", "carol"]);

    table.leave("bob");
    assert.deepEqual(table.getAll(), ["alice", "carol"]);
    table.clear();
    assert.equal(table.size, 0);
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
