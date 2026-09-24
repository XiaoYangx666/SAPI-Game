import { EntityHurtBeforeEvent, Player, system, world } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroupSet } from "../../gamePlayer/groupSet";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

const PLAYER_TYPE_ID = "minecraft:player";

export interface FriendlyFireProtectorOptions<
    P extends GamePlayer = GamePlayer
> {
    /** 队伍集合：同一个 {@link PlayerGroupSet} 组内的玩家互为队友。 */
    groupSet: PlayerGroupSet<P>;
    /** 命中队友时是否提示攻击者，默认 true。 */
    showMessage?: boolean;
    /** 提示文本，默认「不能攻击队友」。 */
    message?: string;
}

/**
 * 友伤保护组件：监听 `world.beforeEvents.entityHurt`，
 * 当攻击者与被攻击者属于同一队伍时取消这次伤害。
 *
 * 与 `PvpController` 一样基于 entityHurt 的拦截实现，不修改全局 gamerule，
 * 因此多个游戏同时运行时互不影响。
 */
export class FriendlyFireProtector<
    P extends GamePlayer = GamePlayer
> extends GameComponent<GameState, FriendlyFireProtectorOptions<P>> {
    override onAttach(): void {
        if (!this.options) return;
        this.subscribe(world.beforeEvents.entityHurt, (event) =>
            this.onHurt(event)
        );
    }

    private onHurt(event: EntityHurtBeforeEvent) {
        const options = this.options;
        if (!options) return;
        if (event.hurtEntity.typeId !== PLAYER_TYPE_ID) return;

        const attacker = event.damageSource.damagingEntity;
        if (!attacker || attacker.typeId !== PLAYER_TYPE_ID) return;

        const victimInfo = options.groupSet.findById(event.hurtEntity.id);
        const attackerInfo = options.groupSet.findById(attacker.id);
        if (!victimInfo || !attackerInfo) return;
        if (victimInfo.group !== attackerInfo.group) return;

        event.cancel = true;

        if (options.showMessage ?? true) {
            const message = options.message ?? "§c不能攻击队友！";
            const player = attacker as Player;
            system.run(() => {
                try {
                    player.onScreenDisplay.setActionBar(message);
                } catch {}
            });
        }
    }
}
