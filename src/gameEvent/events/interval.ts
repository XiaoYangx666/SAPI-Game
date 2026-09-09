import { system } from "@minecraft/server";
import { Logger } from "@sapi-game/utils";
import { Duration } from "../../utils/duration";
import { CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";

interface IntervalEventData {
    callback: () => void;
    interval: number;
    tickCount: number;
}

/**按需运行的间隔时间事件。没有订阅者时不会保留 Minecraft interval。*/
export class IntervalEventSignal implements CustomEventSignal<void> {
    private intervalId: number | null = null;
    private readonly items = new Set<IntervalEventData>();
    private readonly logger = new Logger(this.constructor.name);

    subscribe(callback: () => void, interval?: Duration): Subscription {
        const ticks = Math.max(1, interval?.ticks ?? 1);
        const data: IntervalEventData = {
            callback,
            interval: ticks,
            tickCount: ticks,
        };
        this.items.add(data);
        if (this.intervalId === null) this.start();

        let unsubscribed = false;
        return {
            unsubscribe: () => {
                if (unsubscribed) return;
                unsubscribed = true;
                this.items.delete(data);
                if (this.items.size === 0) this.stop();
            },
        };
    }

    private start() {
        if (this.intervalId !== null) return;
        this.intervalId = system.runInterval(() => this.tick());
    }

    private stop() {
        if (this.intervalId === null) return;
        system.clearRun(this.intervalId);
        this.intervalId = null;
    }

    private tick() {
        for (const item of [...this.items]) {
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
        this.items.clear();
        this.stop();
    }
}
