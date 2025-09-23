import { world } from "@minecraft/server";
import { CubeRegion } from "./gameRegion";

/**游戏区域 */
class RegionHelper {
    /**填充方块，需自己保证区块已加载 */
    fillGenerator(region: CubeRegion, block: string) {
        const splited = this.splitCubeRegion(region);
        return this.fillGen(splited, block);
    }

    private *fillGen(regions: CubeRegion[], block: string) {
        if (regions.length == 0) return;
        const dim = world.getDimension(regions[0].dimensionId);
        for (let region of regions) {
            dim.fillBlocks(region.toVolume(), block);
            yield;
        }
    }

    /**分割Region，保证每块小于32767 */
    splitCubeRegion(initialRegion: CubeRegion): CubeRegion[] {
        const MAX_CAPACITY = 32767;

        const queue: CubeRegion[] = [initialRegion];
        const result: CubeRegion[] = [];

        while (queue.length > 0) {
            const currentRegion = queue.shift()!;

            if (currentRegion.getCapacity() <= MAX_CAPACITY) {
                result.push(currentRegion);
                continue;
            }

            const { x1, y1, z1, x2, y2, z2 } = currentRegion.getBounds();
            const sizeX = x2 - x1 + 1;
            const sizeY = y2 - y1 + 1;
            const sizeZ = z2 - z1 + 1;

            if (sizeX >= sizeY && sizeX >= sizeZ) {
                const midX = x1 + Math.floor(sizeX / 2);
                queue.push(
                    new CubeRegion(
                        initialRegion.dimensionId,
                        { x: x1, y: y1, z: z1 },
                        { x: midX - 1, y: y2, z: z2 }
                    )
                );
                queue.push(
                    new CubeRegion(
                        initialRegion.dimensionId,
                        { x: midX, y: y1, z: z1 },
                        { x: x2, y: y2, z: z2 }
                    )
                );
            } else if (sizeY >= sizeX && sizeY >= sizeZ) {
                const midY = y1 + Math.floor(sizeY / 2);
                queue.push(
                    new CubeRegion(
                        initialRegion.dimensionId,
                        { x: x1, y: y1, z: z1 },
                        { x: x2, y: midY - 1, z: z2 }
                    )
                );
                queue.push(
                    new CubeRegion(
                        initialRegion.dimensionId,
                        { x: x1, y: midY, z: z1 },
                        { x: x2, y: y2, z: z2 }
                    )
                );
            } else {
                const midZ = z1 + Math.floor(sizeZ / 2);
                queue.push(
                    new CubeRegion(
                        initialRegion.dimensionId,
                        { x: x1, y: y1, z: z1 },
                        { x: x2, y: y2, z: midZ - 1 }
                    )
                );
                queue.push(
                    new CubeRegion(
                        initialRegion.dimensionId,
                        { x: x1, y: y1, z: midZ },
                        { x: x2, y: y2, z: z2 }
                    )
                );
            }
        }
        return result;
    }
}

export const regionHelper = new RegionHelper();
