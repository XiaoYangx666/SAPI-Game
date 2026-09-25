import { BlockVolume, Dimension, Vector3, world } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameState } from "../../gameState/gameState";
import { Game } from "../../main";
import { Duration } from "../../utils/duration";
import { Vector3Utils } from "../../utils/vector";
import { GameComponent } from "../gameComponent";

export interface SpawnPointProtectorOptions<P extends GamePlayer> {
    /** 玩家组。只有该组玩家会受到出生点交互保护。 */
    playerGroup: PlayerGroup<P>;
    /** 出生点。 */
    spawnPoint: Vector3;
    /** 出生点所在维度。 */
    dimension: Dimension;
    /** 是否循环设置玩家重生点，默认 true。 */
    autoSetSpawnPoint?: boolean;
    /** 循环保护出生点区域的间隔，默认 10 tick。 */
    protectInterval?: Duration;
    /** 出生点保护范围，默认 { x: 1, y: 1, z: 1 }。 */
    protectRadius?: Vector3;
}

export class SpawnPointProtector<P extends GamePlayer> extends GameComponent<
    GameState,
    SpawnPointProtectorOptions<P>
> {
    override onAttach(): void {
        const options = this.options;
        if (!options) return;

        const autoSetSpawnPoint = options.autoSetSpawnPoint ?? true;

        if (autoSetSpawnPoint) {
            this.setPlayerSpawnPoints();
        }
        this.protectSpawnAreas();

        this.subscribe(
            Game.events.interval,
            () => {
                if (autoSetSpawnPoint) {
                    this.setPlayerSpawnPoints();
                }
                this.protectSpawnAreas();
            },
            options.protectInterval ?? new Duration(10)
        );

        const protectedBlock = Vector3Utils.below(options.spawnPoint);
        this.subscribe(world.beforeEvents.playerInteractWithBlock, (event) => {
            if (!options.playerGroup.has(event.player)) return;
            if (event.block.dimension.id !== options.dimension.id) return;
            if (!Vector3Utils.isEqual(event.block.location, protectedBlock)) {
                return;
            }
            event.cancel = true;
        });
    }

    /** 立即为当前组内有效玩家设置重生点。 */
    setPlayerSpawnPoints() {
        const { playerGroup, spawnPoint, dimension } = this.options!;
        playerGroup.forEach((player) => {
            player.player.setSpawnPoint({
                dimension,
                ...spawnPoint,
            });
        });
    }

    /** 传送当前组内全部有效玩家到出生点。 */
    teleportAllToSpawn() {
        const { playerGroup, spawnPoint, dimension } = this.options!;
        playerGroup.forEach((player) => {
            player.player.teleport(spawnPoint, { dimension });
        });
    }

    /** 清空出生点上方保护区域，并确保脚下方块为基岩。 */
    private protectSpawnAreas() {
        const { spawnPoint, dimension, protectRadius } = this.options!;
        try {
            const radius = protectRadius ?? { x: 1, y: 1, z: 1 };
            const max = Vector3Utils.add(spawnPoint, radius);
            const min = Vector3Utils.subtract(spawnPoint, {
                x: radius.x,
                y: 0,
                z: radius.z,
            });

            dimension.fillBlocks(new BlockVolume(max, min), "air");

            const floor = Vector3Utils.below(spawnPoint);
            const floorBlock = dimension.getBlock(floor);
            if (floorBlock?.typeId !== "minecraft:bedrock") {
                dimension.setBlockType(floor, "minecraft:bedrock");
            }
        } catch {
            // 区块可能正处于卸载边界；下一轮保护会自然重试。
        }
    }
}
