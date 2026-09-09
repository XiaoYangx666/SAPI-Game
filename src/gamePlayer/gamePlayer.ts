import {
    EffectType,
    EntityComponentTypes,
    ItemStack,
    Player,
    RawMessage,
    TitleDisplayOptions,
} from "@minecraft/server";

/**游戏玩家基类 */
export class GamePlayer {
    private readonly _player: Player;
    private _isActive = true;
    public readonly id: string;
    public readonly name: string;

    constructor(player: Player) {
        this._player = player;
        this.id = player.id;
        this.name = player.name;
    }

    /**当前 Minecraft 玩家是否在线/有效。*/
    get isOnline(): Readonly<boolean> {
        return this._player.isValid;
    }

    /**该 GamePlayer 是否仍属于当前游戏生命周期。*/
    get isActive(): Readonly<boolean> {
        return this._isActive;
    }

    /**当前是否可以安全执行玩家操作。*/
    get isValid(): Readonly<boolean> {
        return this.isOnline && this.isActive;
    }

    /**
     * SAPIGame 内部生命周期入口。
     * 游戏代码通常不应直接调用；membership 由 GamePlayerManager / Participation 管理。
     */
    _setActive(active: boolean) {
        this._isActive = active;
    }

    /**获取player
     * 若玩家下线或已退出游戏返回undefined
     */
    get player(): Player | undefined {
        if (this.isValid) {
            return this._player;
        }
    }

    /**发送消息 */
    sendMessage(mes: (RawMessage | string)[] | RawMessage | string) {
        if (!this.isValid) return;
        this._player.sendMessage(mes);
    }

    /**运行命令 */
    runCommand(cmd: string) {
        if (!this.isValid) return;
        return this._player.runCommand(cmd);
    }

    /**给物品 */
    giveItem(item: ItemStack) {
        if (!this.isValid) return;
        const container = this._player.getComponent(
            EntityComponentTypes.Inventory
        )?.container;
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
        if (!this.isValid) return;
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
        if (!this.isValid) return;
        this._player.onScreenDisplay.setActionBar(text);
    }

    /**
     * 为玩家添加效果
     * @param showParticles 是否显示粒子，默认为false
     */
    addEffect(
        effectType: string | EffectType,
        duration: number,
        amplifier?: number,
        showParticles?: boolean
    ) {
        if (!this.isValid) return;
        this._player.addEffect(effectType, duration, {
            amplifier: amplifier ?? 1,
            showParticles: showParticles ?? false,
        });
    }
}

export type ValidGamePlayer<T extends GamePlayer> = T & { player: Player };

export type GamePlayerConstructor<T extends GamePlayer = GamePlayer> = new (
    p: Player
) => T;
