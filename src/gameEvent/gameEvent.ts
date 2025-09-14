import { ButtonPushEventSignal } from "./events/buttonPush";
import { PlayerRegionEventSignal } from "./events/regionEvents";
import { IntervalEventSignal } from "./events/tick";
import { TimeOutEventSignal } from "./events/timeOut";

export type EventSignals<T> = {
    [K in keyof T as Exclude<K, "dispose">]: T[K];
};

export class gameEvents {
    interval: IntervalEventSignal;
    timeOut = new TimeOutEventSignal();
    buttonPush = new ButtonPushEventSignal();
    region: PlayerRegionEventSignal;

    constructor() {
        this.interval = new IntervalEventSignal();
        this.region = new PlayerRegionEventSignal(this.interval);
    }

    dispose() {
        this.interval.dispose();
        this.buttonPush.cleanup();
        this.region.dispose();
    }
}
