import { ButtonPushEventSignal } from "./events/buttonPush";
import { PlayerItemInSlotEventSignal } from "./events/inSlot";
import { IntervalEventSignal } from "./events/interval";
import { ItemUseEventSignal } from "./events/itemUse";
import { PlayerOnBlockEventSignal } from "./events/onBlock";
import { PlayerRegionEventSignal } from "./events/regionEvents";

export type EventSignals<T> = {
    [K in keyof T as Exclude<K, "dispose">]: T[K];
};

export class gameEvents {
    interval: IntervalEventSignal;
    buttonPush = new ButtonPushEventSignal();
    itemUse = new ItemUseEventSignal();
    region: PlayerRegionEventSignal;
    onBlock: PlayerOnBlockEventSignal;
    inSlot: PlayerItemInSlotEventSignal;

    constructor() {
        this.interval = new IntervalEventSignal();
        this.region = new PlayerRegionEventSignal(this.interval);
        this.onBlock = new PlayerOnBlockEventSignal(this.interval);
        this.inSlot = new PlayerItemInSlotEventSignal(this.interval);
    }

    dispose() {
        this.interval.dispose();
        this.buttonPush.cleanup();
        this.itemUse.cleanup();
        this.region.dispose();
    }
}
