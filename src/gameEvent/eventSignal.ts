import { Subscription } from "./subscription";
import { Logger } from "../utils/logger";

/**事件回调 */
export type EventCallBack<T = void> = T extends void
    ? () => void
    : (arg0: T) => void;

export type EventSignal<T> = VanillaEventSignal<T> | CustomEventSignal<T>;

/**游戏原生事件 */
export interface VanillaEventSignal<T> {
    subscribe(callback: EventCallBack<T>, options?: unknown): EventCallBack<T>;
    unsubscribe(callback: EventCallBack<T>): void;
}

export interface CustomEventSignal<T> {
    subscribe(callback: EventCallBack<T>, options?: unknown): Subscription;
}

/**自定义事件 */
export abstract class BasicCustomEventSignal<T, U> {
    protected set: Set<T> = new Set();
    protected logger: Logger = new Logger(this.constructor.name);

    // 取消订阅
    protected unsubscribe(item: T): void {
        if (this.set.has(item)) {
            this.set.delete(item);
        }
    }

    protected abstract runCallback(item: T, data: U): void;

    // 发布事件，执行所有回调
    publish(data: U): void {
        const callbacksCopy = [...this.set];
        for (const cb of callbacksCopy) {
            try {
                this.runCallback(cb, data);
            } catch (e) {
                this.logger.error("Callback error:", e);
            }
        }
    }
}
