import {
    GameComponent,
    GameComponentType,
} from "./gameComponent/gameComponent";
import { GameContext } from "./gameContext";
import { GameEngine } from "./gameEngine";
import { EventManager } from "./gameEvent/eventManager";
import { EventSignal } from "./gameEvent/eventSignal";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GamePlayerManager } from "./gamePlayer/playerManager";
import { RunnerManager } from "./Runner/RunnerManager";
import { GameStateError } from "./utils/GameError";
import { Logger } from "./utils/logger";

export type ExtractConfig<S> = S extends gameStateConstructor<any, any, infer T>
    ? T
    : never;

export type gameStateConstructor<
    P extends GamePlayer = any,
    C extends GameContext = any,
    TConfig = unknown
> = new (engine: GameEngine<P, C, any>, config?: TConfig) => GameState<
    P,
    C,
    TConfig
>;

/**游戏状态 */
export abstract class GameState<
    P extends GamePlayer = any,
    C extends GameContext = any,
    TConfig = unknown,
    E extends GameEngine<P, C> = GameEngine<P, C>
> {
    protected readonly logger: Logger = new Logger(this.constructor.name);
    protected readonly engine: E;
    private readonly components: Map<
        GameComponentType<any>,
        GameComponent<any>
    > = new Map();
    public readonly eventManager = new EventManager();
    public readonly runner = new RunnerManager(this.constructor.name);
    public readonly config?: TConfig;

    constructor(engine: E, config?: TConfig) {
        this.engine = engine;
        this.config = config;
    }

    /**全局上下文 */
    get context(): C {
        return this.engine.context;
    }

    /**玩家管理器 */
    get playerManager(): GamePlayerManager<P> {
        return this.engine.playerManager;
    }

    get gameKey() {
        return this.engine.key;
    }

    /**获取子状态 */
    get nextState() {
        return this.engine.getNextState(this);
    }

    get lastState() {
        return this.engine.getLastState(this);
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
        if (!this.engine.isActive) return this;
        this.logger.debug(`添加组件:${component.name}`);
        if (this.components.has(component)) {
            this.logger.error(`组件 ${component.name} 已经存在于当前状态中`);
            return this;
        }

        const componentInstance = new component(this, options);
        this.components.set(component, componentInstance);
        try {
            componentInstance.onAttach();
        } catch (err) {
            this.logger.error(`组件 ${component.name} 加载失败`, err);
        }

        return this;
    }

    /**添加多个components(不能带参数) */
    addComponents(components: GameComponentType<any>[]) {
        for (const comp of components) {
            this.addComponent(comp);
        }
    }

    /**获取当前状态中的组件
     * @throws GameStateError 若组件不存在，则抛出
     */
    getComponent<C extends GameComponentType<any, any>>(
        type: C
    ): InstanceType<C> {
        const component = this.components.get(type);
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
        const instance = this.components.get(component);
        if (!instance) return this;
        try {
            //取消订阅
            this.eventManager.unsubscribeBySubscriber(component);
            instance.onDetach();
            this.components.delete(component);
        } catch (err) {
            this.logger.error(`组件:${component.name}删除失败`, err);
        }
        return this;
    }

    /**删除所有组件 */
    private deleteAllComponents() {
        this.logger.debug(`删除所有组件`);
        for (let [compType, component] of this.components.entries()) {
            try {
                this.eventManager.unsubscribeBySubscriber(compType);
                component.onDetach();
                this.components.delete(compType);
            } catch (err) {
                this.logger.error(`组件:${compType.name}删除失败`, err);
            }
        }
    }

    subscribe<T extends EventSignal<any>>(
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
        this.eventManager.subscribe(this, event, ...args);
    }

    /** 进入一个新的子状态 */
    pushState<S extends gameStateConstructor<P, C, any>>(
        stateType: S,
        config?: ExtractConfig<S>
    ) {
        this.engine.pushState(stateType, config);
    }

    /** 返回到父状态 */
    popState() {
        this.engine.popState();
    }

    /**将当前状态及其所有子状态，替换为一个新状态。*/
    transitionTo<T>(stateType: gameStateConstructor<P, C, T>, config?: T) {
        this.engine.replaceFrom(this, stateType, config);
    }

    /**系统调用，不要重写！ */
    _onExit() {
        this.logger.debug(`onExit`);
        this.onExit();
        this.eventManager.dispose();
        this.deleteAllComponents();
        this.runner.dispose();
    }

    onExit() {}

    debug() {
        const stateName = this.constructor.name;
        const componentNames = [...this.components.values()].map(
            (c) => c.constructor.name
        );

        this.logger.log(
            [
                "=== State Debug ===",
                `State: ${stateName}`,
                `Components(${componentNames.length}): ${
                    componentNames.length ? componentNames.join(", ") : "<none>"
                }`,
            ].join("\n  ")
        );
    }

    /**返回基本信息 */
    stats() {
        const stateName = this.constructor.name;
        const componentNames = [...this.components.values()].map(
            (c) => c.constructor.name
        );

        return `§b${stateName}§r(${componentNames.length}): §i${
            componentNames.length ? componentNames.join(",") : "<none>"
        }`;
    }
}
