import { EntityComponentTypes } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerTextPrimitiveOptions } from "./playerTextPrimitive";

/** 预设共用的可选字段（players 与 text 由各预设决定）。 */
export type PlayerTextPresetBase<P extends GamePlayer = GamePlayer> = Omit<
    PlayerTextPrimitiveOptions<P>,
    "players" | "text"
>;

/** 固定格式前缀，或按玩家动态计算的格式前缀。 */
export type PlayerTextColor<P extends GamePlayer = GamePlayer> =
    | string
    | ((player: P) => string);

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
    /** 名字前缀（例如队伍颜色 §c）；也可按玩家动态计算。 */
    color?: PlayerTextColor<P>;
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
        text: text ?? ((player) => formatName(player, color)),
    };
}

export interface PlayerInfoTextOptions<P extends GamePlayer = GamePlayer>
    extends PlayerTextPresetBase<P> {
    /** 要显示名字和血量的玩家来源。 */
    players: PlayerTextPrimitiveOptions<P>["players"];
    /** 名字前缀（例如队伍颜色 §c）；也可按玩家动态计算。 */
    nameColor?: PlayerTextColor<P>;
    /** 覆盖第一行的名字文本。 */
    nameText?: (player: P) => string;
    /** 覆盖第二行的血量文本。 */
    healthText?: (player: P) => string;
}

/**
 * 玩家信息预设：用一个 TextPrimitive 同时显示名字与血量。
 *
 * 默认两行：
 * ```text
 * 玩家名
 * 20/20
 * ```
 *
 * 相比同时挂载 playerNameText / playerHealthText，只创建并维护一个 primitive。
 */
export function playerInfoText<P extends GamePlayer = GamePlayer>(
    options: PlayerInfoTextOptions<P>
): PlayerTextPrimitiveOptions<P> {
    const { nameColor, nameText, healthText, ...rest } = options;
    return {
        offset: { x: 0, y: 2.5, z: 0 },
        scale: 1,
        depthTest: false,
        ...rest,
        text: (player) => {
            const name =
                nameText?.(player) ?? formatName(player, nameColor);
            const health = healthText?.(player) ?? formatHealth(player);
            // 清掉名字行可能携带的格式，避免粗体等样式泄漏到血量行。
            return `${name}§r\n${health}`;
        },
    };
}

/** 默认名字文本，可使用固定或动态颜色前缀。 */
export function formatName<P extends GamePlayer = GamePlayer>(
    player: P,
    color?: PlayerTextColor<P>
): string {
    const prefix =
        typeof color === "function" ? color(player) : color ?? "";
    return `${prefix}${player.name}`;
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
