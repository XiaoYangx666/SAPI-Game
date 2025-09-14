import { Vector3 } from "@minecraft/server";

/**向量工具类，提供向量相关的操作方法 */
export class VectorHelper {
    static distance(v1: Vector3, v2: Vector3): number {
        return Math.sqrt(this.squaredDistance(v1, v2));
    }

    static squaredDistance(v1: Vector3, v2: Vector3): number {
        return (
            Math.pow(v2.x - v1.x, 2) +
            Math.pow(v2.y - v1.y, 2) +
            Math.pow(v2.z - v1.z, 2)
        );
    }

    /**将Vector3转为数组 */
    static toArray(vector: Vector3): number[] {
        return [vector.x, vector.y, vector.z];
    }

    static tostring(vector: Vector3): string {
        return `(${vector.x}, ${vector.y}, ${vector.z})`;
    }

    /**将数组转为Vector3 */
    static fromArray(array: number[]): Vector3 {
        if (array.length !== 3) {
            throw new Error("必须为长度为3的数组");
        }
        if (!array.every(Number.isFinite)) {
            throw new Error("数组必须包含数字");
        }
        return { x: array[0], y: array[1], z: array[2] };
    }

    static add(v1: Vector3, v2: Vector3): Vector3 {
        return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
    }

    static subtract(v1: Vector3, v2: Vector3): Vector3 {
        return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
    }

    static isEqual(v1: Vector3, v2: Vector3): boolean {
        return v1.x === v2.x && v1.y === v2.y && v1.z === v2.z;
    }
}
