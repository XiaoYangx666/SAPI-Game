import { Game } from "@sapi-game/main";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { GameState } from "../../gameState/gameState";
import { Duration } from "../../utils/duration";
import { GameComponent } from "../gameComponent";

export interface DisconnectTimeoutOptions<P extends GamePlayer = GamePlayer> {
    /**掉线宽限时间，默认 30 秒。*/
    timeout?: Duration;
    /**超时后是否自动释放 participation，默认 true。*/
    shouldRelease?: boolean;
    /**释放后若当前游戏已没有 participant，是否自动 stopGame，默认 false。*/
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
 * 推荐挂在整局常驻的根 State 上。组件只监控当前 Game 的 participation：
 * - offline -> 开始独立倒计时；
 * - online -> 取消倒计时并恢复/创建 GamePlayer wrapper；
 * - timeout -> 可选 leave()，并可在全部 participant 离开后 stopGame()。
 *
 * State 退出时所有倒计时会随 RunnerManager 一并取消。
 */
export class DisconnectTimeoutComponent<
    P extends GamePlayer = GamePlayer,
    S extends GameState<P, any> = GameState<P, any>
> extends GameComponent<S, DisconnectTimeoutOptions<P>> {
    private readonly timers = new Map<string, string>();

    protected override onAttach(): void {
        this.subscribe(Game.events.connection, (event) => {
            if (event.type === "online") {
                this.handleOnline(event.playerId, event.player);
            } else {
                this.handleOffline(event.playerId);
            }
        });

        // connection signal 在第一个订阅者出现时会建立当前在线玩家快照。
        // 因此组件即使在游戏恢复后才挂载，也能正确处理此前已离线的 participant。
        for (const playerId of this.state.playerManager.getParticipantIds()) {
            const onlinePlayer = Game.events.connection.getOnlinePlayer(playerId);
            if (onlinePlayer) {
                this.state.playerManager.get(onlinePlayer);
            } else {
                this.startTimeout(playerId);
            }
        }
    }

    private handleOnline(playerId: string, player: import("@minecraft/server").Player) {
        if (!this.state.playerManager.hasParticipant(playerId)) return;
        this.cancelTimeout(playerId);

        const gamePlayer = this.state.playerManager.get(player);
        if (gamePlayer) this.options?.onOnline?.(playerId, gamePlayer);
    }

    private handleOffline(playerId: string) {
        if (!this.state.playerManager.hasParticipant(playerId)) return;
        this.options?.onOffline?.(
            playerId,
            this.state.playerManager.getById(playerId)
        );
        this.startTimeout(playerId);
    }

    private startTimeout(playerId: string) {
        if (this.timers.has(playerId)) return;

        const timeout = this.options?.timeout ?? Duration.fromSeconds(30);
        if (timeout.ticks <= 0) {
            this.handleTimeout(playerId);
            return;
        }

        const runnerId = this.runner.runDelay(() => {
            this.timers.delete(playerId);
            this.handleTimeout(playerId);
        }, timeout.ticks);
        this.timers.set(playerId, runnerId);
    }

    private cancelTimeout(playerId: string) {
        const runnerId = this.timers.get(playerId);
        if (!runnerId) return;
        this.runner.cancel(runnerId);
        this.timers.delete(playerId);
    }

    private handleTimeout(playerId: string) {
        if (!this.state.playerManager.hasParticipant(playerId)) return;

        // online 事件与 timeout 落在同一 tick 时，以在线状态为准。
        if (Game.events.connection.isOnline(playerId)) return;

        const gamePlayer = this.state.playerManager.getById(playerId);
        this.options?.onTimeout?.(playerId, gamePlayer);

        if (this.options?.shouldRelease ?? true) {
            this.state.playerManager.leave(playerId);
        }

        if (
            (this.options?.stopGameWhenEmpty ?? false) &&
            this.state.playerManager.getParticipantIds().length === 0
        ) {
            this.state.stopGame();
        }
    }

    protected override onDetach(): void {
        for (const runnerId of this.timers.values()) {
            this.runner.cancel(runnerId);
        }
        this.timers.clear();
    }
}
