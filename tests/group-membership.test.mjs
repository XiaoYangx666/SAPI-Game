import { expect, test } from "vitest";
import {
    GamePlayer,
    PlayerGroup,
    PlayerGroupSet,
    playerSourceHasBoth,
} from "../packages/core/dist/main.js";

const mock = (id) => ({ id, name: id, isValid: true });

test("group membership events distinguish explicit removal from invalid purge", () => {
    const alice = mock("alice");
    const bob = mock("bob");
    const group = new PlayerGroup(GamePlayer);
    const events = [];
    const sub = group.changed.subscribe(event => events.push([
        event.type, event.player.id, event.reason,
    ]));
    group.add(new GamePlayer(alice));
    group.add(new GamePlayer(bob));
    group.delete(alice, "region-leave");
    bob.isValid = false;
    group.clearInvalid();
    expect(events).toEqual([
        ["added", "alice", "manual"],
        ["added", "bob", "manual"],
        ["removed", "alice", "region-leave"],
        ["removed", "bob", "invalid-purge"],
    ]);
    expect(group.size).toBe(0);
    sub.unsubscribe();
});

test("adding the same group twice does not duplicate scope or subscriptions", () => {
    const group = new PlayerGroup(GamePlayer);
    const groupSet = new PlayerGroupSet([group]);
    const changes = [];
    const subscription = groupSet.changed.subscribe(event =>
        changes.push([event.type, event.reason, event.playerId])
    );

    groupSet.addGroup(group);
    expect(groupSet.getGroups()).toEqual([group]);
    expect(changes).toHaveLength(0);
    group.add(new GamePlayer(mock("alice")));
    expect(changes).toEqual([["added", "manual", "alice"]]);

    groupSet.removeGroup(group);
    group.add(new GamePlayer(mock("bob")));
    expect(changes).toEqual([
        ["added", "manual", "alice"],
        ["scope", "group-removed", undefined],
    ]);
    subscription.unsubscribe();
});

test("group-set observes nested membership and detaches after removing group", () => {
    const group = new PlayerGroup(GamePlayer);
    const set = new PlayerGroupSet([group]);
    const events = [];
    const subscription = set.changed.subscribe(event =>
        events.push([event.type, event.playerId ?? null, event.reason])
    );
    group.add(new GamePlayer(mock("alice")));
    set.clear(); // Clears the *set of groups*, not the members within group.
    expect(group.size).toBe(1);
    group.delete(mock("alice"));
    expect(events).toEqual([
        ["added", "alice", "manual"],
        ["scope", null, "groups-cleared"],
    ]);
    subscription.unsubscribe();
});

test("PlayerGroup 使用 ID 索引且 clone 保留 data", () => {
    const data = { color: "red" };
    const alice = new GamePlayer(mock("alice"));
    const bob = new GamePlayer(mock("bob"));
    const group = new PlayerGroup(GamePlayer, [alice, bob], data);

    expect(group.getById("alice")).toBe(alice);
    expect(group.hasId("bob")).toBe(true);

    const cloned = group.clone();
    expect(cloned.data).toBe(data);
    expect(cloned.getAll()).toEqual([alice, bob]);

    group.delete(mock("alice"));
    expect(group.getById("alice")).toBeUndefined();
    expect(group.hasId("bob")).toBe(true);
});

test("PlayerGroupSet 对重复成员只执行一次并保留 clone data", () => {
    const alice = new GamePlayer(mock("alice"));
    const dataA = { color: "red" };
    const dataB = { color: "blue" };
    const a = new PlayerGroup(GamePlayer, [alice], dataA);
    const b = new PlayerGroup(GamePlayer, [alice], dataB);
    const set = new PlayerGroupSet([a, b]);

    const visited = [];
    set.forEach((player) => visited.push(player.id));
    expect(visited).toEqual(["alice"]);
    expect(set.size).toBe(1);
    expect(set.validSize).toBe(1);
    expect(set.areInSameGroup("alice", "alice")).toBe(true);

    const cloned = set.clone();
    const groups = cloned.getGroups();
    expect(groups[0].data).toBe(dataA);
    expect(groups[1].data).toBe(dataB);
});

test("playerSourceHasBoth 对动态 generator 来源只求值一次", () => {
    const alice = new GamePlayer(mock("alice"));
    const bob = new GamePlayer(mock("bob"));
    let resolves = 0;

    const source = () => {
        resolves++;
        return (function* () {
            yield alice;
            yield bob;
        })();
    };

    expect(playerSourceHasBoth(source, "bob", "alice")).toBe(true);
    expect(resolves).toBe(1);
});

