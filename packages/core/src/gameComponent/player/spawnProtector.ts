import { Dimension, Vector3 } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameState } from "../../gameState/gameState";
import { Duration } from "../../utils/duration";
import {
    SpawnController,
    SpawnControllerOptions,
} from "./spawnController";

export interface SpawnPointProtectorOptions<P extends GamePlayer> {
    playerGroup: PlayerGroup<P>;
    spawnPoint: Vector3;
    dimension: Dimension;
    autoSetSpawnPoint?: boolean;
    protectInterval?: Duration;
    protectRadius?: Vector3;
}

/**
 * @deprecated 使用 SpawnController。
 * 保留单队单出生点兼容适配，不再维护独立实现。
 */
export class SpawnPointProtector<
    P extends GamePlayer
> extends SpawnController {
    constructor(
        state: GameState,
        options?: SpawnPointProtectorOptions<P>,
        tag?: string
    ) {
        const mapped: SpawnControllerOptions | undefined = options
            ? {
                  dimension: options.dimension,
                  bindings: [
                      {
                          players: options.playerGroup,
                          position: options.spawnPoint,
                      },
                  ],
                  autoSetSpawnPoint: options.autoSetSpawnPoint,
                  interval: options.protectInterval,
                  safeArea: {
                      resetRadius:
                          options.protectRadius ??
                          ({ x: 1, y: 1, z: 1 } as Vector3),
                      // 旧实现每次都维护完整 protectRadius，兼容行为。
                      maintainRadius:
                          options.protectRadius ??
                          ({ x: 1, y: 1, z: 1 } as Vector3),
                  },
              }
            : undefined;
        super(state, mapped, tag);
    }

    setPlayerSpawnPoints() {
        this.setSpawnPoints();
    }

    teleportAllToSpawn() {
        this.teleportAll();
    }
}
