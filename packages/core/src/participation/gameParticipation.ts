import type { ParticipationDecision } from "./policy";
import { ParticipationManager, type ParticipationChange } from "./participationManager";
import type { CustomEventSignal } from "../gameEvent/eventSignal";

export type ParticipationBatchDecision =
    | { allowed: true }
    | { allowed: false; playerId: string; reason?: string };

/**
 * 某一个游戏实例自己的 participation 视图。
 *
 * 游戏代码只需要关心“哪些 playerId 属于我”，无需反复传 gameKey，
 * 也无需持有 Minecraft Player。在线 GamePlayer 可以在之后按需创建。
 *
 * tracked=false 用于 daemon/观察型游戏：join()/joinAll() 为兼容旧调用会返回 allowed，
 * 但不会创建 membership；has()/getAll()/size 始终反映为空。daemon 若只需要包装在线玩家，
 * 应使用 GamePlayerManager.view()，而不是依赖 join() 的无 ownership 语义。
 */
export class GameParticipation {
    /** Game-local change signal. Subscriptions are detached by State/EventManager cleanup. */
    readonly changed: CustomEventSignal<ParticipationChange>;

    constructor(
        private readonly manager: ParticipationManager,
        public readonly gameKey: string,
        private readonly tracked: boolean = true
    ) {
        this.changed = manager.changesFor(gameKey);
    }

    join(playerId: string): ParticipationDecision {
        if (!this.tracked) return { allowed: true };
        return this.manager.join(playerId, this.gameKey);
    }

    /**原子加入多个玩家：任意一个被拒绝时，不写入任何新 membership。*/
    joinAll(playerIds: readonly string[]): ParticipationBatchDecision {
        if (!this.tracked) return { allowed: true };
        return this.manager.joinAll(playerIds, this.gameKey);
    }

    leave(playerId: string, reason = "leave"): boolean {
        if (!this.tracked) return false;
        return this.manager.leave(playerId, this.gameKey, reason);
    }

    has(playerId: string): boolean {
        return this.tracked
            ? this.manager.has(playerId, this.gameKey)
            : false;
    }

    getAll(): readonly string[] {
        return this.tracked ? this.manager.getPlayers(this.gameKey) : [];
    }

    get size(): number {
        return this.getAll().length;
    }

    /** 是否至少存在一个 membership；用于空房策略等短路查询。 */
    get hasAny(): boolean {
        return this.tracked
            ? this.manager.hasPlayers(this.gameKey)
            : false;
    }

    /** Ordinary runtime clear broadcasts membership removals to room policies. */
    clear(reason = "game-clear"): readonly string[] {
        if (!this.tracked) return [];
        return this.manager.releaseGame(this.gameKey, { reason });
    }

    /** @internal Game teardown: release ownership without re-entering subscribers. */
    _clearForDispose(): readonly string[] {
        if (!this.tracked) return [];
        return this.manager.releaseGame(this.gameKey, { silent: true });
    }
}
