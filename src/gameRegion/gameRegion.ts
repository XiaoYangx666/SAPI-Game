import {
    BlockVolume,
    EntityQueryOptions,
    Player,
    Vector2,
    Vector3,
    world,
} from "@minecraft/server";
import { DimensionIds } from "../utils/vanila-data";
import { VectorUtils } from "../utils/vector";

/**游戏区域 */
export abstract class GameRegion {
    dimensionId: DimensionIds;

    constructor(dimId: DimensionIds) {
        this.dimensionId = dimId;
    }

    abstract getEntityQueryOption(): EntityQueryOptions;
    abstract isInside(loc: any): boolean;

    /**获取区域内的玩家 */
    getPlayersInRegion() {
        return world
            .getDimension(this.dimensionId)
            .getPlayers(this.getEntityQueryOption())
            .filter((p) => p != undefined);
    }

    /**获取区域内实体 */
    getEntitesInRegion(options?: EntityQueryOptions) {
        return world
            .getDimension(this.dimensionId)
            .getEntities({ ...this.getEntityQueryOption(), ...options })
            .filter((e) => e != undefined);
    }

    /** 在区域内的玩家执行命令 */
    runCommandOnPlayers(commandString: string) {
        this.getPlayersInRegion().forEach((p) => p.runCommand(commandString));
    }

    /**对每个玩家执行操作 */
    forEachPlayer(callbackfn: (value: Player) => void) {
        this.getPlayersInRegion().forEach(callbackfn);
    }
}

/**立方体区域 */
export class CubeRegion extends GameRegion {
    pos1: Vector3;
    pos2: Vector3;
    constructor(dimId: DimensionIds, pos1: Vector3, pos2: Vector3) {
        super(dimId);
        this.pos1 = pos1;
        this.pos2 = pos2;
    }

    getEntityQueryOption(): EntityQueryOptions {
        return {
            location: this.pos1,
            volume: VectorUtils.subtract(this.pos2, this.pos1),
        };
    }

    isInside(loc: Vector3): boolean {
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

    /**转换为BlockVolume */
    toVolume() {
        return new BlockVolume(this.pos1, this.pos2);
    }

    /**获取大小 */
    getCapacity() {
        const dif = VectorUtils.subtract(this.pos2, this.pos1);
        return Math.abs(dif.x * dif.y * dif.z);
    }

    getBounds() {
        return {
            x1: this.pos1.x,
            x2: this.pos2.x,
            y1: this.pos1.y,
            y2: this.pos2.y,
            z1: this.pos1.z,
            z2: this.pos2.z,
        };
    }
}

/**球形区域 */
export class SphereRegion extends GameRegion {
    constructor(
        dimId: DimensionIds,
        public center: Vector3,
        public r: number,
        public rm?: number
    ) {
        super(dimId);
    }

    getEntityQueryOption(): EntityQueryOptions {
        return {
            location: this.center,
            maxDistance: this.r,
            minDistance: this.rm,
        };
    }

    isInside(loc: Vector3): boolean {
        const distance = VectorUtils.squaredDistance(this.center, loc);
        return distance <= this.r * this.r;
    }
}

/**平面区域 */
export class PlaneRegion extends GameRegion {
    constructor(
        dimId: DimensionIds,
        public pos1: Vector2,
        public pos2: Vector2
    ) {
        super(dimId);
    }

    getEntityQueryOption(): EntityQueryOptions {
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

    isInside(loc: Vector2): boolean {
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
