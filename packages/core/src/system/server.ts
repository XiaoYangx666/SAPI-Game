import { Player, world } from "@minecraft/server";

/**
 * BEGame 对 Minecraft 服务器级玩家查询的统一入口。
 *
 * ScriptAPI 的类型声明认为 getAllPlayers() 只返回 Player，但部分服务器环境
 * （例如存在假人时）可能混入 undefined，因此在这里统一清洗。
 */
export const gameServer = {
    getAllPlayers(): Player[] {
        return world
            .getAllPlayers()
            .filter((player): player is Player => player !== undefined);
    },
    /** Live server lookup: never keep a second online-player snapshot. */
    getPlayer(playerId: string): Player | undefined {
        return this.getAllPlayers().find((player) => player.id === playerId);
    },
    isOnline(playerId: string): boolean {
        return this.getPlayer(playerId) !== undefined;
    },
} as const;
