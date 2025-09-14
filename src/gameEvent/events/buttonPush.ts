import {
    ButtonPushAfterEvent,
    Player,
    Vector3,
    world,
} from "@minecraft/server";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { Logger } from "../../utils/logger";
import { DimensionIds } from "../../utils/types";
import { VectorHelper } from "../../utils/vector";
import { CustomEventSignal } from "../eventSignal";
import { Subscription } from "../subscription";

interface ButtonData {
    callback: (event: ButtonPushAfterEvent) => void;
    players?: PlayerGroup<any>;
}

export class ButtonPushEventSignal
    implements CustomEventSignal<ButtonPushAfterEvent>
{
    private logger = new Logger(this.constructor.name);
    private buttonMap: Map<string, Set<ButtonData>> = new Map();

    private totalCount = 0;

    private nativeUnsub?: (t: ButtonPushAfterEvent) => void;

    private inited = false;

    subscribe(
        callback: (t: ButtonPushAfterEvent) => void,
        options: {
            dimensionId: DimensionIds;
            loc: [number, number, number];
            players?: PlayerGroup<any>;
        }
    ): Subscription {
        if (!options || !options.dimensionId || !options.loc) {
            throw new Error("必须提供有效的dimensionId和loc参数");
        }
        const loc = VectorHelper.fromArray(options.loc);
        const key = this.buildKey(options.dimensionId, loc);
        if (!this.inited) {
            this.init();
        }
        let set = this.buttonMap.get(key);
        if (!set) {
            set = new Set();
            this.buttonMap.set(key, set);
        }
        const data = { callback: callback, players: options.players };
        set.add(data);
        this.totalCount++;
        let removed = false;

        return {
            unsubscribe: () => {
                if (removed) return;
                removed = true;
                const s = this.buttonMap.get(key);
                if (s && s.has(data)) {
                    s.delete(data);
                    this.totalCount--;
                    if (s.size === 0) {
                        this.buttonMap.delete(key);
                    }
                }
                if (this.totalCount <= 0) {
                    this.cleanup();
                }
            },
        };
    }

    private init() {
        this.inited = true;
        this.nativeUnsub = world.afterEvents.buttonPush.subscribe(
            this.publish.bind(this)
        );
    }

    cleanup() {
        if (this.nativeUnsub) {
            try {
                world.afterEvents.buttonPush.unsubscribe(this.nativeUnsub);
            } catch (e) {
                this.logger.warn("取消底层订阅失败:", e);
            } finally {
                this.nativeUnsub = undefined;
            }
        }
        this.buttonMap.clear();
        this.totalCount = 0;
        this.inited = false;
    }

    private publish(event: ButtonPushAfterEvent) {
        const location = event.block.location;
        const key = this.buildKey(event.dimension.id, location);
        const callbacks = this.buttonMap.get(key);
        if (callbacks) {
            for (const data of Array.from(callbacks)) {
                //如果不在playerGroup中，则跳过
                if (
                    event.source instanceof Player &&
                    data.players != undefined &&
                    data.players.getById(event.source.id) == undefined
                ) {
                    continue;
                }
                try {
                    data.callback(event);
                } catch (e) {
                    this.logger.error("buttonPush callback failed:", e);
                }
            }
        }
    }

    private buildKey(dimension: string, loc: Vector3): string {
        return `${dimension}-${loc.x}-${loc.y}-${loc.z}`;
    }
}
