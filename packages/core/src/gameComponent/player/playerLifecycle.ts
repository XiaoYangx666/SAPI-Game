import {
    EntityDieAfterEvent,
    PlayerSpawnAfterEvent,
    world,
} from "@minecraft/server";
import {
    GamePlayer,
    PlayerSource,
    findPlayerSourceEntry,
} from "../../gamePlayer";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { GameState } from "../../gameState/gameState";
import { EntityTypeIds } from "../../utils/vanila-data";
import { GameComponent } from "../gameComponent";

export interface PlayerDeathContext<
    P extends GamePlayer = GamePlayer,
    TData = any
> {
    player: P;
    group?: PlayerGroup<P, TData>;
    event: EntityDieAfterEvent;
}

export interface PlayerSpawnContext<
    P extends GamePlayer = GamePlayer,
    TData = any
> {
    player: P;
    group?: PlayerGroup<P, TData>;
    event: PlayerSpawnAfterEvent;
}

export interface PlayerLifecycleOptions<
    P extends GamePlayer = GamePlayer,
    TData = any
> {
    players: PlayerSource<P, TData>;
    onDeath?: (context: PlayerDeathContext<P, TData>) => void;
    onSpawn?: (context: PlayerSpawnContext<P, TData>) => void;
}

/** 为 addComponent 保留 PlayerSource 推导，与 regionBoundary/playerInfoText 的用法一致。 */
export function playerLifecycle<
    P extends GamePlayer = GamePlayer,
    TData = any
>(
    options: PlayerLifecycleOptions<P, TData>
): PlayerLifecycleOptions<P, TData> {
    return options;
}

/**
 * 玩家死亡/重生生命周期桥。
 *
 * 只负责把原生事件映射回 GamePlayer / PlayerGroup，不处理死亡文案、
 * 生命数、装备或淘汰规则，这些都属于具体游戏。
 */
export class PlayerLifecycle extends GameComponent<
    GameState,
    PlayerLifecycleOptions<any, any>
> {
    override onAttach(): void {
        const options = this.options;
        if (!options) return;

        if (options.onDeath) {
            this.subscribe(world.afterEvents.entityDie, (event) => {
                if (event.deadEntity.typeId !== EntityTypeIds.Player) return;
                const entry = findPlayerSourceEntry(
                    options.players,
                    event.deadEntity.id
                );
                if (!entry) return;
                options.onDeath?.({
                    player: entry.player,
                    group: entry.group,
                    event,
                });
            });
        }

        if (options.onSpawn) {
            this.subscribe(world.afterEvents.playerSpawn, (event) => {
                const entry = findPlayerSourceEntry(
                    options.players,
                    event.player.id
                );
                if (!entry) return;
                options.onSpawn?.({
                    player: entry.player,
                    group: entry.group,
                    event,
                });
            });
        }
    }
}
