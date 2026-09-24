import { EntityComponentTypes } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerTextPrimitiveOptions } from "./playerTextPrimitive";

/** 预设共用的可选字段（players 与 text 由各预设决定）。 */
export type PlayerTextPresetBase<P extends GamePlayer = GamePlayer> = Omit<
    PlayerTextPrimitiveOptions<P>,
    "players" | "text"
>;

export interface PlayerHealthTextOptions<P extends GamePlayer = GamePlayer>
    extends PlayerTextPresetBase<P> {
    /** 要显示血量的玩家来源。 */
    players: PlayerTextPrimitiveOptions<P>["players"];
    /** 覆盖默认的血量文本。 */
    text?: (player: P) => string;
}

/**
 * 血量显示预设：在玩家头顶用 textPrimitive 显示当前/最大生命值。
 *
 * 颜色会随血量比例变化（>50% 绿、>25% 黄、否则红）。
 */
export function playerHealthText<P extends GamePlayer = GamePlayer>(
    options: PlayerHealthTextOptions<P>
): PlayerTextPrimitiveOptions<P> {
    const { text, ...rest } = options;
    return {
        offset: { x: 0, y: 2.5, z: 0 },
        scale: 1.2,
        depthTest: false,
        ...rest,
        text: text ?? ((player) => formatHealth(player)),
    };
}

export interface PlayerNameTextOptions<P extends GamePlayer = GamePlayer>
    extends PlayerTextPresetBase<P> {
    /** 要显示名字的玩家来源。 */
    players: PlayerTextPrimitiveOptions<P>["players"];
    /** 名字前缀（例如队伍颜色 §c）。 */
    color?: string;
    /** 覆盖默认的名字文本。 */
    text?: (player: P) => string;
}

/**
 * 名字显示预设：在玩家头顶用 textPrimitive 显示名字。
 */
export function playerNameText<P extends GamePlayer = GamePlayer>(
    options: PlayerNameTextOptions<P>
): PlayerTextPrimitiveOptions<P> {
    const { text, color, ...rest } = options;
    return {
        offset: { x: 0, y: 2.5, z: 0 },
        scale: 1,
        depthTest: false,
        ...rest,
        text: text ?? ((player) => `${color ?? ""}${player.name}`),
    };
}

/** 默认血量文本：`12/20`，随比例变色。 */
export function formatHealth(player: GamePlayer): string {
    const health = player.player?.getComponent(EntityComponentTypes.Health);
    if (!health) return "§7--";
    try {
        const current = Math.ceil(health.currentValue);
        const max = Math.ceil(health.effectiveMax || health.defaultValue || 20);
        const ratio = max > 0 ? current / max : 0;
        const color = ratio > 0.5 ? "§a" : ratio > 0.25 ? "§e" : "§c";
        return `${color}${current}§7/§f${max}`;
    } catch {
        return "§7--";
    }
}
