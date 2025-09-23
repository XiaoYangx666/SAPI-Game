import { Vector3, world } from "@minecraft/server";
import { Game, GameState } from "@sapi-game/main";
import { Duration, Logger } from "@sapi-game/utils";
import { DimensionIds } from "@sapi-game/utils/vanila-data";
import { GameComponent } from "../gameComponent";

interface LazyLoadOptions {
    /** 要检测的维度 */
    dimension: DimensionIds;
    /** 用于检测是否加载的方块坐标 */
    pos: Vector3;
    /** 加载时的回调（区块首次加载时触发） */
    onLoad: () => void;
    /** 卸载时的回调（区块卸载时触发） */
    onUnload: () => void;
    /** 检测间隔，默认 20 tick */
    interval?: Duration;
}

/**用于懒加载区块 */
export class lazyLoader extends GameComponent<GameState<any, any>, LazyLoadOptions> {
    private active = false;
    private logger = new Logger(this.constructor.name);

    get isActive() {
        return this.active;
    }

    override onAttach(): void {
        this.subscribe(
            Game.events.interval,
            () => {
                if (!this.options) return;
                const { dimension, pos, onLoad, onUnload } = this.options;
                const block = world.getDimension(dimension).getBlock(pos);
                if (block) {
                    if (!this.active) {
                        this.logger.log("load");
                        onLoad();
                        this.active = true;
                    }
                } else {
                    if (this.active) {
                        this.logger.log("unload");
                        onUnload?.();
                        this.active = false;
                    }
                }
            },
            this.options!.interval ?? new Duration(20)
        );
    }

    reload() {
        if (!this.options) return;
        const { dimension, pos, onLoad, onUnload } = this.options;
        if (this.active) {
            onUnload();
        }
        onLoad();
        this.active = true;
    }
}
