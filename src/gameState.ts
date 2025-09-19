import {
    GameComponent,
    GameComponentType,
} from "./gameComponent/gameComponent";
import { GameContext } from "./gameContext";
import { GameEngine } from "./gameEngine";
import { EventManager } from "./gameEvent/eventManager";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GamePlayerManager } from "./gamePlayer/playerManager";
import { RunnerManager } from "./Runner/RunnerManager";
import { GameStateError } from "./utils/GameError";
import { Logger } from "./utils/logger";

export type gameStateConstructor<
    P extends GamePlayer = any,
    C extends GameContext = any
> = new (engine: GameEngine<P, C>) => GameState<P, C>;

/**游戏状态 */
export abstract class GameState<
    P extends GamePlayer = any,
    C extends GameContext = any,
    E extends GameEngine<P, C> = GameEngine<P, C>
> {
    protected logger: Logger = new Logger(this.constructor.name);
    private componets: Map<GameComponentType<any>, GameComponent<any>> =
        new Map();
    public eventManager = new EventManager();
    public runner = new RunnerManager();
    protected engine: E;

    constructor(engine: E) {
        this.engine = engine;
    }

    /**全局上下文 */
    get context(): C {
        return this.engine.context;
    }

    /**玩家管理器 */
    get playerManager(): GamePlayerManager<P> {
        return this.engine.playerManager;
    }

    /**获取子状态 */
    get childState() {
        return this.engine.getNextState(this);
    }

    /**进入 */
    abstract onEnter(): void;

    /**添加组件到当前状态
     * @throws GameStateError 若状态已存在
     */
    addComponent<C extends GameComponentType<any, any>>(
        component: C,
        options?: ConstructorParameters<C>[1]
    ) {
        this.logger.debug(`添加组件:${component.name}`);
        if (this.componets.has(component)) {
            throw new GameStateError(
                `组件 ${component.name} 已经存在于当前状态中`
            );
        }
        const componentInstance = new component(this, options);
        this.componets.set(component, componentInstance);
        componentInstance.onAttach();

        return this;
    }

    /**获取当前状态中的组件
     * @throws GameStateError 若状态不存在，则抛出
     */
    getComponent<C extends GameComponentType<any, any>>(
        type: C
    ): InstanceType<C> {
        const component = this.componets.get(type);
        if (!component) {
            throw new GameStateError(
                `获取失败:组件 ${type.name} 不存在于当前状态中`
            );
        }
        return component as InstanceType<C>;
    }

    /**删除当前状态中的组件*/
    deleteComponent(component: GameComponentType<any>) {
        this.logger.debug(`删除组件:${component.name}`);
        const instance = this.componets.get(component);
        if (!instance) return this;
        instance.onDetach();
        this.componets.delete(component);
        return this;
    }

    /**删除所有组件 */
    private deleteAllComponents() {
        this.logger.debug(`删除所有组件`);
        for (let [type, component] of this.componets.entries()) {
            component.onDetach();
            this.componets.delete(type);
        }
    }

    /** 进入一个新的子状态 */
    pushState(stateType: gameStateConstructor<P, C>) {
        this.engine.pushState(stateType);
    }

    /** 返回到父状态 */
    popState() {
        this.engine.popState();
    }

    /**将当前状态及其所有子状态，替换为一个新状态。*/
    transitionTo(stateType: gameStateConstructor<P, C>) {
        this.engine.replaceFrom(this, stateType);
    }

    onExit() {
        this.logger.debug(`onExit`);
        this.eventManager.dispose();
        this.deleteAllComponents();
        this.runner.dispose();
    }
}
