import {
    EntityComponentTypes,
    ItemStack,
    Player,
    RawMessage,
    TitleDisplayOptions,
} from "@minecraft/server";

/**游戏玩家基类 */
export class GamePlayer {
    private readonly _player: Player;
    public readonly id: string;
    public readonly name: string;

    constructor(player: Player) {
        this._player = player;
        this.id = player.id;
        this.name = player.name;
    }

    get isValid(): Readonly<boolean> {
        return this._player.isValid;
    }

    /**获取player，当player下线时返回undefined */
    get player(): Player | undefined {
        if (this.isValid) {
            return this._player;
        }
    }

    /**发送消息 */
    sendMessage(mes: (RawMessage | string)[] | RawMessage | string) {
        if (!this._player.isValid) return;
        this._player.sendMessage(mes);
    }

    /**运行命令 */
    runCommand(cmd: string) {
        if (!this._player.isValid) return;
        return this._player.runCommand(cmd);
    }

    /**给物品 */
    giveItem(item: ItemStack) {
        if (!this._player.isValid) return;
        const container = this._player.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!container) return;
        container.addItem(item);
    }

    /**清除(使用命令)*/
    clear(itemId?: string) {
        this.runCommand("clear @s " + (itemId ?? ""));
    }

    /**展示title */
    title(
        title: string | RawMessage | (string | RawMessage)[],
        subtitle?: string | RawMessage | (string | RawMessage)[],
        options?: TitleDisplayOptions
    ) {
        if (!this._player.isValid) return;
        this._player.onScreenDisplay.setTitle(title, {
            subtitle: subtitle,
            fadeInDuration: 10,
            stayDuration: 70,
            fadeOutDuration: 20,
            ...options,
        });
    }

    /**设置actionbar文字 */
    actionbar(text: (RawMessage | string)[] | RawMessage | string) {
        if (!this._player.isValid) return;
        this._player.onScreenDisplay.setActionBar(text);
    }
}

export type ValidGamePlayer<T extends GamePlayer> = T & { player: Player };

export type GamePlayerConstructor<T extends GamePlayer = GamePlayer> = new (p: Player) => T;
