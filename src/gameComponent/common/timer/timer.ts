import { GameState } from "@sapi-game/gameState/gameState";
import { Game } from "@sapi-game/main";
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

    /**
     * 组件被附加到游戏对象时调用
     */
    override onAttach(): void {
        this.set(this.options?.initialTime ?? 0);

        // 订阅游戏的tick事件，这是驱动计时器的核心
        this.subscribe(Game.events.interval, () => {
            if (!this._isRunning) {
                return;
            }

            const now = Date.now();
            const diff = now - this.lastTime;
            if (diff >= 1000) {
                if (this.remainingTime <= 0) {
                    this._isRunning = false;
                    return;
                }
                if (this.options?.compensate) {
                    // 严格按真实时间走，补偿丢失的秒数
                    const steps = Math.floor(diff / 1000);
                    this.remainingTime -= steps;
                    this.lastTime += steps * 1000;
                } else {
                    // 不补偿，直接视为 1 秒过去
                    this.remainingTime -= 1;
                    this.lastTime = now;
                }

                // 执行每一秒的回调
                this.events.tick.publish(this.remainingTime);

                // 检查并执行特定时间点的事件
                this.events.onTime.checkAndFireTimeEvents(this.remainingTime);
            }
        });
        if (this.options?.autoStart) {
            this.start();
        }
    }

    override onDetach(): void {
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
    public stop(): void {
        this._isRunning = false;
    }

    /**启动计时器 */
    public start(): void {
        if (this.remainingTime > 0 && !this._isRunning && this.isAttached) {
            this._isRunning = true;
            this.lastTime = Date.now();
            this.events.tick.publish(this.remainingTime);
            this.events.onTime.checkAndFireTimeEvents(this.remainingTime);
        }
    }
}
