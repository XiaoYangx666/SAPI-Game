import {
    ExclusiveParticipationPolicy,
    ParticipationDecision,
    ParticipationPolicy,
} from "./policy";
import type { ParticipationBatchDecision } from "./gameParticipation";
import type { CustomEventSignal } from "../gameEvent/eventSignal";
import type { Subscription } from "../gameEvent/subscription";

export interface ParticipationChange {
    readonly gameKey: string;
    readonly playerId: string;
    readonly type: "joined" | "left";
    readonly reason?: string;
}

/**
 * 维护玩家与游戏实例之间的参与关系。
 *
 * 同时维护 player -> games 与 game -> players 两个索引：
 * - 前者服务加入策略与 leaveAll；
 * - 后者服务房间成员查询、AutoStop 与整局释放。
 *
 * 两个索引只通过 add/removeMembership 修改，避免出现双向状态漂移。
 */
export class ParticipationManager {
    private readonly memberships = new Map<string, Set<string>>();
    private readonly gameMembers = new Map<string, Set<string>>();

    // Subscribers belong to the game instance, not to its current member count.
    // An empty-but-running game must keep receiving future join/leave events.
    private readonly changeSubscribers = new Map<
        string,
        Set<(event: ParticipationChange) => void>
    >();

    constructor(
        private policy: ParticipationPolicy = new ExclusiveParticipationPolicy()
    ) {}

    changesFor(gameKey: string): CustomEventSignal<ParticipationChange> {
        return {
            subscribe: (
                callback: (event: ParticipationChange) => void
            ): Subscription => {
                const callbacks =
                    this.changeSubscribers.get(gameKey) ?? new Set();
                callbacks.add(callback);
                this.changeSubscribers.set(gameKey, callbacks);

                let active = true;
                return {
                    unsubscribe: () => {
                        if (!active) return;
                        active = false;
                        callbacks.delete(callback);
                        if (callbacks.size === 0) {
                            this.changeSubscribers.delete(gameKey);
                        }
                    },
                };
            },
        };
    }

    private emitChange(event: ParticipationChange): void {
        for (const callback of [
            ...(this.changeSubscribers.get(event.gameKey) ?? []),
        ]) {
            try {
                callback(event);
            } catch (error) {
                console.error(
                    "Participation change callback error:",
                    error
                );
            }
        }
    }

    setPolicy(policy: ParticipationPolicy) {
        this.policy = policy;
    }

    getPolicy(): ParticipationPolicy {
        return this.policy;
    }

    /**尝试让玩家加入一个游戏。重复加入同一个 gameKey 是幂等操作。*/
    join(playerId: string, gameKey: string): ParticipationDecision {
        if (this.has(playerId, gameKey)) return { allowed: true };

        const decision = this.evaluateJoin(playerId, gameKey);
        if (!decision.allowed) return decision;

        this.addMembership(playerId, gameKey);
        this.emitChange({ gameKey, playerId, type: "joined" });
        return decision;
    }

    /**
     * 原子加入一组玩家。
     *
     * 先整体校验；只要任意一个被拒绝，不写入任何新 membership。
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
                    ...(decision.reason
                        ? { reason: decision.reason }
                        : {}),
                };
            }
        }

        const newPlayerIds = uniquePlayerIds.filter(
            (id) => !this.has(id, gameKey)
        );

        for (const playerId of newPlayerIds) {
            this.addMembership(playerId, gameKey);
        }
        // 整批 commit 完成后才通知观察者，避免看到半完成状态。
        for (const playerId of newPlayerIds) {
            this.emitChange({ gameKey, playerId, type: "joined" });
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
        const games = this.memberships.get(playerId) ?? new Set<string>();
        games.add(gameKey);
        this.memberships.set(playerId, games);

        const players = this.gameMembers.get(gameKey) ?? new Set<string>();
        players.add(playerId);
        this.gameMembers.set(gameKey, players);
    }

    private removeMembership(playerId: string, gameKey: string): boolean {
        const games = this.memberships.get(playerId);
        if (!games?.delete(gameKey)) return false;

        if (games.size === 0) {
            this.memberships.delete(playerId);
        }

        const players = this.gameMembers.get(gameKey);
        players?.delete(playerId);
        if (players?.size === 0) {
            this.gameMembers.delete(gameKey);
        }

        return true;
    }

    leave(playerId: string, gameKey: string, reason = "leave"): boolean {
        if (!this.removeMembership(playerId, gameKey)) return false;

        this.emitChange({ gameKey, playerId, type: "left", reason });
        return true;
    }

    leaveAll(playerId: string): readonly string[] {
        const games = this.memberships.get(playerId);
        if (!games) return [];

        // 先取快照再统一修改；membership 集合会在 removeMembership 中变化。
        const gameKeys = [...games];
        for (const gameKey of gameKeys) {
            this.removeMembership(playerId, gameKey);
        }

        // 所有索引修改完毕后再通知，观察者看到的是完整最终状态。
        for (const gameKey of gameKeys) {
            this.emitChange({
                gameKey,
                playerId,
                type: "left",
                reason: "leave-all",
            });
        }
        return gameKeys;
    }

    /**
     * Release every membership of a game. Ordinary clear() broadcasts actual
     * removals; only the owning Game's teardown may request silent cleanup.
     */
    releaseGame(
        gameKey: string,
        options: { readonly silent?: boolean; readonly reason?: string } = {}
    ): readonly string[] {
        const players = this.gameMembers.get(gameKey);
        if (!players) return [];

        const releasedPlayers = [...players];
        for (const playerId of releasedPlayers) {
            this.removeMembership(playerId, gameKey);
        }

        // Commit the full batch before observers can react to a partial clear.
        if (!options.silent) {
            for (const playerId of releasedPlayers) {
                this.emitChange({
                    gameKey,
                    playerId,
                    type: "left",
                    reason: options.reason ?? "game-clear",
                });
            }
        }
        return releasedPlayers;
    }

    has(playerId: string, gameKey?: string): boolean {
        const games = this.memberships.get(playerId);
        return gameKey === undefined
            ? (games?.size ?? 0) > 0
            : games?.has(gameKey) === true;
    }

    getGames(playerId: string): readonly string[] {
        return [...(this.memberships.get(playerId) ?? [])];
    }

    /** 获取目标游戏全部 membership，按加入该游戏的顺序返回。 */
    getPlayers(gameKey: string): readonly string[] {
        return [...(this.gameMembers.get(gameKey) ?? [])];
    }

    hasPlayers(gameKey: string): boolean {
        return (this.gameMembers.get(gameKey)?.size ?? 0) > 0;
    }

    getPlayerCount(gameKey: string): number {
        return this.gameMembers.get(gameKey)?.size ?? 0;
    }

    get playerCount(): number {
        return this.memberships.size;
    }

    get membershipCount(): number {
        let count = 0;
        for (const games of this.memberships.values()) {
            count += games.size;
        }
        return count;
    }
}

export * from "./policy";
export * from "./gameParticipation";
