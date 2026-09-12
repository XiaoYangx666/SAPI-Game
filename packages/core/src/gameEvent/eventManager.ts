import {
    BuiltinTraceEventType,
    traceError,
    type TraceScope,
} from "@begame/trace-core";
import { BEGameConfig } from "../config";
import { Logger } from "../utils/logger";
import { EventCallBack, EventSignal, VanillaEventSignal } from "./eventSignal";
import { GameEventSubscription, Subscription } from "./subscription";

export class EventManager {
    private readonly subscriptionMap: Map<object, EventSubscription[]> =
        new Map();
    private readonly logger = new Logger(this.constructor.name);
    private isActive = true;

    /**订阅事件 */
    subscribe<T extends EventSignal<any>>(
        subscriber: object,
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
        if (!this.isActive) return;
        const [callback, options] = args;
        const wrappedCallback = this.wrapCallback(subscriber, event, callback);

        const result =
            options !== undefined
                ? event.subscribe(wrappedCallback, options)
                : event.subscribe(wrappedCallback);
        const subscription =
            typeof result === "function"
                ? new GameEventSubscription(
                      event as VanillaEventSignal<T>,
                      wrappedCallback as EventCallBack<T>
                  )
                : result;

        const record = new EventSubscription(event, subscriber, subscription);
        const list = this.subscriptionMap.get(subscriber) ?? [];
        list.push(record);
        this.subscriptionMap.set(subscriber, list);
        return record;
    }

    /**
     * 事件回调统一包装，承担两件事：
     *
     * 1. 异常追踪：回调抛错时先把结构化错误写入回调所属 State/Component 的
     *    Trace Session，然后原样继续抛出。继续抛出是刻意保持的：底层事件信号
     *    仍按原逻辑隔离错误并写入日志，不改变游戏执行行为。
     * 2. 同步契约检查：state/component 回调按同步契约处理，返回 thenable 说明
     *    调用者把 async 函数直接当回调用了；debugMode 下每个订阅提示一次。
     *
     * 包装后的回调会作为唯一身份传给事件信号，退订必须使用同一身份。
     */
    private wrapCallback<TCallback>(
        subscriber: object,
        event: object,
        callback: TCallback
    ): TCallback {
        const trace = (subscriber as { trace?: TraceScope }).trace;
        const signal = signalName(event);
        let warnedThenable = false;

        const wrapped = (...args: unknown[]) => {
            let result: unknown;
            try {
                result = (callback as (...inner: unknown[]) => unknown)(...args);
            } catch (error) {
                if (trace?.enabled) {
                    trace.builtin(BuiltinTraceEventType.EventCallbackError, {
                        signal,
                        error: traceError(error),
                    });
                }
                throw error;
            }

            if (!warnedThenable && isThenable(result)) {
                warnedThenable = true;
                if (BEGameConfig.config.debugMode) {
                    this.logger.warn(
                        `${constructorName(subscriber)} 订阅的 ${signal} 回调返回了 Promise；` +
                            "事件回调是同步契约，异步逻辑请使用 runner.run(...)，" +
                            "否则 Promise rejection 不会被 Trace 捕获。"
                    );
                }
            }
            return result;
        };
        return wrapped as TCallback;
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

function signalName(event: object): string {
    try {
        const name = (event as { constructor?: { name?: unknown } }).constructor
            ?.name;
        return typeof name === "string" && name.length > 0
            ? name
            : "EventSignal";
    } catch {
        return "EventSignal";
    }
}

function constructorName(value: unknown): string {
    try {
        const name = (
            value as { constructor?: { name?: unknown } } | null | undefined
        )?.constructor?.name;
        return typeof name === "string" && name.length > 0
            ? name
            : "anonymous";
    } catch {
        return "anonymous";
    }
}

function isThenable(value: unknown): boolean {
    if (value === null) return false;
    const type = typeof value;
    if (type !== "object" && type !== "function") return false;
    try {
        return typeof (value as { then?: unknown }).then === "function";
    } catch {
        return false;
    }
}
