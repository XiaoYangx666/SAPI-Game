import { EntityHurtBeforeEvent, Player, system, world } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import {
    PlayerSource,
    playerSourceHasBoth,
} from "../../gamePlayer/playerSource";
import { GameRegion } from "../../gameRegion/gameRegion";
import { GameState } from "../../gameState/gameState";
import { GameComponent } from "../gameComponent";

const PLAYER_TYPE_ID = "minecraft:player";

/** 区域判定方式。 */
export type PvpRegionScope = "victim" | "attacker" | "both" | "either";

export interface PvpControllerOptions<P extends GamePlayer = GamePlayer> {
    /**
     * 初始是否开启 PvP，默认 false。
     * 关闭时拦截范围内的玩家互相伤害（等价于 gamerule.pvp=false）。
     */
    enabled?: boolean;
    /**
     * 按玩家范围生效：仅当攻击者与被攻击者都在这批玩家内时才受控。
     * 不传表示不按玩家限制。
     */
    players?: PlayerSource<P>;
    /**
     * 按区域生效：满足 {@link regionScope} 的玩家落在该区域时才受控。
     * 传入数组表示「落在其中任意一个区域」即可。不传表示不按区域限制。
     * 常用于各种游戏大厅：挂一个 `enabled: false` 的控制器即可禁止大厅 PvP。
     */
    region?: GameRegion | GameRegion[];
    /**
     * 区域判定方式，默认 "either"：
     * - "victim"：被攻击者在区域内
     * - "attacker"：攻击者在区域内
     * - "both"：双方都在区域内
     * - "either"：任意一方在区域内（可防止隔着区域边缘互相攻击）
     */
    regionScope?: PvpRegionScope;
    /** 拦截时是否提示攻击者，默认 false。 */
    showMessage?: boolean;
    /** 提示文本，默认「未开启 PvP」。 */
    message?: string;
}

/**
 * 通用 PvP 控制组件：用 `world.beforeEvents.entityHurt` 拦截玩家之间的伤害。
 *
 * 相比全局 `gamerule.pvp`，它按组件实例生效，可以只作用于某个游戏的玩家或
 * 某个区域，多个游戏 / 大厅同时运行时不会互相覆盖；并且支持运行中
 * `enable()` / `disable()` 动态开关（例如色盲派对在第 5 轮才开启 PvP）。
 *
 * `players` 与 `region` 可以同时提供，此时需要同时满足两个范围条件。
 *
 * 注意：本组件只负责「拦截」伤害。要保证 PvP 能正常造成伤害，世界里
 * `gamerule.pvp` 需保持开启（项目在 `bootstrapPartyGames` 的 worldLoad 里统一设置）。
 */
export class PvpController<
    P extends GamePlayer = GamePlayer
> extends GameComponent<GameState, PvpControllerOptions<P>> {
    private overrideEnabled?: boolean;
    /** 归一化后的区域列表，避免每次受击事件都分配数组。 */
    private regions?: GameRegion[];

    override onAttach(): void {
        if (!this.options) return;
        this.overrideEnabled = this.options.enabled ?? false;
        const region = this.options.region;
        this.regions =
            region === undefined
                ? []
                : Array.isArray(region)
                  ? region
                  : [region];
        this.subscribe(world.beforeEvents.entityHurt, (event) =>
            this.onHurt(event)
        );
    }

    /** 当前是否开启 PvP。 */
    get enabled(): Readonly<boolean> {
        return this.overrideEnabled ?? this.options?.enabled ?? false;
    }

    /** 开启 PvP（放行玩家互相伤害）。 */
    enable() {
        this.overrideEnabled = true;
        return this;
    }

    /** 关闭 PvP（拦截玩家互相伤害）。 */
    disable() {
        this.overrideEnabled = false;
        return this;
    }

    /** 设置 PvP 开关。 */
    setEnabled(enabled: boolean) {
        this.overrideEnabled = enabled;
        return this;
    }

    /** 反转 PvP 开关。 */
    toggle() {
        this.overrideEnabled = !this.enabled;
        return this;
    }

    private onHurt(event: EntityHurtBeforeEvent) {
        if (this.enabled) return;
        if (event.hurtEntity.typeId !== PLAYER_TYPE_ID) return;

        const attacker = event.damageSource.damagingEntity;
        if (!attacker || attacker.typeId !== PLAYER_TYPE_ID) return;

        const victim = event.hurtEntity as Player;
        const source = attacker as Player;
        if (!this.inScope(victim, source)) return;

        event.cancel = true;

        if (this.options?.showMessage) {
            const message = this.options.message ?? "§c当前未开启 PvP！";
            system.run(() => {
                try {
                    source.onScreenDisplay.setActionBar(message);
                } catch {}
            });
        }
    }

    /** 同时满足玩家范围与区域范围时才受控。 */
    private inScope(victim: Player, attacker: Player): boolean {
        return this.playerScopeMatches(victim, attacker) &&
            this.regionScopeMatches(victim, attacker);
    }

    private playerScopeMatches(victim: Player, attacker: Player): boolean {
        const source = this.options?.players;
        if (source === undefined) return true;
        return playerSourceHasBoth(source, victim.id, attacker.id);
    }

    private regionScopeMatches(victim: Player, attacker: Player): boolean {
        const regions = this.regions;
        if (!regions || regions.length === 0) return true;

        const mode = this.options?.regionScope ?? "either";
        return regions.some((area) => {
            const victimIn = this.isInRegion(victim, area);
            const attackerIn = this.isInRegion(attacker, area);
            switch (mode) {
                case "victim":
                    return victimIn;
                case "attacker":
                    return attackerIn;
                case "both":
                    return victimIn && attackerIn;
                default:
                    return victimIn || attackerIn;
            }
        });
    }

    private isInRegion(player: Player, region: GameRegion): boolean {
        try {
            if (region.dimensionId !== player.dimension.id) return false;
            return region.isInside(player.location);
        } catch {
            return false;
        }
    }
}
