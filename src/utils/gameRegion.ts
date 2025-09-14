import { EntityQueryOptions, Vector2, Vector3 } from "@minecraft/server";
import { VectorHelper } from "./vector";

/**游戏区域 */
export abstract class GameRegion {
    abstract toQueryOption(): EntityQueryOptions;
    abstract isInRegion(loc: any): boolean;
}

/**立方体区域 */
export class CubeRegion implements GameRegion {
    pos1: Vector3;
    pos2: Vector3;
    constructor(pos1: Vector3, pos2: Vector3) {
        this.pos1 = pos1;
        this.pos2 = pos2;
    }

    toQueryOption(): EntityQueryOptions {
        return {
            location: this.pos1,
            volume: VectorHelper.subtract(this.pos2, this.pos1),
        };
    }

    isInRegion(loc: Vector3): boolean {
        const EPSILON = 0.00001;

        const minX = Math.min(this.pos1.x, this.pos2.x);
        const maxX = Math.max(this.pos1.x, this.pos2.x) + 1;
        const minY = Math.min(this.pos1.y, this.pos2.y);
        const maxY = Math.max(this.pos1.y, this.pos2.y) + 0.99;
        const minZ = Math.min(this.pos1.z, this.pos2.z);
        const maxZ = Math.max(this.pos1.z, this.pos2.z) + 1;

        const inX = loc.x + EPSILON >= minX && loc.x - EPSILON <= maxX;
        const inY = loc.y + EPSILON >= minY && loc.y - EPSILON <= maxY;
        const inZ = loc.z + EPSILON >= minZ && loc.z - EPSILON <= maxZ;

        return inX && inY && inZ;
    }
}

/**球形区域 */
export class SphereRegion implements GameRegion {
    constructor(public center: Vector3, public r: number, public rm?: number) {}

    toQueryOption(): EntityQueryOptions {
        return {
            location: this.center,
            maxDistance: this.r,
            minDistance: this.rm,
        };
    }

    isInRegion(loc: Vector3): boolean {
        const distance = VectorHelper.squaredDistance(this.center, loc);
        return distance <= this.r * this.r;
    }
}

/**平面区域 */
export class PlaneRegion implements GameRegion {
    constructor(public pos1: Vector2, public pos2: Vector2) {}

    toQueryOption(): EntityQueryOptions {
        return {
            location: {
                x: this.pos1.x,
                y: -1000,
                z: this.pos1.y,
            },
            volume: {
                x: this.pos2.x - this.pos1.x,
                z: this.pos2.y - this.pos1.y,
                y: 2000,
            },
        };
    }

    isInRegion(loc: Vector2): boolean {
        const EPSILON = 0.00001;

        const minX = Math.min(this.pos1.x, this.pos2.x);
        const maxX = Math.max(this.pos1.x, this.pos2.x) + 1;
        const minY = Math.min(this.pos1.y, this.pos2.y);
        const maxY = Math.max(this.pos1.y, this.pos2.y) + 1;

        const inX = loc.x + EPSILON >= minX && loc.x - EPSILON <= maxX;
        const inY = loc.y + EPSILON >= minY && loc.y - EPSILON <= maxY;

        return inX && inY;
    }
}
