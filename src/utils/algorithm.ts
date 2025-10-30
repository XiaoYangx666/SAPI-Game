import { Block, Vector3 } from "@minecraft/server";
import { Vector3Utils } from "./vector";

/**
 * BFS 遍历方块
 * @param startBlock 起始方块
 * @param condition 判断方块是否满足条件
 * @param maxDistance 可选，最大遍历距离
 */
function bfsBlocks(
    startBlock: Block,
    condition: (block: Block, distance: number) => boolean,
    maxDistance: number = 20,
    maxBlocks: number = 64
): Block[] {
    const visited = new Set<string>();
    const queue: { block: Block; distance: number }[] = [
        { block: startBlock, distance: 0 },
    ];
    const result: Block[] = [];

    while (queue.length > 0) {
        const { block, distance } = queue.shift()!;
        const locStr = Vector3Utils.toString(block.location);

        if (visited.has(locStr)) continue;
        visited.add(locStr);

        // 仅当方块满足条件时才加入结果并继续扩展邻居
        if (condition(block, distance)) {
            result.push(block);

            // 达到最大方块数则直接返回
            if (result.length >= maxBlocks) break;

            if (distance < maxDistance) {
                for (const neighbor of getNeighborBlocks(block)) {
                    if (result.length >= maxBlocks) break; // 避免继续加入
                    const neighborLocStr = Vector3Utils.toString(
                        neighbor.location
                    );
                    if (!visited.has(neighborLocStr)) {
                        queue.push({ block: neighbor, distance: distance + 1 });
                    }
                }
            }
        }
    }

    return result;
}

/**获取相邻方块 */
function getNeighborBlocks(block: Block, corner: boolean = false): Block[] {
    const neighbors: Block[] = [];

    // 正交方向
    const directions = [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
    ];

    for (const dir of directions) {
        const nb = block.offset(dir);
        if (nb) neighbors.push(nb);
    }

    // 对角方向
    if (corner) {
        for (let dx of [-1, 0, 1]) {
            for (let dy of [-1, 0, 1]) {
                for (let dz of [-1, 0, 1]) {
                    if (dx === 0 && dy === 0 && dz === 0) continue; // 自己
                    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 1)
                        continue;
                    const nb = block.offset({ x: dx, y: dy, z: dz });
                    if (nb) neighbors.push(nb);
                }
            }
        }
    }

    return neighbors;
}

/** 线性插值 */
function linspace(start: Vector3, end: Vector3, num: number): Vector3[] {
    if (num <= 0) return [];
    if (num === 1) return [start];

    const step = {
        x: (end.x - start.x) / (num - 1),
        y: (end.y - start.y) / (num - 1),
        z: (end.z - start.z) / (num - 1),
    };

    return Array.from({ length: num }, (_, i) => ({
        x: start.x + i * step.x,
        y: start.y + i * step.y,
        z: start.z + i * step.z,
    }));
}

export const Algorithm = {
    bfsBlocks,
    linspace,
};
