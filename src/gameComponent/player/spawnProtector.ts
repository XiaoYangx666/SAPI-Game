import { BlockVolume, Dimension, Vector3, world } from "@minecraft/server";
import { GamePlayer, PlayerGroup } from "@sapi-game/gamePlayer";
import { GameState } from "@sapi-game/gameState";
import { Game } from "@sapi-game/main";
import { Duration, Vector3Utils } from "@sapi-game/utils";
import { GameComponent } from "../gameComponent";

export interface SpawnPointProtectorOptions<P extends GamePlayer> {
    /**玩家组 */
    playerGroup: PlayerGroup<P>;
    /** 出生点 */
    spawnPoint: Vector3;
    /**维度 */
    dimension: Dimension;
    /** 是否循环设置玩家重生点 */
    autoSetSpawnPoint?: boolean;
    /** 循环保护出生点区域的间隔 */
    protectInterval?: Duration;
    /** 出生点保护范围，默认 1x1x1 */
    protectRadius?: Vector3;
}

export class SpawnPointProtector<P extends GamePlayer> extends GameComponent<
    GameState,
    SpawnPointProtectorOptions<P>
> {
    override onAttach(): void {
        const options = this.options;
        if (!options) return;

        // 初始设置玩家重生点
        if (options.autoSetSpawnPoint ?? true) {
            this.setPlayerSpawnPoints();
        }

        // 循环设置重生点 & 保护区域
        const interval = options.protectInterval ?? new Duration(10);
        this.subscribe(
            Game.events.interval,
            () => {
                if (options.autoSetSpawnPoint) {
                    this.setPlayerSpawnPoints();
                }
                this.protectSpawnAreas();
            },
            interval
        );

        // 出生点保护：拦截方块交互
        const protectedBlock = Vector3Utils.below(options.spawnPoint);
        this.subscribe(world.beforeEvents.playerInteractWithBlock, (t) => {
            if (Vector3Utils.isEqual(t.block.location, protectedBlock)) {
                t.cancel = true;
            }
        });
    }

    /** 设置玩家重生点 */
    setPlayerSpawnPoints() {
        const { playerGroup, spawnPoint, dimension } = this.options!;
        playerGroup.forEach((p) => {
            p.player.setSpawnPoint({
                dimension,
                ...spawnPoint,
            });
        });
    }

    /** 传送所有玩家到出生点 */
    teleportAllToSpawn() {
        const { playerGroup, spawnPoint, dimension } = this.options!;
        playerGroup.forEach((p) => {
            p.player.teleport(spawnPoint, { dimension });
        });
    }

    /** 循环保护出生点区域 */
    private protectSpawnAreas() {
        const { spawnPoint, dimension, protectRadius } = this.options!;
        if (!spawnPoint || !dimension) return;

        try {
            const radius = protectRadius ?? { x: 1, y: 1, z: 1 };
            const max = Vector3Utils.add(spawnPoint, radius);
            const min = Vector3Utils.subtract(spawnPoint, {
                x: radius.x,
                y: 0,
                z: radius.z,
            });
            dimension.fillBlocks(new BlockVolume(max, min), "air");
            dimension.setBlockType(Vector3Utils.below(spawnPoint), "bedrock");
        } catch (err) {}
    }
}
