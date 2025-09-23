import { ButtonPushAfterEvent, Player, world } from "@minecraft/server";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { DimensionIds } from "../../utils/vanila-data";
import { VectorUtils } from "../../utils/vector";
import { BaseMapEventSignal, SubscriptionData } from "../mapEventSignal";
import { Subscription } from "../subscription";

interface ButtonData extends SubscriptionData<ButtonPushAfterEvent> {
    players?: PlayerGroup<any>;
    sourceType?: string;
}

interface ButtonPushEventOptions {
    dimensionId: DimensionIds;
    loc: [number, number, number];
    players?: PlayerGroup<any>;
    sourceType?: string;
}

export class ButtonPushEventSignal extends BaseMapEventSignal<
    string,
    ButtonPushAfterEvent,
    ButtonData,
    ButtonPushEventOptions
> {
    protected buildKey(options: ButtonPushEventOptions): string {
        const loc = VectorUtils.fromArray(options.loc);
        return `${options.dimensionId}-${loc.x}-${loc.y}-${loc.z}`;
    }

    protected override buildData(
        callback: (event: ButtonPushAfterEvent) => void,
        options: ButtonPushEventOptions
    ): ButtonData {
        return {
            callback,
            players: options.players,
            sourceType: options.sourceType,
        };
    }

    protected extractKey(event: ButtonPushAfterEvent): string {
        const loc = event.block.location;
        return `${event.dimension.id}-${loc.x}-${loc.y}-${loc.z}`;
    }

    protected filter(data: ButtonData, event: ButtonPushAfterEvent): boolean {
        if (data.sourceType && event.source.typeId !== data.sourceType) return false;
        if (
            event.source instanceof Player &&
            data.players &&
            !data.players.getById(event.source.id)
        ) {
            return false;
        }
        return true;
    }

    protected subscribeNative(cb: (e: ButtonPushAfterEvent) => void) {
        world.afterEvents.buttonPush.subscribe(cb);
        return cb;
    }

    protected unsubscribeNative(cb: (e: ButtonPushAfterEvent) => void) {
        world.afterEvents.buttonPush.unsubscribe(cb);
    }
}
