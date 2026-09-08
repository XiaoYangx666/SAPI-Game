import {
    ExclusiveParticipationPolicy,
    ParticipationDecision,
    ParticipationPolicy,
} from "./policy";

/**
 * 维护玩家与游戏实例之间的参与关系。
 *
 * 这里只记录 membership，不持有 Minecraft Player，也不管理 GamePlayer 生命周期。
 * 是否允许新增 membership 由 ParticipationPolicy 决定。
 */
export class ParticipationManager {
    private readonly memberships = new Map<string, Set<string>>();

    constructor(private policy: ParticipationPolicy = new ExclusiveParticipationPolicy()) {}

    setPolicy(policy: ParticipationPolicy) {
        this.policy = policy;
    }

    getPolicy(): ParticipationPolicy {
        return this.policy;
    }

    /**尝试让玩家加入一个游戏。重复加入同一个 gameKey 是幂等操作。*/
    join(playerId: string, gameKey: string): ParticipationDecision {
        const current = this.memberships.get(playerId);
        if (current?.has(gameKey)) return { allowed: true };

        const currentGameKeys = current ? [...current] : [];
        const decision = this.policy.canJoin({
            playerId,
            targetGameKey: gameKey,
            currentGameKeys,
        });
        if (!decision.allowed) return decision;

        const memberships = current ?? new Set<string>();
        memberships.add(gameKey);
        this.memberships.set(playerId, memberships);
        return decision;
    }

    leave(playerId: string, gameKey: string): boolean {
        const memberships = this.memberships.get(playerId);
        if (!memberships?.delete(gameKey)) return false;
        if (memberships.size === 0) this.memberships.delete(playerId);
        return true;
    }

    leaveAll(playerId: string): readonly string[] {
        const memberships = this.memberships.get(playerId);
        if (!memberships) return [];
        const gameKeys = [...memberships];
        this.memberships.delete(playerId);
        return gameKeys;
    }

    releaseGame(gameKey: string): readonly string[] {
        const releasedPlayers: string[] = [];
        for (const [playerId, memberships] of this.memberships) {
            if (!memberships.delete(gameKey)) continue;
            releasedPlayers.push(playerId);
            if (memberships.size === 0) this.memberships.delete(playerId);
        }
        return releasedPlayers;
    }

    has(playerId: string, gameKey?: string): boolean {
        const memberships = this.memberships.get(playerId);
        return gameKey === undefined
            ? (memberships?.size ?? 0) > 0
            : memberships?.has(gameKey) === true;
    }

    getGames(playerId: string): readonly string[] {
        return [...(this.memberships.get(playerId) ?? [])];
    }

    getPlayers(gameKey: string): readonly string[] {
        const players: string[] = [];
        for (const [playerId, memberships] of this.memberships) {
            if (memberships.has(gameKey)) players.push(playerId);
        }
        return players;
    }

    get playerCount(): number {
        return this.memberships.size;
    }

    get membershipCount(): number {
        let count = 0;
        for (const memberships of this.memberships.values()) {
            count += memberships.size;
        }
        return count;
    }
}

export * from "./policy";
