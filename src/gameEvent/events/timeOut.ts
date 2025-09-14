import { system } from "@minecraft/server";
import { CustomEventSignal, EventCallBack } from "../eventSignal";
import { Subscription } from "../subscription";
import { Duration } from "../../utils/duration";

/**在一段时间后运行指定代码 */
export class TimeOutEventSignal implements CustomEventSignal<void> {
    subscribe(callback: EventCallBack<void>, delay: Duration): Subscription {
        const id = system.runTimeout(callback, delay.ticks);
        return {
            unsubscribe: () => {
                system.clearRun(id);
            },
        };
    }
}
