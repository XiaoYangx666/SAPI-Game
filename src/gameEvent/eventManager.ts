import { EventCallBack, EventSignal, VanillaEventSignal } from "./eventSignal";
import { GameEventSubscription, Subscription } from "./subscription";

export class EventManager {
    private readonly subscriptionMap: Map<object, EventSubscription[]> =
        new Map();
    private isActive = true;

    /**订阅事件 */
    subscribe<T extends EventSignal<any>>(
        subscriber: object,
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
        if (!this.isActive) return;
        const [callback, options] = args;

        const result =
            options !== undefined
                ? event.subscribe(callback, options)
                : event.subscribe(callback);
        const subscription =
            typeof result === "function"
                ? new GameEventSubscription(
                      event as VanillaEventSignal<T>,
                      callback as EventCallBack<T>
                  )
                : result;

        const record = new EventSubscription(event, subscriber, subscription);
        const list = this.subscriptionMap.get(subscriber) ?? [];
        list.push(record);
        this.subscriptionMap.set(subscriber, list);
        return record;
    }

    /**取消订阅 */
    unsubscribe(subscription: EventSubscription): void {
        const subData = asInternal(subscription);
        const list = this.subscriptionMap.get(subData.subscriber);
        if (!list) return;
        const idx = list.indexOf(subscription);
        if (idx === -1) return;

        list.splice(idx, 1);
        if (list.length === 0) {
            this.subscriptionMap.delete(subData.subscriber);
        }
        subData.subscription.unsubscribe();
    }

    unsubscribeByEvent(event: EventSignal<any>) {
        const errors: unknown[] = [];
        this.subscriptionMap.forEach((list, subscriber) => {
            const retained: EventSubscription[] = [];
            for (const subscription of list) {
                const sub = asInternal(subscription);
                if (sub.event !== event) {
                    retained.push(subscription);
                    continue;
                }
                try {
                    sub.subscription.unsubscribe();
                } catch (err) {
                    errors.push(err);
                }
            }

            if (retained.length > 0) {
                this.subscriptionMap.set(subscriber, retained);
            } else {
                this.subscriptionMap.delete(subscriber);
            }
        });

        if (errors.length > 0) {
            throw new AggregateError(errors, "取消事件订阅失败");
        }
    }

    /**取消订阅指定object的所有事件 */
    unsubscribeBySubscriber(subscriber: object) {
        const list = this.subscriptionMap.get(subscriber);
        if (!list) return;
        this.subscriptionMap.delete(subscriber);

        const errors: unknown[] = [];
        for (const sub of list) {
            try {
                asInternal(sub).subscription.unsubscribe();
            } catch (err) {
                errors.push(err);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "取消订阅者事件失败");
        }
    }

    dispose() {
        if (!this.isActive) return;
        this.isActive = false;

        const lists = [...this.subscriptionMap.values()];
        this.subscriptionMap.clear();
        const errors: unknown[] = [];
        for (const list of lists) {
            for (const sub of list) {
                try {
                    asInternal(sub).subscription.unsubscribe();
                } catch (err) {
                    errors.push(err);
                }
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "EventManager 清理失败");
        }
    }

    debug() {
        console.log("=== EventManager Debug ===");
        console.log("Total subscribers:", this.subscriptionMap.size);

        this.subscriptionMap.forEach((list, subscriber) => {
            console.log("Subscriber:", (subscriber as any).name);
            console.log("  Total subscriptions:", list.length);
            for (const sub of list) {
                const internal = asInternal(sub);
                console.log("   → Event:", internal.event.constructor.name);
            }
        });

        console.log("==========================");
    }
}

export class EventSubscription {
    constructor(
        private readonly event: EventSignal<any>,
        private readonly subscriber: object,
        private readonly subscription: Subscription
    ) {}
}

interface EventSubscriptionInternal {
    subscriber: object;
    subscription: Subscription;
    event: EventSignal<any>;
}

function asInternal(sub: EventSubscription): EventSubscriptionInternal {
    return sub as unknown as EventSubscriptionInternal;
}
