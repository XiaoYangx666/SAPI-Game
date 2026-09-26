import {
    BlockVolume,
    Dimension,
    Vector3,
    world,
} from "@minecraft/server";
import {
    GamePlayer,
    PlayerSource,
    playerSourceHas,
    resolvePlayers,
} from "../../gamePlayer";
import { GameState } from "../../gameState/gameState";
import { Game } from "../../main";
import { Duration } from "../../utils/duration";
import { Vector3Utils } from "../../utils/vector";
import { GameComponent } from "../gameComponent";

export type SpawnPosition = Vector3 | (() => Vector3 | undefined);

export interface SpawnBinding<
    P extends GamePlayer = GamePlayer,
    TData = any
> {
    players: PlayerSource<P, TData>;
    position: SpawnPosition;
}

export interface SpawnSafeAreaOptions {
    /**
     * resetSpawnAreas() / resetOnAttach 使用的清空半径。
     * y 只向上扩张；默认 { x: 1, y: 1, z: 1 }。
     */
    resetRadius?: Vector3;
    /**
     * 周期维护的清空半径。
     * false 表示不周期清空；默认只保证出生点方块为空，即 {0,0,0}。
     */
    maintainRadius?: Vector3 | false;
    /** 清空区域使用的方块，默认 minecraft:air。 */
    clearBlock?: string;
    /** 出生点脚下方块，默认 minecraft:bedrock。 */
    floorBlock?: string;
    /** attach 时立即 resetSpawnAreas，默认 true。 */
    resetOnAttach?: boolean;
    /** 阻止受控玩家与任意受控出生点脚下方块交互，默认 true。 */
    protectFloorInteraction?: boolean;
}

export interface SpawnControllerOptions {
    dimension: Dimension;
    bindings: SpawnBinding[];
    /** 是否周期刷新玩家原生出生点，默认 true。 */
    autoSetSpawnPoint?: boolean;
    /** attach 完成安全区重置后是否立即传送全部受控玩家，默认 false。 */
    teleportOnAttach?: boolean;
    /** 周期刷新/维护间隔，默认 10 tick。 */
    interval?: Duration;
    /** 不配置则只管理出生点/传送，不修改场地。 */
    safeArea?: SpawnSafeAreaOptions | false;
}

/**
 * 一组 PlayerSource 到出生点的统一控制器。
 *
 * 负责：
 * - 周期 setSpawnPoint；
 * - 批量 teleport；
 * - 可选安全区 reset / 轻量周期维护；
 * - 可选脚下方块交互保护。
 *
 * “如何选择/随机分配哪个出生点”属于游戏业务，应在创建 bindings 前完成。
 */
export class SpawnController extends GameComponent<
    GameState,
    SpawnControllerOptions
