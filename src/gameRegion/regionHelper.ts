import { BlockTypes, world } from "@minecraft/server";
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
        const blockType = BlockTypes.get(block);
        if (!blockType) return;
        for (let region of regions) {
            dim.fillBlocks(region.toVolume(), blockType);
            yield;
        }
    }

    /**分割Region，保证每块小于32767 */
    splitCubeRegion(initialRegion: CubeRegion): CubeRegion[] {
        const MAX_CAPACITY = 32767;
        const queue: CubeRegion[] = [initialRegion];
        const result: CubeRegion[] = [];

        while (queue.length > 0) {
            // 使用 ! 断言确保 region 存在，因为 queue.length > 0
            const region = queue.shift()!;

            if (region.getCapacity() <= MAX_CAPACITY) {
                result.push(region);
                continue;
            }

            const { x1, y1, z1, x2, y2, z2 } = region.getBounds();
            const sizes = {
                x: x2 - x1 + 1,
                y: y2 - y1 + 1,
                z: z2 - z1 + 1,
            };

            // 1. 【优化】选择最长的、且可以被分割的轴
            let axisToSplit: "x" | "y" | "z" | null = null;
            let maxDim = 1; // 尺寸为1的轴不能被分割

            // 遍历所有轴，找到尺寸大于1的最长轴
            for (const axis of ["x", "y", "z"] as const) {
                if (sizes[axis] > maxDim) {
                    maxDim = sizes[axis];
                    axisToSplit = axis;
                }
            }

            // 如果没有找到可以分割的轴（即所有轴的尺寸都为1）
            if (axisToSplit === null) {
                // 此时无法再分割，即使容量超标也只能强制保留
                result.push(region);
                continue;
            }

            // 2. 【优化】简化分割逻辑，避免使用 switch
            const startCoords = { x: x1, y: y1, z: z1 };
            const endCoords = { x: x2, y: y2, z: z2 };

            // 计算分割点
            const mid =
                startCoords[axisToSplit] + Math.floor(sizes[axisToSplit] / 2);

            // 创建第一个子区域的终点坐标
            const firstRegionEndCoords = { ...endCoords };
            firstRegionEndCoords[axisToSplit] = mid - 1;

            // 创建第二个子区域的起点坐标
            const secondRegionStartCoords = { ...startCoords };
            secondRegionStartCoords[axisToSplit] = mid;

            // 将两个新的子区域推入队列等待处理
            queue.push(
                new CubeRegion(
                    region.dimensionId,
                    startCoords,
                    firstRegionEndCoords
                )
            );
            queue.push(
                new CubeRegion(
                    region.dimensionId,
                    secondRegionStartCoords,
                    endCoords
                )
            );
        }
        return result;
    }
}

export const regionHelper = new RegionHelper();
