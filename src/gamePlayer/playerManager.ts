import { Player } from "@minecraft/server";
import { GameParticipation } from "../participation/gameParticipation";
import type {
    ParticipationBatchDecision,
} from "../participation/gameParticipation";
import type { ParticipationDecision } from "../participation/policy";
import { GamePlayer, GamePlayerConstructor } from "./gamePlayer";
import { PlayerGroupBuilder } from "./groupBuilder";

export type GamePlayerJoinDecision<T extends GamePlayer> =
    | { allowed: true; player: T }
    | { allowed: false; reason?: string };

export type GamePlayerBatchJoinDecision<T extends GamePlayer> =
    | { allowed: true; players: T[] }
    | { allowed: false; playerId: string; reason?: string };

/**游戏实例内的 GamePlayer wrapper 管理器。*/
export class GamePlayerManager<T extends GamePlayer = GamePlayer> {
    private readonly players: Map<string, T> = new Map();
    public readonly playerConstructor: GamePlayerConstructor<T>;

    /**玩家组构建器 */
    public readonly groupBuilder: PlayerGroupBuilder<T>;

    constructor(
        playerConstructor: GamePlayerConstructor<T>,
        private readonly participation: GameParticipation
    ) {
        this.playerConstructor = playerConstructor;
        this.groupBuilder = new PlayerGroupBuilder(this);
    }

    /**
     * 获取/创建已经属于当前游戏的 GamePlayer wrapper。
     *
     * 该方法不会创建 membership。若玩家尚未加入当前游戏，返回 undefined。
     * 对于先凭稳定 playerId 恢复的游戏，玩家上线后调用 get(Player) 即可按需创建 wrapper。
     */
    get(p: Player): T | undefined {
        if (!this.participation.has(p.id)) return undefined;
        return this.ensurePlayer(p);
    }

    /**
     * 获取一个非 owning 的 GamePlayer wrapper，不创建 participation membership。
     *
     * 主要用于 daemon/观察型游戏读取在线玩家。普通游戏若需要正式加入，请使用 join()/joinAll()。
     */
    view(p: Player): T {
        return this.ensurePlayer(p);
    }

    /**
     * 显式让在线玩家加入当前游戏，并返回其 GamePlayer wrapper。
     * 与 get() 不同，此方法会申请 participation membership。
     */
    join(p: Player): GamePlayerJoinDecision<T> {
        const decision: ParticipationDecision = this.participation.join(p.id);
        if (!decision.allowed) {
            return {
                allowed: false,
                ...(decision.reason ? { reason: decision.reason } : {}),
            };
        }

        return { allowed: true, player: this.ensurePlayer(p) };
    }

    /**
     * 原子加入一组在线玩家。
     *
     * participation 会先整体校验；任意玩家被拒绝时不会写入任何新 membership，
     * 也不会创建新的 GamePlayer wrapper。
     */
    joinAll(players: readonly Player[]): GamePlayerBatchJoinDecision<T> {
        const playerIds = players.map((player) => player.id);
        const previousMemberships = new Set(
            playerIds.filter((playerId) => this.participation.has(playerId))
        );
        const decision: ParticipationBatchDecision =
            this.participation.joinAll(playerIds);

        if (!decision.allowed) {
            return {
                allowed: false,
                playerId: decision.playerId,
                ...(decision.reason ? { reason: decision.reason } : {}),
            };
        }

        const createdPlayerIds = new Set<string>();
        try {
            const wrappers = players.map((player) => {
                if (!this.players.has(player.id)) {
                    createdPlayerIds.add(player.id);
                }
                return this.ensurePlayer(player);
            });
            return { allowed: true, players: wrappers };
        } catch (error) {
            // wrapper 构造异常时，仅回滚本次新建的 wrapper 和 membership，
            // 不破坏调用前已经属于当前游戏的参与关系。
            for (const playerId of createdPlayerIds) {
                const player = this.players.get(playerId);
                player?._setActive(false);
                this.players.delete(playerId);
            }
            for (const playerId of new Set(playerIds)) {
                if (!previousMemberships.has(playerId)) {
                    this.participation.leave(playerId);
                }
            }
            throw error;
        }
    }

    getById(playerId: string): T | undefined {
        return this.players.get(playerId);
    }

    getAll(): T[] {
        return Array.from(this.players.values());
    }

    /**当前游戏全部 participation playerId，包括暂时没有在线 wrapper 的玩家。*/
    getParticipantIds(): readonly string[] {
        return this.participation.getAll();
    }

    hasParticipant(playerId: string): boolean {
        return this.participation.has(playerId);
    }

    /**让玩家退出当前游戏，并释放 participation。*/
    leave(playerId: string): boolean {
        const gamePlayer = this.players.get(playerId);
        if (gamePlayer) gamePlayer._setActive(false);
        const released = this.participation.leave(playerId);
        return gamePlayer !== undefined || released;
    }

    deactivate(p: Player) {
        this.leave(p.id);
    }

    get size() {
        return this.players.size;
    }

    get activeSize() {
        return Array.from(this.players.values()).filter((p) => p.isActive)
            .length;
    }

    get validSize() {
        return Array.from(this.players.values()).filter((p) => p.isValid)
            .length;
    }

    dispose() {
        for (const player of this.players.values()) {
            player._setActive(false);
        }
        this.participation.clear();
    }

    private ensurePlayer(p: Player): T {
        let gamePlayer = this.players.get(p.id);
        if (!gamePlayer) {
            gamePlayer = new this.playerConstructor(p);
            this.players.set(p.id, gamePlayer);
        }
        gamePlayer._setActive(true);
        return gamePlayer;
    }
}
