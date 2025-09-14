import { EventCallBack, VanillaEventSignal } from "./eventSignal";

export interface Subscription {
    unsubscribe(): void;
}

/**游戏订阅句柄*/
export class GameEventSubscription<T> implements Subscription {
    constructor(
        public event: VanillaEventSignal<T>,
        public callback: EventCallBack<T>
    ) {}

    /**取消订阅事件 */
    unsubscribe() {
        console.log("Unsubscribing from event:", this.event.constructor.name);
        this.event.unsubscribe(this.callback);
    }
}
