import { expect, test } from "vitest";
import {
    GameParticipation,
    ParticipationManager,
    SharedParticipationPolicy,
} from "../packages/core/dist/participation/participationManager.js";

test("default policy keeps participation exclusive", () => {
    const manager = new ParticipationManager();
    expect(manager.join("player-1", "game-a")).toEqual({ allowed: true });
    expect(manager.join("player-1", "game-b").allowed).toBe(false);
    expect(manager.getGames("player-1")).toEqual(["game-a"]);
    expect(manager.playerCount).toBe(1);
    expect(manager.membershipCount).toBe(1);
});

test("joining the same game is idempotent", () => {
    const manager = new ParticipationManager();
    expect(manager.join("player-1", "game-a").allowed).toBe(true);
    expect(manager.join("player-1", "game-a").allowed).toBe(true);
    expect(manager.getGames("player-1")).toEqual(["game-a"]);
    expect(manager.membershipCount).toBe(1);
});

test("shared policy allows multiple concurrent games", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    expect(manager.join("player-1", "game-a").allowed).toBe(true);
    expect(manager.join("player-1", "game-b").allowed).toBe(true);
    expect(manager.getGames("player-1")).toEqual(["game-a", "game-b"]);
    expect(manager.getPlayers("game-b")).toEqual(["player-1"]);
    expect(manager.membershipCount).toBe(2);
});

test("joinAll is atomic when one player is rejected", () => {
    const manager = new ParticipationManager();
    manager.join("player-2", "other-game");
    const result = manager.joinAll(["player-1", "player-2", "player-3"], "table-game");
    expect(result.allowed).toBe(false);
    expect(result.playerId).toBe("player-2");
    expect(manager.getPlayers("table-game")).toEqual([]);
    expect(manager.getGames("player-1")).toEqual([]);
    expect(manager.getGames("player-3")).toEqual([]);
});

test("game-scoped participation works with stable player ids only", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    const table = new GameParticipation(manager, "doudizhu:table-1");
    expect(table.joinAll(["alice", "bob", "carol"])).toEqual({ allowed: true });
    expect(table.has("alice")).toBe(true);
    expect(table.size).toBe(3);
    expect(table.getAll()).toEqual(["alice", "bob", "carol"]);
    table.leave("bob");
    expect(table.getAll()).toEqual(["alice", "carol"]);
    table.clear();
    expect(table.size).toBe(0);
});

test("leave and releaseGame remove only the requested memberships", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    manager.join("player-1", "game-a");
    manager.join("player-1", "game-b");
    manager.join("player-2", "game-b");
    expect(manager.leave("player-1", "game-a")).toBe(true);
    expect(manager.getGames("player-1")).toEqual(["game-b"]);
    expect(manager.releaseGame("game-b").sort()).toEqual(["player-1", "player-2"]);
    expect(manager.playerCount).toBe(0);
    expect(manager.membershipCount).toBe(0);
});

test("leaveAll returns the released game keys", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    manager.join("player-1", "game-a");
    manager.join("player-1", "game-b");
    expect(manager.leaveAll("player-1")).toEqual(["game-a", "game-b"]);
    expect(manager.has("player-1")).toBe(false);
});

test("game-scoped change subscriptions emit genuine transitions and outlive empty membership", () => {
    const manager = new ParticipationManager(new SharedParticipationPolicy());
    const a = new GameParticipation(manager, "game-a");
    const b = new GameParticipation(manager, "game-b");
    const aEvents = [], bEvents = [];
    const subA = a.changed.subscribe(event => aEvents.push(event));
    const subB = b.changed.subscribe(event => bEvents.push(event));

    a.join("alice");
    a.join("alice"); // Idempotent; not another membership transition.
    a.joinAll(["alice", "bob"]);
    manager.join("alice", "game-b");
    manager.leaveAll("alice");
    expect(aEvents.map(event => [event.type, event.playerId])).toEqual([
        ["joined", "alice"], ["joined", "bob"], ["left", "alice"],
    ]);
    expect(bEvents.map(event => [event.type, event.playerId])).toEqual([
        ["joined", "alice"], ["left", "alice"],
    ]);
    expect(aEvents.at(-1).reason).toBe("leave-all");

    // Empty membership must not unregister observers of a still-running game.
    a.leave("bob");
    a.join("carol");
    expect(aEvents.at(-1).playerId).toBe("carol");

    const before = aEvents.length;
    a.clear(); // Runtime clear is an observable removal, unlike game teardown.
    expect(aEvents).toHaveLength(before + 1);
    expect(aEvents.at(-1)).toMatchObject({
        type: "left", playerId: "carol", reason: "game-clear",
    });
    subA.unsubscribe();
    subB.unsubscribe();
    a.join("dave");
    expect(aEvents).toHaveLength(before + 1);
});

test("teardown-only clear releases ownership without reentering subscribers", () => {
    const manager = new ParticipationManager();
    const game = new GameParticipation(manager, "teardown-game");
    const events = [];
    const sub = game.changed.subscribe(event => events.push(event));
    game.joinAll(["alice", "bob"]);
    const countBeforeDispose = events.length;
    expect(game._clearForDispose()).toEqual(["alice", "bob"]);
    expect(game.size).toBe(0);
    expect(events).toHaveLength(countBeforeDispose);
    sub.unsubscribe();
});
