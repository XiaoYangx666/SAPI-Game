import { GameState } from "@sapi-game/gameState/gameState";
import { Game } from "@sapi-game/main";
import { GameComponent } from "../../gameComponent";
import { StopWatchOnTimeEventSignal } from "./onTimeEvent";
import { StopWatchTickEventSignal } from "./tickEvent";

export interface StopWatchOptions {
    /** 是否自动开始 */
    autoStart?: boolean;
    /** 是否补偿真实时间（防止掉帧时少算秒） */
    compensate?: boolean;
    /** 初始时间（可用于恢复上次状态） */
    initialTime?: number;
}

export class StopWatch extends GameComponent<GameState<any>, StopWatchOptions> {
    private elapsedTime: number = 0;
    private _isRunning: boolean = false;
    private lastTime: number = 0;
    private isActive: boolean = true;

    public readonly events = {
        tick: new StopWatchTickEventSignal(),
        onTime: new StopWatchOnTimeEventSignal(),
    } as const;

    /** 获取当前已计时间（秒） */
    public get time(): Readonly<number> {
        return this.elapsedTime;
    }

    /** 获取秒表是否正在运行 */
    public get isRunning(): Readonly<boolean> {
        return this._isRunning;
    }

    /** 组件被附加到游戏对象时调用 */
    override onAttach(): void {
        this.isActive = true;
        this.elapsedTime = this.options?.initialTime ?? 0;

        if (this.options?.autoStart) {
            this.start();
        }

        // 订阅游戏的 tick 事件，驱动秒表
        this.subscribe(Game.events.interval, () => {
            if (!this._isRunning) return;

            const now = Date.now();
            const diff = now - this.lastTime;
            if (diff >= 1000) {
                if (this.options?.compensate) {
                    // 按真实时间补偿，防止掉帧少加
                    const steps = Math.floor(diff / 1000);
                    this.elapsedTime += steps;
                    this.lastTime += steps * 1000;
                } else {
                    // 不补偿，只加 1 秒
                    this.elapsedTime += 1;
                    this.lastTime = now;
                }

                // 每秒触发 tick
                this.events.tick.publish(this.elapsedTime);

                // 检查并触发特定时间事件
                this.events.onTime.checkAndFireTimeEvents(this.elapsedTime);
            }
        });
    }

    override onDetach(): void {
        this._isRunning = false;
        this.isActive = false;
        super.onDetach();
        this.state.eventManager.unsubscribeByEvent(this.events.onTime);
        this.state.eventManager.unsubscribeByEvent(this.events.tick);
    }

    /** 重置秒表时间 */
    public reset(time: number = 0): void {
        this.elapsedTime = Math.max(0, time);
        this.lastTime = Date.now();
        if (this._isRunning) {
            this.events.tick.publish(this.elapsedTime);
        }
    }

    /** 停止秒表 */
    public stop(): void {
        this._isRunning = false;
    }

    /** 启动秒表 */
    public start(): void {
        if (!this._isRunning && this.isActive) {
            this._isRunning = true;
            this.lastTime = Date.now();
            this.events.tick.publish(this.elapsedTime);
            this.events.onTime.checkAndFireTimeEvents(this.elapsedTime);
        }
    }

    /** 暂停或恢复 */
    public toggle(): void {
        this._isRunning ? this.stop() : this.start();
    }
}