> {
    override onAttach(): void {
        const options = this.options;
        if (!options) return;

        if (options.autoSetSpawnPoint ?? true) {
            this.setSpawnPoints();
        }

        const safeArea = options.safeArea;
        if (safeArea && (safeArea.resetOnAttach ?? true)) {
            this.resetSpawnAreas();
        }

        if (options.teleportOnAttach) {
            this.teleportAll();
        }

        this.subscribe(
            Game.events.interval,
            () => {
                if (options.autoSetSpawnPoint ?? true) {
                    this.setSpawnPoints();
                }
                if (safeArea) {
                    this.maintainSpawnAreas();
                }
            },
            options.interval ?? new Duration(10)
        );

        if (safeArea && (safeArea.protectFloorInteraction ?? true)) {
            this.subscribe(
                world.beforeEvents.playerInteractWithBlock,
                (event) => {
                    if (event.block.dimension.id !== options.dimension.id) {
                        return;
                    }
                    if (!this.isControlledPlayer(event.player.id)) return;

                    for (const binding of options.bindings) {
                        const position = resolvePosition(binding.position);
                        if (
                            position &&
                            Vector3Utils.isEqual(
                                event.block.location,
                                Vector3Utils.below(position)
                            )
                        ) {
                            event.cancel = true;
                            return;
                        }
                    }
                }
            );
        }
    }

    /**
     * 为所有 bindings 当前的有效玩家刷新原生出生点。
     * 若玩家意外存在于多个 binding，第一个 binding 优先。
     */
    setSpawnPoints() {
        const options = this.options;
        if (!options) return;

        this.forEachBoundPlayer((player, position) => {
            player.player?.setSpawnPoint({
                dimension: options.dimension,
                ...position,
            });
        });
    }

    /**
     * 将所有 bindings 当前的有效玩家传送到各自出生点。
     * 若玩家意外存在于多个 binding，第一个 binding 优先。
     */
    teleportAll() {
        const options = this.options;
        if (!options) return;

        this.forEachBoundPlayer((player, position) => {
            player.player?.teleport(position, {
                dimension: options.dimension,
            });
        });
    }

    /**
     * 对每个出生点执行一次完整安全区重置：
     * 清空 resetRadius，并确保脚下 floorBlock。
     */
    resetSpawnAreas() {
        const options = this.options;
        const safeArea = options?.safeArea;
        if (!options || !safeArea) return;

        const radius = safeArea.resetRadius ?? { x: 1, y: 1, z: 1 };
        const positions = this.getUniquePositions();

        // 先全部清空，再统一铺地板，避免重叠安全区互相把 floor 清掉。
        for (const position of positions) {
            this.clearArea(position, radius);
        }
        for (const position of positions) {
            this.ensureFloor(position);
        }
    }

    /** 周期轻量维护安全区。 */
    maintainSpawnAreas() {
        const options = this.options;
        const safeArea = options?.safeArea;
        if (!options || !safeArea) return;

        const radius = safeArea.maintainRadius;
        const positions = this.getUniquePositions();

        if (radius !== false) {
            for (const position of positions) {
                this.clearArea(
                    position,
                    radius ?? { x: 0, y: 0, z: 0 }
                );
            }
        }
        for (const position of positions) {
            this.ensureFloor(position);
        }
    }

    private forEachBoundPlayer(
        callback: (player: GamePlayer, position: Vector3) => void
    ) {
        const seen = new Set<string>();
        for (const binding of this.options?.bindings ?? []) {
            const position = resolvePosition(binding.position);
            if (!position) continue;

            for (const player of resolvePlayers(binding.players)) {
                if (seen.has(player.id)) continue;
                seen.add(player.id);
                callback(player, position);
            }
        }
    }

    private isControlledPlayer(playerId: string) {
        for (const binding of this.options?.bindings ?? []) {
            if (playerSourceHas(binding.players, playerId)) return true;
        }
        return false;
    }

    private getUniquePositions(): Vector3[] {
        const positions = new Map<string, Vector3>();
        for (const binding of this.options?.bindings ?? []) {
            const position = resolvePosition(binding.position);
            if (!position) continue;
            positions.set(
                `${position.x}|${position.y}|${position.z}`,
                position
            );
        }
        return [...positions.values()];
    }

    private clearArea(position: Vector3, radius: Vector3) {
        const options = this.options!;
        const safeArea = options.safeArea;
        if (!safeArea) return;

        try {
            const max = Vector3Utils.add(position, radius);
            const min = Vector3Utils.subtract(position, {
                x: radius.x,
                y: 0,
                z: radius.z,
            });
            options.dimension.fillBlocks(
                new BlockVolume(max, min),
                safeArea.clearBlock ?? "minecraft:air"
            );
        } catch {
            // 区块可能在卸载边界；下一次 reset/maintain 自然重试。
        }
    }

    private ensureFloor(position: Vector3) {
        const options = this.options!;
        const safeArea = options.safeArea;
        if (!safeArea) return;

        try {
            const floor = Vector3Utils.below(position);
            const floorType = safeArea.floorBlock ?? "minecraft:bedrock";
            const block = options.dimension.getBlock(floor);
            if (block?.typeId !== floorType) {
                options.dimension.setBlockType(floor, floorType);
            }
        } catch {
            // 同上，区块未加载时稍后重试。
        }
    }
}

function resolvePosition(position: SpawnPosition): Vector3 | undefined {
    return typeof position === "function" ? position() : position;
}
