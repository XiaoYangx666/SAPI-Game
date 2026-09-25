import { Player } from "@minecraft/server";
import { Game } from "../../main";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import type { PlayerGroupSet } from "../../gamePlayer/groupSet";
import { GameState } from "../../gameState/gameState";
import { BuiltinTraceEventType } from "../../trace/contract";
import { Duration } from "../../utils/duration";
import { GameComponent } from "../gameComponent";

export interface DisconnectTimeoutOptions<P extends GamePlayer = GamePlayer> {
    /**掉线宽限时间，默认 30 秒。*/
    timeout?: Duration;
    /**
     * 超时后是否自动释放 participation。
     *
     * 建议调用方显式设置，未设置时默认 false，避免超时回调隐式改变参与关系。
     */
    releaseOnTimeout?: boolean;
    /** @deprecated 使用 releaseOnTimeout。仅为旧代码兼容保留。 */
    shouldRelease?: boolean;
    /**
     * 可选：仅监控该 PlayerGroupSet 中的 participant。
     * 与 participantFilter 同时提供时，两者都必须匹配。
     */
    groupSet?: PlayerGroupSet<P>;
    /**
     * 可选：进一步筛选要监控的 participant。
     * 回调会在掉线、上线和超时处理时重新求值。
     */
    participantFilter?: (playerId: string, player: P | undefined) => boolean;
    /**
     * @deprecated 请改用独立 AutoStopComponent 监听真实 membership 变化。
     * 仅为旧代码兼容保留：此选项现在也会在主动 leave 后检查空房。
     * release 后若当前监控 scope 已没有 participant，是否自动 stopGame，默认 false。
     */
    stopGameWhenEmpty?: boolean;
    /**玩家掉线并开始计时时触发。*/
    onOffline?: (playerId: string, player: P | undefined) => void;
    /**玩家在超时前重新上线时触发。*/
    onOnline?: (playerId: string, player: P) => void;
    /**玩家掉线超时时触发。*/
    onTimeout?: (playerId: string, player: P | undefined) => void;
}

/**
 * 将“掉线宽限/超时踢出”作为 State 生命周期策略，而不是 Player 类型能力。
 *
 * 推荐挂在整局常驻的根 State 上。组件默认监控当前 Game 的全部 participation，
 * 也可通过 groupSet / participantFilter 缩小到某个逻辑玩家集合：
 * - offline -> 开始独立倒计时；
 * - online -> 取消倒计时并恢复/创建 GamePlayer wrapper；
 * - timeout -> 可选 leave()，并可在监控 scope 为空后 stopGame()。
 *
 * State 退出时所有倒计时会随 RunnerManager 一并取消。
 */
export class DisconnectTimeoutComponent<
    P extends GamePlayer = GamePlayer,
    S extends GameState<P, any> = GameState<P, any>
