import { GameState } from "@sapi-game/gameState/gameState";
import { Game } from "@sapi-game/main";
import { BuiltinTraceEventType } from "../../../trace/contract";
import { GameComponent } from "../../gameComponent";
import { TimerOnTimeEventSignal } from "./onTimeEvent";
import { TimerTickEventSignal } from "./tickEvent";

// Timer的配置接口
export interface TimerOptions {
    /** 初始时间(s) 默认0*/
    initialTime?: number;
    /** 是否在附加到游戏时自动开始
     *
     * @default false
     */
    autoStart?: boolean;
    /**
     * 是否进行卡顿补偿，默认关闭 ;
     * 如果要严格计时，请开启
     */
    compensate?: boolean;
}

export class Timer extends GameComponent<GameState<any>, TimerOptions> {
    private remainingTime: number = 0;
    private _isRunning: boolean = false;
    private lastTime: number = 0;
    public readonly events = {
        tick: new TimerTickEventSignal(),
        onTime: new TimerOnTimeEventSignal(),
    } as const;

    /** 获取当前剩余时间 */
    public get time(): Readonly<number> {
        return this.remainingTime;
    }

    /**获取计时器是否正在运行*/
    public get isRunning(): Readonly<boolean> {
        return this._isRunning;
    }

    /** 组件被附加到游戏对象时调用 */
    override onAttach(): void {
        this.set(this.options?.initialTime ?? 0);

        this.subscribe(Game.events.interval, () => {
            if (!this._isRunning) return;

            const now = Date.now();
            const diff = now - this.lastTime;
            if (diff < 1000) return;

            const steps = this.options?.compensate
                ? Math.floor(diff / 1000)
                : 1;
            this.lastTime = this.options?.compensate
                ? this.lastTime + steps * 1000
                : now;
            this.advance(steps);
        });

        if (this.options?.autoStart) {
            this.start();
        }
    }

    override onDetach(): void {
        if (this._isRunning) {
            this.trace.builtin(BuiltinTraceEventType.TimerCancelled, {
                reason: "component-detach",
                remainingTime: this.remainingTime,
            });
        }
        this._isRunning = false;
        super.onDetach();
        this.state.eventManager.unsubscribeByEvent(this.events.onTime);
        this.state.eventManager.unsubscribeByEvent(this.events.tick);
    }

    /** 设置计时器的当前时间 */
    public set(time: number): void {
        this.remainingTime = Math.max(0, time);
        this.lastTime = Date.now();
    }

    /**停止计时器 */
    public stop(reason = "manual"): void {
        if (this._isRunning) {
            this.trace.builtin(BuiltinTraceEventType.TimerCancelled, {
                reason,
                remainingTime: this.remainingTime,
            });
        }
        this._isRunning = false;
    }

    /**启动计时器 */
    public start(): void {
        if (this.remainingTime > 0 && !this._isRunning && this.isAttached) {
            this._isRunning = true;
            this.lastTime = Date.now();
            this.trace.builtin(BuiltinTraceEventType.TimerStarted, {
                remainingTime: this.remainingTime,
                compensate: this.options?.compensate ?? false,
            });
            this.events.tick.publish(this.remainingTime);
            this.events.onTime.checkAndFireTimeEvents(this.remainingTime);
        }
    }

    /**
     * 推进若干秒。
     * compensate=true 时一次 tick 可能跨过多个秒值，因此逐秒发布事件，
     * 避免 5 -> 2 时漏掉注册在 4/3 的 onTime。
     */
    private advance(steps: number): void {
        if (steps <= 0 || !this._isRunning) return;

        const count = Math.min(steps, this.remainingTime);
        for (let i = 0; i < count && this._isRunning; i++) {
            this.remainingTime = Math.max(0, this.remainingTime - 1);
            this.events.tick.publish(this.remainingTime);
            this.events.onTime.checkAndFireTimeEvents(this.remainingTime);

            if (this.remainingTime === 0) {
                this._isRunning = false;
                this.trace.builtin(BuiltinTraceEventType.TimerExpired, {
                    remainingTime: 0,
                });
            }
        }
    }
}
