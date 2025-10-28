import { ButtonPushEventSignal } from "./events/buttonPush";
import { PlayerItemInSlotEventSignal } from "./events/inSlot";
import { IntervalEventSignal } from "./events/interval";
import { ItemUseEventSignal } from "./events/itemUse";
import { PlayerOnBlockEventSignal } from "./events/onBlock";
import { PlayerRegionEventSignal } from "./events/regionEvents";
import { SignClickEventSignal } from "./events/signClick";

export class gameEvents {
    /**间隔时间事件 */
    readonly interval: IntervalEventSignal;
    /**按钮按下事件 */
    readonly buttonPush = new ButtonPushEventSignal();
    /**木牌被点击事件 */
    readonly signClick = new SignClickEventSignal();
    /**物品使用事件 */
    readonly itemUse = new ItemUseEventSignal();
    /**玩家区域事件 */
    readonly region: PlayerRegionEventSignal;
    /**玩家在方块上事件 */
    readonly onBlock: PlayerOnBlockEventSignal;
    /**玩家物品在指定槽位事件 */
    readonly inSlot: PlayerItemInSlotEventSignal;

    constructor() {
        this.interval = new IntervalEventSignal();
        this.region = new PlayerRegionEventSignal(this.interval);
        this.onBlock = new PlayerOnBlockEventSignal(this.interval);
        this.inSlot = new PlayerItemInSlotEventSignal(this.interval);
    }
}

export * from "./events/buttonPush";
export * from "./events/inSlot";
export * from "./events/interval";
export * from "./events/itemUse";
export * from "./events/onBlock";
export * from "./events/regionEvents";
export * from "./events/signClick";