> extends GameComponent<S, DisconnectTimeoutOptions<P>> {
    private readonly timers = new Map<string, string>();

    protected override onAttach(): void {
        // Online /game:hub and /game:l release membership without a connection event.
        // Defer the stop check so leave() callers can finish their own state transition.
        this.subscribe(this.state.participation.changed, (event) => {
            const { playerId } = event;
            if (event.type === "left") {
                this.cancelTimeout(playerId, "participation-released");
                if (this.options?.stopGameWhenEmpty) {
                    this.runner.runDelay(() => this.stopIfScopedEmpty(), 1);
                }
                return;
            }

            // Runtime join(playerId) can restore an offline participant after
            // this component has attached, without another connection event.
            // Wait until join()/joinAll() have finished creating wrappers and
            // adding players to any configured group scope.
            this.runner.runDelay(() => {
                if (!this.isAttached || !this.isInScope(playerId)) return;
                const onlinePlayer = Game.server.getPlayer(playerId);
                if (onlinePlayer) this.state.playerManager.get(onlinePlayer);
                else this.startTimeout(playerId);
            }, 1);
        });
        // A scoped offline player may enter the group AFTER their participation
        // join notification. Observe the group itself so that this member does
        // not wait forever for a connection event that will never arrive.
        if (this.options?.groupSet) {
            this.subscribe(this.options.groupSet.changed, () => {
                for (const playerId of this.getScopedParticipantIds()) {
                    if (!Game.server.isOnline(playerId)) this.startTimeout(playerId);
                }
            });
        }
        this.subscribe(Game.events.connection, (event) => {
            if (event.type === "online") {
                this.handleOnline(event.playerId, event.player);
            } else {
                this.handleOffline(event.playerId);
            }
        });

        // connection 只负责后续状态变化；当前在线状态以服务器查询为准。
        const onlinePlayers = new Map(
            Game.server.getAllPlayers().map((player) => [player.id, player])
        );
        for (const playerId of this.getScopedParticipantIds()) {
            const onlinePlayer = onlinePlayers.get(playerId);
            if (onlinePlayer) {
                this.state.playerManager.get(onlinePlayer);
            } else {
                // Never stop the Game synchronously while this component is
                // still inside _onAttach() and not yet registered on its State.
                this.startTimeout(playerId, true);
            }
        }
    }

    private handleOnline(playerId: string, player: Player) {
        if (!this.state.playerManager.hasParticipant(playerId)) return;

        // 即使 scope 在掉线期间发生变化，也应先清理之前已经启动的 timer。
        this.cancelTimeout(playerId, "reconnected");

        const gamePlayer = this.state.playerManager.get(player);
        if (!gamePlayer || !this.isInScope(playerId, gamePlayer)) return;
        this.options?.onOnline?.(playerId, gamePlayer);
    }

    private handleOffline(playerId: string) {
        if (!this.isInScope(playerId)) return;
        this.options?.onOffline?.(
            playerId,
            this.state.playerManager.getById(playerId)
        );
        this.startTimeout(playerId);
    }

    private startTimeout(playerId: string, deferImmediate = false) {
        if (this.timers.has(playerId)) return;

        const timeout = this.options?.timeout ?? Duration.fromSeconds(30);
        this.trace.builtin(BuiltinTraceEventType.DisconnectTimeoutStarted, {
            player: this.trace.player(
                playerId,
                this.state.playerManager.getById(playerId)?.name
            ),
            timeoutTicks: timeout.ticks,
        });
        if (timeout.ticks <= 0) {
            if (deferImmediate) {
                const runnerId = this.runner.runDelay(() => {
                    this.timers.delete(playerId);
                    this.handleTimeout(playerId);
                }, 1);
                this.timers.set(playerId, runnerId);
            } else {
                this.handleTimeout(playerId);
            }
            return;
        }

        const runnerId = this.runner.runDelay(() => {
            this.timers.delete(playerId);
            this.handleTimeout(playerId);
        }, timeout.ticks);
        this.timers.set(playerId, runnerId);
    }

    private cancelTimeout(playerId: string, reason = "cancelled") {
        const runnerId = this.timers.get(playerId);
        if (!runnerId) return;
        this.runner.cancel(runnerId, "disconnect-timeout-cancelled");
        this.timers.delete(playerId);
        this.trace.builtin(BuiltinTraceEventType.DisconnectTimeoutCancelled, {
            player: this.trace.player(
                playerId,
                this.state.playerManager.getById(playerId)?.name
            ),
            reason,
        });
    }

    private handleTimeout(playerId: string) {
        if (!this.isInScope(playerId)) return;

        // online 事件与 timeout 落在同一 tick 时，以服务器当前状态为准。
        if (Game.server.isOnline(playerId)) {
            return;
        }

        const gamePlayer = this.state.playerManager.getById(playerId);
        this.trace.builtin(BuiltinTraceEventType.DisconnectTimeoutExpired, {
            player: this.trace.player(playerId, gamePlayer?.name),
        });
        // An application callback may throw or stop/recreate this Game.
        // A failed callback must not skip the configured membership release,
        // and an expired callback from an old Game must not mutate a new Game
        // that happens to reuse the same gameKey.
        try {
            this.options?.onTimeout?.(playerId, gamePlayer);
        } finally {
            if (this.state.isGameActive) {
                const releaseOnTimeout =
                    this.options?.releaseOnTimeout ??
                    this.options?.shouldRelease ??
                    false;
                if (releaseOnTimeout && this.state.playerManager.hasParticipant(playerId)) {
                    this.state.playerManager.leave(playerId, "disconnect-timeout");
                }
                this.stopIfScopedEmpty();
            }
        }
    }

    private stopIfScopedEmpty(): void {
        if (!this.isAttached || !this.options?.stopGameWhenEmpty) return;
        // Re-evaluate at execution time: another player may have joined this tick.
        if (this.getScopedParticipantIds().length === 0) {
            this.state.stopGame("participants-empty");
        }
    }

    private isInScope(playerId: string, player?: P): boolean {
        if (!this.state.playerManager.hasParticipant(playerId)) return false;

        const gamePlayer = player ?? this.state.playerManager.getById(playerId);
        if (this.options?.groupSet && !this.options.groupSet.has(playerId)) {
            return false;
        }
        if (
            this.options?.participantFilter &&
            !this.options.participantFilter(playerId, gamePlayer)
        ) {
            return false;
        }
        return true;
    }

    private getScopedParticipantIds(): readonly string[] {
        return this.state.playerManager
            .getParticipantIds()
            .filter((playerId) => this.isInScope(playerId));
    }

    protected override onDetach(): void {
        for (const playerId of [...this.timers.keys()]) {
            this.cancelTimeout(playerId, "component-detach");
        }
    }
}
