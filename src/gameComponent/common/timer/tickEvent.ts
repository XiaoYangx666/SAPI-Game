import {
    CustomEventSignal,
    EventCallBack,
} from "@sapi-game/gameEvent/eventSignal";
import { Subscription } from "@sapi-game/gameEvent/subscription";

interface TimerTickEvent {
    remainingTime: number;
}

export class TimerTickEventSignal implements CustomEventSignal<TimerTickEvent> {
    private tickCallbacks: Set<EventCallBack<TimerTickEvent>> = new Set();

    constructor() {}

    /** 注册一个在每次时间减少（每秒）时执行的回调函数*/
    subscribe(callback: (arg0: TimerTickEvent) => void): Subscription {
        this.tickCallbacks.add(callback);
        return {
            unsubscribe: () => {
                this.tickCallbacks.delete(callback);
            },
        };
    }

    publish(remainingTime: number) {
        this.tickCallbacks.forEach((cb) =>
            cb({ remainingTime: remainingTime })
        );
    }
}
