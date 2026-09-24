import {
    Player,
    RawMessage,
    RGBA,
    TextPrimitive,
    Vector3,
    system,
    world,
} from "@minecraft/server";
import { GamePlayer } from "../../gamePlayer/gamePlayer";
import { PlayerSource, resolvePlayers } from "../../gamePlayer/playerSource";
import { GameState } from "../../gameState/gameState";
import { Game } from "../../main";
import { Duration } from "../../utils/duration";
import { GameComponent } from "../gameComponent";

/** textPrimitive 的可见范围。 */
export type PlayerTextVisibility = "all" | "self" | "others";

export interface PlayerTextPrimitiveOptions<P extends GamePlayer = GamePlayer> {
    /** 要挂载文本的玩家来源。 */
    players: PlayerSource<P>;
    /** 计算每个玩家当前要显示的文本，每次刷新都会重新调用。 */
    text: (player: P) => string | RawMessage;
    /** 相对玩家位置的偏移。挂载到实体后该坐标作为偏移量使用。默认头顶上方。 */
    offset?: Vector3;
    /** 缩放，默认 1。 */
    scale?: number;
    /** 旋转 [pitch, yaw, roll]，默认不旋转。 */
    rotation?: Vector3;
    /** 是否被方块/实体遮挡，默认 false（始终渲染）。 */
    depthTest?: boolean;
    /** 背景板颜色，不设置则使用默认颜色。 */
    backgroundColor?: RGBA;
    /** 最大渲染距离，不设置则跟随客户端渲染距离。 */
    maximumRenderDistance?: number;
    /** 可见范围，默认 all。 */
    visibleTo?: PlayerTextVisibility;
    /** 刷新间隔，默认 10 tick。 */
    refreshInterval?: Duration;
}

const DEFAULT_OFFSET: Vector3 = { x: 0, y: 2.4, z: 0 };
const DEFAULT_REFRESH = new Duration(10);

/**
 * 通用玩家文本组件：给一批玩家各挂一个 {@link TextPrimitive}，并周期性刷新文本。
 *
 * 血量、名字、状态等展示都可以直接复用本组件；`playerTextPresets.ts` 里提供了
 * 血量 / 名字等预设配置。组件卸载时会移除全部 primitive，不残留。
 */
export class PlayerTextPrimitive<
    P extends GamePlayer = GamePlayer
> extends GameComponent<GameState, PlayerTextPrimitiveOptions<P>> {
    private readonly primitives = new Map<string, TextPrimitive>();
    private visible = true;

    override onAttach(): void {
        if (!this.options) return;
        // 创建 primitive 属于世界修改，放到主线程执行。
        system.run(() => this.refresh());
        this.subscribe(
            Game.events.interval,
            () => this.refresh(),
            this.options.refreshInterval ?? DEFAULT_REFRESH
        );
    }

    override onDetach(): void {
        this.clearPrimitives();
    }

    /** 当前是否正在显示。 */
    get isVisible(): Readonly<boolean> {
        return this.visible;
    }

    /** 显示（若已被 hide 则重新创建）。 */
    show() {
        this.visible = true;
        system.run(() => this.refresh());
    }

    /** 隐藏并移除全部文本，但保留组件本身。 */
    hide() {
        this.visible = false;
        this.clearPrimitives();
    }

    /** 立即同步一次文本 primitive（新增、更新、清理）。 */
    refresh() {
        const options = this.options;
        if (!options) return;
        if (!this.visible || !this.isAttached) {
            this.clearPrimitives();
            return;
        }

        const aliveIds = new Set<string>();
        for (const p of resolvePlayers(options.players)) {
            const player = p.player;
            if (!player) continue;
            aliveIds.add(player.id);

            const primitive = this.ensurePrimitive(player, options);
            if (!primitive) continue;
            try {
                primitive.setText(options.text(p));
                this.applyVisibility(primitive, player);
            } catch {
                // 玩家可能刚好在这一 tick 失效，下一轮会重新同步。
            }
        }

        // 清理已经离开作用范围的玩家，避免残留。
        for (const [id, primitive] of [...this.primitives]) {
            if (aliveIds.has(id)) continue;
            this.removePrimitive(id, primitive);
        }
    }

    private ensurePrimitive(
        player: Player,
        options: PlayerTextPrimitiveOptions<P>
    ): TextPrimitive | undefined {
        const existing = this.primitives.get(player.id);
        if (existing) return existing;

        const primitive = new TextPrimitive(
            options.offset ?? DEFAULT_OFFSET,
            ""
        );
        primitive.attachedTo = player;
        primitive.scale = options.scale ?? 1;
        primitive.rotation = options.rotation ?? { x: 0, y: 0, z: 0 };
        primitive.depthTest = options.depthTest ?? false;
        if (options.backgroundColor !== undefined) {
            primitive.backgroundColorOverride = options.backgroundColor;
        }
        if (options.maximumRenderDistance !== undefined) {
            primitive.maximumRenderDistance = options.maximumRenderDistance;
        }

        try {
            world.primitiveShapesManager.addText(primitive, player.dimension);
        } catch {
            return undefined;
        }
        this.primitives.set(player.id, primitive);
        return primitive;
    }

    private applyVisibility(primitive: TextPrimitive, player: Player) {
        switch (this.options?.visibleTo ?? "all") {
            case "self":
                primitive.visibleTo = [player];
                break;
            case "others":
                primitive.visibleTo = world
                    .getAllPlayers()
                    .filter((p) => p.id !== player.id);
                break;
            default:
                primitive.visibleTo = [];
                break;
        }
    }

    private clearPrimitives() {
        for (const [id, primitive] of [...this.primitives]) {
            this.removePrimitive(id, primitive);
        }
    }

    private removePrimitive(id: string, primitive: TextPrimitive) {
        try {
            primitive.remove();
        } catch {
            // 已经失效的 primitive 无需再处理。
        }
        this.primitives.delete(id);
    }
}
