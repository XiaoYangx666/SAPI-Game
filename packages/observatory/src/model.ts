import type {
    ContextNode,
    PlayerEntry,
    SeatEntry,
    SelectedSession,
    TraceEvent,
} from "./types";

export interface Run {
    owner: string;
    indexes: number[];
}

export interface ViewModel {
    players: Map<string, PlayerEntry>;
    seats: Map<number, SeatEntry>;
    nodes: Map<string, ContextNode>;
    nodeIndex: Map<string, number>;
    owners: string[];
    startTick: number;
}

export function buildViewModel(selected: SelectedSession): ViewModel {
    return {
        players: new Map(selected.context.players.map((entry) => [entry.id, entry])),
        seats: new Map(selected.context.seats.map((entry) => [entry.seat, entry])),
        nodes: new Map(selected.context.nodes.map((entry) => [entry.key, entry])),
        nodeIndex: new Map(
            selected.context.nodes.map((entry, index) => [entry.key, index])
        ),
        owners: selected.context.eventOwners,
        startTick: selected.header.startTick,
    };
}

/** Consecutive events that share the same owning state form one story section. */
export function buildRuns(events: readonly TraceEvent[], owners: readonly string[]): Run[] {
    const runs: Run[] = [];
    for (let index = 0; index < events.length; index++) {
        const owner = owners[index] ?? "session";
        const last = runs.at(-1);
        if (!last || last.owner !== owner) {
            runs.push({ owner, indexes: [index] });
        } else {
            last.indexes.push(index);
        }
    }
    return runs;
}

export function seatColor(seat: number): string {
    return `hsl(${(seat * 67 + 205) % 360} 65% 62%)`;
}

export function nodeColor(key: string, view: ViewModel): string {
    if (key === "session") return "#546b80";
    const index = view.nodeIndex.get(key) ?? 0;
    return `hsl(${(index * 47 + 195) % 360} 55% 60%)`;
}

export function playerText(id: string, view: ViewModel): string {
    const player = view.players.get(id);
    if (!player) return id;
    const parts: string[] = [player.name ?? id];
    if (player.seats.length > 0) parts.push(`座位${player.seats.join("/")}`);
    return parts.join(" · ");
}

export function playerColor(id: string, view: ViewModel): string {
    const player = view.players.get(id);
    return player && player.seats.length > 0
        ? seatColor(player.seats[0])
        : "#4aa8ff";
}

export function nodeName(key: string, view: ViewModel): string {
    return view.nodes.get(key)?.name ?? "会话";
}
