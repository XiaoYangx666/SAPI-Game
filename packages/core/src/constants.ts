import { Dimension, world } from "@minecraft/server";
import { createDeferredObject } from "./utils/deferredObject";
import { DimensionIds } from "./utils/vanila-data";

//维度常量
type Dimensions = {
    [K in keyof typeof DimensionIds]: Dimension;
};
const { proxy: dims, setTarget } = createDeferredObject<Dimensions>();
world.afterEvents.worldLoad.subscribe(() => {
    setTarget({
        Overworld: world.getDimension(DimensionIds.Overworld),
        Nether: world.getDimension(DimensionIds.Nether),
        End: world.getDimension(DimensionIds.End),
    });
});
export const Dimensions = dims;

export const Constants = {
    /**维度常量（游戏加载后可用） */
    dimension: dims,
} as const;
