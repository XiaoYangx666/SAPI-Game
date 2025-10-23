import {
    PlayerInteractWithBlockBeforeEvent,
    Vector3,
    world,
} from "@minecraft/server";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { DimensionIds } from "../../utils/vanila-data";
import { BaseMapEventSignal, SubscriptionData } from "../mapEventSignal";

interface SignClickData
    extends SubscriptionData<PlayerInteractWithBlockBeforeEvent> {
    players?: PlayerGroup<any>;
}

interface SignClickEventOptions {
    dimensionId: DimensionIds;
    loc: Vector3;
    players?: PlayerGroup<any>;
}

export class SignClickEventSignal extends BaseMapEventSignal<
    string,
    PlayerInteractWithBlockBeforeEvent,
    SignClickData,
    SignClickEventOptions
> {
    private readonly signId = "minecraft:wall_sign";
    protected buildKey(options: SignClickEventOptions): string {
        const loc = options.loc;
        return `${options.dimensionId}-${loc.x}-${loc.y}-${loc.z}`;
    }

    protected override buildData(
        callback: (event: PlayerInteractWithBlockBeforeEvent) => void,
        options: SignClickEventOptions
    ): SignClickData {
        return {
            callback,
            players: options.players,
        };
    }

    protected extractKey(event: PlayerInteractWithBlockBeforeEvent): string {
        const loc = event.block.location;
        return `${event.block.dimension.id}-${loc.x}-${loc.y}-${loc.z}`;
    }

    protected override isTargetEvent(
        event: PlayerInteractWithBlockBeforeEvent
    ): boolean {
        return event.block.typeId === this.signId;
    }

    protected filter(
        data: SignClickData,
        event: PlayerInteractWithBlockBeforeEvent
    ): boolean {
        if (data.players && !data.players.getById(event.player.id)) {
            return false;
        }
        return true;
    }

    protected subscribeNative(
        cb: (e: PlayerInteractWithBlockBeforeEvent) => void
    ) {
        world.beforeEvents.playerInteractWithBlock.subscribe(cb);
        return cb;
    }

    protected unsubscribeNative(
        cb: (e: PlayerInteractWithBlockBeforeEvent) => void
    ) {
        world.beforeEvents.playerInteractWithBlock.unsubscribe(cb);
    }
}
