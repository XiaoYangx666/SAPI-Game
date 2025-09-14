import { system } from "@minecraft/server";
import { Duration } from "../../utils/duration";
import { BasicCustomEventSignal, CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";

interface intervalEventData {
    callback: () => void;
    interval: number;
    tickcount: number;
}

/** 间隔时间事件 */
export class IntervalEventSignal
    extends BasicCustomEventSignal<intervalEventData, void>
    implements CustomEventSignal<void>
{
    intervalId: number | null = null;

    subscribe(
        callback: () => void,
        options?: { interval?: Duration }
    ): Subscription {
        //启动interval
        if (this.intervalId === null) {
            this.intervalId = system.runInterval(this.publish.bind(this));
            this.logger.debug("已启动interval");
        }
        //添加到set
        const data: intervalEventData = {
            callback: callback,
            interval: options?.interval?.ticks ?? 0,
            tickcount: 1,
        };
        this.set.add(data);
        //返回取消订阅方法
        return {
            unsubscribe: () => {
                this.unsubscribe(data);
            },
        };
    }

    protected runCallback(item: intervalEventData): void {
        if (item.interval > 0) {
            if (item.tickcount < item.interval) {
                item.tickcount++;
                return;
            }
            item.tickcount = 1;
        }
        try {
            item.callback();
        } catch (e) {
            this.logger.error("Callback error:", e);
        }
    }

    dispose() {
        if (this.intervalId !== null) {
            this.set.clear();
            system.clearRun(this.intervalId);
        }
    }
}
