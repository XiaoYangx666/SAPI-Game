import {
    ExclusiveParticipationPolicy,
    ParticipationDecision,
    ParticipationPolicy,
} from "./policy";
import type { ParticipationBatchDecision } from "./gameParticipation";

/**
 * 维护玩家与游戏实例之间的参与关系。
 *
 * 这里只记录 membership，不持有 Minecraft Player，也不管理 GamePlayer 生命周期。
 * 是否允许新增 membership 由 ParticipationPolicy 决定。
 */
export class ParticipationManager {
    private readonly memberships = new Map<string, Set<string>>();

    constructor(
        private policy: ParticipationPolicy = new ExclusiveParticipationPolicy()
    ) {}

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

        const decision = this.evaluateJoin(playerId, gameKey);
        if (!decision.allowed) return decision;

        this.addMembership(playerId, gameKey);
        return decision;
    }

    /**
     * 原子加入一组玩家。
     *
     * 先对所有尚未加入目标游戏的 playerId 进行 policy 检查；只要任意一个
     * 被拒绝，就不会写入任何新的 membership。
     */
    joinAll(
        playerIds: readonly string[],
        gameKey: string
    ): ParticipationBatchDecision {
        const uniquePlayerIds = [...new Set(playerIds)];

        for (const playerId of uniquePlayerIds) {
            if (this.has(playerId, gameKey)) continue;
            const decision = this.evaluateJoin(playerId, gameKey);
            if (!decision.allowed) {
                return {
                    allowed: false,
                    playerId,
                    ...(decision.reason ? { reason: decision.reason } : {}),
                };
            }
        }

        for (const playerId of uniquePlayerIds) {
            this.addMembership(playerId, gameKey);
        }
        return { allowed: true };
    }

    private evaluateJoin(
        playerId: string,
        gameKey: string
    ): ParticipationDecision {
        const current = this.memberships.get(playerId);
        return this.policy.canJoin({
            playerId,
            targetGameKey: gameKey,
            currentGameKeys: current ? [...current] : [],
        });
    }

    private addMembership(playerId: string, gameKey: string) {
        const memberships = this.memberships.get(playerId) ?? new Set<string>();
        memberships.add(gameKey);
        this.memberships.set(playerId, memberships);
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
export * from "./gameParticipation";
