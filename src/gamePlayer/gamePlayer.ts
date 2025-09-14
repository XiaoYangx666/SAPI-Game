import { Player, world } from "@minecraft/server";

/**游戏玩家基类 */
export class GamePlayer {
    readonly id: string;

    constructor(public readonly player: Player) {
        this.id = player.id;
    }
}

export type GamePlayerConstructor<T extends GamePlayer = GamePlayer> = new (
    p: Player
) => T;
