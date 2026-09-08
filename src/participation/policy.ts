export type ParticipationDecision =
    | { allowed: true }
    | { allowed: false; reason?: string };

export interface ParticipationContext {
    playerId: string;
    targetGameKey: string;
    currentGameKeys: readonly string[];
}

/**
 * 决定一个玩家是否可以加入目标游戏。
 *
 * ParticipationPolicy 只负责“是否允许共存”，不负责创建/销毁 GamePlayer。
 * 这样游戏内玩家生命周期仍由 GamePlayerManager 管理。
 */
export interface ParticipationPolicy {
    canJoin(context: ParticipationContext): ParticipationDecision;
}

/** 默认小游戏服务器策略：一个玩家同时只能参加一个普通游戏实例。 */
export class ExclusiveParticipationPolicy implements ParticipationPolicy {
    canJoin(context: ParticipationContext): ParticipationDecision {
        if (context.currentGameKeys.length === 0) return { allowed: true };
        if (context.currentGameKeys.includes(context.targetGameKey)) {
            return { allowed: true };
        }
        return {
            allowed: false,
            reason: `player is already participating in ${context.currentGameKeys.join(", ")}`,
        };
    }
}

/**
 * 嵌入式/Addon 场景的最宽松策略：允许玩家同时参加多个游戏实例。
 * 具体游戏仍可以在自己的 GamePlayerManager 层拒绝重复加入。
 */
export class SharedParticipationPolicy implements ParticipationPolicy {
    canJoin(): ParticipationDecision {
        return { allowed: true };
    }
}
