import { system } from "@minecraft/server";
import { Logger } from "@sapi-game/utils";
import { Duration } from "../../utils/duration";
import { CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";

interface intervalEventData {
    callback: () => void;
    interval: number;
    tickCount: number;
}

/** 间隔时间事件 */
export class IntervalEventSignal implements CustomEventSignal<void> {
    private intervalId: number | null = null;
    private items = new Set<intervalEventData>();
    private logger = new Logger(this.constructor.name);

    subscribe(callback: () => void, interval?: Duration): Subscription {
        //启动interval
        if (!this.intervalId) this.start();
        //添加到set
        const data: intervalEventData = {
            callback: callback,
            interval: interval?.ticks ?? 0,
            tickCount: interval?.ticks ?? 1,
        };
        this.items.add(data);
        //返回取消订阅方法
        return {
            unsubscribe: () => this.items.delete(data),
        };
    }

    private start() {
        this.intervalId = system.runInterval(() => this.tick());
    }

    private tick() {
        for (const item of this.items) {
            item.tickCount--;
            if (item.tickCount <= 0) {
                try {
                    item.callback();
                } catch (e) {
                    this.logger.error("Interval callback error:", e);
                }
                item.tickCount = item.interval;
            }
        }
    }

    dispose() {
        if (this.intervalId !== null) {
            this.items.clear();
            system.clearRun(this.intervalId);
        }
    }
}
