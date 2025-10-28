import { Vector3, world } from "@minecraft/server";
import { Game, GameState } from "@sapi-game/main";
import { Duration, Logger } from "@sapi-game/utils";
import { DimensionIds } from "@sapi-game/utils/vanila-data";
import { GameComponent, GameComponentType } from "../gameComponent";

export interface LazyLoadOptions {
    /** 要检测的维度 */
    dimensionId: DimensionIds;
    /** 用于检测是否加载的方块坐标 */
    pos: Vector3;
    /** 加载时的回调（区块首次加载时触发） */
    onLoad: (loader: LazyLoader) => void;
    /** 卸载时的回调（区块卸载时触发） */
    onUnload?: () => void;
    /** 检测间隔，默认 20 tick */
    interval?: Duration;
}

/**用于懒加载区块 */
export class LazyLoader extends GameComponent<
    GameState<any, any>,
    LazyLoadOptions
> {
    private active = false;
    private logger = new Logger(this.constructor.name);
    private components: GameComponentType<any>[] = [];

    get isActive() {
        return this.active;
    }

    override onAttach(): void {
        this.subscribe(
            Game.events.interval,
            () => {
                if (!this.options) return;
                const {
                    dimensionId: dimension,
                    pos,
                    onLoad,
                    onUnload,
                } = this.options;
                const block = world.getDimension(dimension).getBlock(pos);
                if (block) {
                    if (!this.active) {
                        this.logger.log("load");
                        try {
                            onLoad(this);
                        } catch (err) {
                            this.logger.error("onLoad error:", err);
                        }
                        this.active = true;
                    }
                } else {
                    if (this.active) {
                        this.logger.log("unload");
                        this.clearComponents();
                        try {
                            onUnload?.();
                        } catch (e) {
                            this.logger.error("onUnload error", e);
                        }
                        this.active = false;
                    }
                }
            },
            this.options!.interval ?? new Duration(20)
        );
    }

    private clearComponents() {
        //先取消所有订阅
        this.components.forEach((c) => {
            this.state.eventManager.unsubscribeBySubscriber(c);
        });
        //再删除所有组件
        this.components.forEach((c) => this.state.deleteComponent(c));
        this.components = [];
    }

    reload() {
        if (!this.options) return;
        const { onLoad, onUnload } = this.options;
        if (this.active) {
            onUnload?.();
            this.clearComponents();
            this.active = false;
        }
        onLoad(this);
        this.active = true;
    }

    addComponent<C extends GameComponentType<any, any>>(
        component: C,
        options?: ConstructorParameters<C>[1]
    ) {
        this.state.addComponent(component, options);
        this.components.push(component);
        return this;
    }
}
