import { EntityComponentTypes } from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerGroup } from "../../gamePlayer/playerGroup";
import { PlayerTextPrimitiveOptions } from "./playerTextPrimitive";

/** 预设共用的可选字段（players 与 text 由各预设决定）。 */
export type PlayerTextPresetBase<
    P extends GamePlayer = GamePlayer,
    TData = any
> = Omit<PlayerTextPrimitiveOptions<P, TData>, "players" | "text">;

export type PlayerTextFormatter<
    P extends GamePlayer = GamePlayer,
    TData = any
> = (player: P, group?: PlayerGroup<P, TData>) => string;

/** 固定格式前缀，或按玩家/所属组动态计算的格式前缀。 */
export type PlayerTextColor<
    P extends GamePlayer = GamePlayer,
    TData = any
> = string | PlayerTextFormatter<P, TData>;

export interface PlayerHealthTextOptions<
    P extends GamePlayer = GamePlayer,
    TData = any
> extends PlayerTextPresetBase<P, TData> {
    /** 要显示血量的玩家来源。 */
    players: PlayerTextPrimitiveOptions<P, TData>["players"];
    /** 覆盖默认的血量文本；来源有组语义时第二个参数为所属组。 */
    text?: PlayerTextFormatter<P, TData>;
}

export function playerHealthText<
    P extends GamePlayer = GamePlayer,
    TData = any
>(
    options: PlayerHealthTextOptions<P, TData>
): PlayerTextPrimitiveOptions<P, TData> {
    const { text, ...rest } = options;
    return {
        offset: { x: 0, y: 2.5, z: 0 },
        scale: 1.2,
        depthTest: false,
        ...rest,
        text: text ?? ((player) => formatHealth(player)),
    };
}

export interface PlayerNameTextOptions<
    P extends GamePlayer = GamePlayer,
    TData = any
> extends PlayerTextPresetBase<P, TData> {
    players: PlayerTextPrimitiveOptions<P, TData>["players"];
    /** 名字前缀；可直接根据玩家及所属组计算。 */
    color?: PlayerTextColor<P, TData>;
    /** 覆盖默认名字文本；来源有组语义时第二个参数为所属组。 */
    text?: PlayerTextFormatter<P, TData>;
}

export function playerNameText<
    P extends GamePlayer = GamePlayer,
    TData = any
>(
    options: PlayerNameTextOptions<P, TData>
): PlayerTextPrimitiveOptions<P, TData> {
    const { text, color, ...rest } = options;
    return {
        offset: { x: 0, y: 2.5, z: 0 },
        scale: 1,
        depthTest: false,
        ...rest,
        text: (player, group) =>
            text?.(player, group) ?? formatName(player, color, group),
    };
}

export interface PlayerInfoTextOptions<
    P extends GamePlayer = GamePlayer,
    TData = any
> extends PlayerTextPresetBase<P, TData> {
    players: PlayerTextPrimitiveOptions<P, TData>["players"];
    /** 名字颜色；可直接根据所属组计算。 */
    nameColor?: PlayerTextColor<P, TData>;
    /** 覆盖第一行名字文本。 */
    nameText?: PlayerTextFormatter<P, TData>;
    /** 覆盖第二行血量文本。 */
    healthText?: PlayerTextFormatter<P, TData>;
}

/**
 * 玩家信息预设：用一个 TextPrimitive 同时显示名字与血量。
 *
 * 当 players 是 PlayerGroup / PlayerGroupSet 时，所有 formatter 的第二个参数
 * 都会直接收到玩家所属组，业务层无需再次 findById()。
 */
export function playerInfoText<
    P extends GamePlayer = GamePlayer,
    TData = any
>(
    options: PlayerInfoTextOptions<P, TData>
): PlayerTextPrimitiveOptions<P, TData> {
    const { nameColor, nameText, healthText, ...rest } = options;
    return {
        offset: { x: 0, y: 2.5, z: 0 },
        scale: 1,
        depthTest: false,
        ...rest,
        text: (player, group) => {
            const name =
                nameText?.(player, group) ??
                formatName(player, nameColor, group);
            const health =
                healthText?.(player, group) ?? formatHealth(player);
            return `${name}§r\n${health}`;
        },
    };
}

/** 默认名字文本，可使用固定或动态颜色前缀。 */
export function formatName<
    P extends GamePlayer = GamePlayer,
    TData = any
>(
    player: P,
    color?: PlayerTextColor<P, TData>,
    group?: PlayerGroup<P, TData>
): string {
    const prefix =
        typeof color === "function" ? color(player, group) : color ?? "";
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
