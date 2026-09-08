import type { ParticipationDecision } from "./policy";
import { ParticipationManager } from "./participationManager";

export type ParticipationBatchDecision =
    | { allowed: true }
    | { allowed: false; playerId: string; reason?: string };

/**
 * 某一个游戏实例自己的 participation 视图。
 *
 * 游戏代码只需要关心“哪些 playerId 属于我”，无需反复传 gameKey，
 * 也无需持有 Minecraft Player。在线 GamePlayer 可以在之后按需创建。
 */
export class GameParticipation {
    constructor(
        private readonly manager: ParticipationManager,
        public readonly gameKey: string,
        private readonly tracked: boolean = true
    ) {}

    join(playerId: string): ParticipationDecision {
        if (!this.tracked) return { allowed: true };
        return this.manager.join(playerId, this.gameKey);
    }

    /**原子加入多个玩家：任意一个被拒绝时，不写入任何新 membership。*/
    joinAll(playerIds: readonly string[]): ParticipationBatchDecision {
        if (!this.tracked) return { allowed: true };
        return this.manager.joinAll(playerIds, this.gameKey);
    }

    leave(playerId: string): boolean {
        if (!this.tracked) return false;
        return this.manager.leave(playerId, this.gameKey);
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

    clear(): readonly string[] {
        if (!this.tracked) return [];
        return this.manager.releaseGame(this.gameKey);
    }
}
