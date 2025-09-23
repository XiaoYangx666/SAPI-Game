import { Player, world } from "@minecraft/server";

/**游戏玩家基类 */
export class GamePlayer {
    readonly id: string;

    get isValid(): Readonly<boolean> {
        return this.player.isValid;
    }

    get sendMessage() {
        return this.player.sendMessage;
    }

    get runCommand() {
        return this.player.runCommand;
    }

    constructor(public readonly player: Player) {
        this.id = player.id;
    }
}

export type GamePlayerConstructor<T extends GamePlayer = GamePlayer> = new (p: Player) => T;
