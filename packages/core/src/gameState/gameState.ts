import {
    GameComponent,
    GameComponentType,
} from "../gameComponent/gameComponent";
import { GameContext } from "../gameContext";
import { GameEngine } from "../gameEngine";
import { EventManager } from "../gameEvent/eventManager";
import { EventSignal } from "../gameEvent/eventSignal";
import { GamePlayer } from "../gamePlayer/gamePlayer";
import { GamePlayerManager } from "../gamePlayer/playerManager";
import { RunnerManager } from "../Runner/RunnerManager";
import {
    BuiltinTraceEventType,
    traceError,
    TraceScope,
} from "@begame/trace-core";
import { Logger } from "../utils/logger";
import {
    ComponentDeleteFailedError,
    ComponentLoadFailedError,
    GameComponentAlreadyExistsError,
    GameComponentNotExistsError,
} from "./types";

export type ExtractConfig<S> = S extends gameStateConstructor<any, any, infer T>
    ? T
    : never;

/**
 * State 构造器在运行时总是接收创建它的具体 Engine 实例。
 *
 * 这里不把构造器参数锁死为 `GameEngine<P, C>`，否则一个 State 将 engine
 * 精确收窄为具体游戏 Engine（例如 DoudizhuGame）后，会因为构造器参数的
 * 逆变规则而无法传给 pushState/resetState。返回值仍约束为同一 P/C 的
 * GameState，因此不会放松 State 本身的类型边界。
 */
export type gameStateConstructor<
    P extends GamePlayer = any,
    C extends GameContext = any,
    TConfig = unknown
> = new (engine: any, config?: TConfig) => GameState<P, C, TConfig, any>;

interface GameComponentInternal {
    isAttached: boolean;
    _onAttach: () => void;
    _onDetach: () => void;
    tag?: string;
}

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
        GameComponent<any>[]
    > = new Map();
    public readonly eventManager = new EventManager();
    public readonly runner: RunnerManager;
    /**当前 State 的结构化 Trace scope。*/
    public readonly trace: TraceScope;
    public readonly config?: TConfig;

    constructor(engine: E, config?: TConfig) {
        this.engine = engine;
        this.config = config;
        this.trace = engine.createStateTraceScope(this, this.constructor.name);
        this.runner = new RunnerManager(
            this.constructor.name,
            engine.createNamedTraceScope(
                "runner",
                this.constructor.name,
                this.trace.source.ref
            )
        );
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

    /**停止当前游戏实例。主要供长期 State/Component 生命周期策略调用。*/
    stopGame(reason?: string) {
        this.engine.stopGame(reason);
    }

    /**获取子状态 */
    get nextState() {
        return this.engine.getNextState(this);
    }

    get lastState() {
        return this.engine.getLastState(this);
    }

    /** @internal GameComponent constructor obtains its stable component ref here. */
    createComponentTraceScope(component: object, name: string, tag?: string) {
        return this.engine.createComponentTraceScope(
            component,
            this,
            name,
            tag
        );
    }

    /** @internal Common components can create a named timer scope. */
    createNamedTraceScope(kind: "runner" | "timer" | "system", name: string) {
        return this.engine.createNamedTraceScope(kind, name, this.trace.source.ref);
    }

    /**进入 */
    protected abstract onEnter(): void;

    /**由 GameEngine 调用，统一 State 进入生命周期。*/
    private _onEnter() {
        this.onEnter();
    }

    /**进入失败时只清理已创建资源，不调用用户 onExit。*/
    private _onEnterFailed() {
        this.cleanup(false);
    }

    /**
     * 添加组件到当前状态。
     * 只有 onAttach 完整成功后才会写入组件表；失败组件不会残留。
     */
    addComponent<Cmp extends GameComponentType<any, any>>(
        component: Cmp,
        options?: ConstructorParameters<Cmp>[1],
        tag?: string
    ) {
        if (!this.engine.isActive) return this;
        this.logger.debug(
            `添加组件:${component.name}` +
                (tag != undefined ? `(tag=${tag})` : "")
        );

        const list = this.components.get(component) ?? [];
        if (list.some((c) => c.tag === tag)) {
            throw new GameComponentAlreadyExistsError(component, tag);
        }

        const componentInstance = new component(this, options, tag);
        componentInstance.trace.builtin(
            BuiltinTraceEventType.ComponentAttachStarted,
            { component: component.name, ...(tag === undefined ? {} : { tag }) }
        );
        try {
            (componentInstance as any as GameComponentInternal)._onAttach();
            componentInstance.trace.builtin(BuiltinTraceEventType.ComponentAttached, {
                component: component.name,
                ...(tag === undefined ? {} : { tag }),
            });
        } catch (err) {
            componentInstance.trace.builtin(
                BuiltinTraceEventType.ComponentAttachFailed,
                {
                    component: component.name,
                    ...(tag === undefined ? {} : { tag }),
                    error: traceError(err),
                }
            );
            throw new ComponentLoadFailedError(component, tag, { cause: err });
        }

        list.push(componentInstance);
        this.components.set(component, list);
        return this;
    }

    /**添加多个components(不能带参数和tag) */
    addComponents(components: GameComponentType<any>[]) {
        for (const comp of components) {
            this.addComponent(comp);
        }
    }

    /**
     * 获取当前状态中的组件
     * @throws {GameComponentNotExistsError} 若组件不存在，则抛出
     */
    getComponent<Cmp extends GameComponentType<any, any>>(
        type: Cmp,
        tag?: string
    ): InstanceType<Cmp> {
        const list = this.components.get(type);
        const component = list?.find((c) => c.tag === tag);
        if (!component) {
            throw new GameComponentNotExistsError(type, tag);
        }
        return component as InstanceType<Cmp>;
    }

    /**删除当前状态中的组件。无论 onDetach 是否报错，组件都会从状态中移除。*/
    deleteComponent(component: GameComponentType<any>, tag?: string) {
        this.logger.debug(`删除组件:${component.name}`);
        const list = this.components.get(component);
        if (!list) return this;
        const index = list.findIndex((c) => c.tag === tag);
        if (index === -1) return this;

        const componentInstance = list[index];
        const comp = componentInstance as unknown as GameComponentInternal;
        list.splice(index, 1);
        if (list.length === 0) this.components.delete(component);

        try {
            comp._onDetach();
            componentInstance.trace.builtin(BuiltinTraceEventType.ComponentDetached, {
                component: component.name,
                ...(tag === undefined ? {} : { tag }),
                success: true,
            });
        } catch (err) {
            componentInstance.trace.builtin(BuiltinTraceEventType.ComponentError, {
                phase: "detach",
                error: traceError(err),
            });
            componentInstance.trace.builtin(BuiltinTraceEventType.ComponentDetached, {
                component: component.name,
                ...(tag === undefined ? {} : { tag }),
                success: false,
            });
            throw new ComponentDeleteFailedError(component, comp.tag, {
                cause: err,
            });
        }
        return this;
    }

    /**删除所有组件；单个组件失败不会阻止其他组件继续清理。*/
    private deleteAllComponents() {
        this.logger.debug(`删除所有组件`);
        const entries = [...this.components.entries()];
        this.components.clear();

        const errors: unknown[] = [];
        for (const [compType, list] of entries) {
            for (const comp of list) {
                const instance = comp as any as GameComponentInternal;
                try {
                    instance._onDetach();
                    comp.trace.builtin(BuiltinTraceEventType.ComponentDetached, {
                        component: compType.name,
                        ...(instance.tag === undefined ? {} : { tag: instance.tag }),
                        success: true,
                    });
                } catch (err) {
                    comp.trace.builtin(BuiltinTraceEventType.ComponentError, {
                        phase: "detach",
                        error: traceError(err),
                    });
                    comp.trace.builtin(BuiltinTraceEventType.ComponentDetached, {
                        component: compType.name,
                        ...(instance.tag === undefined ? {} : { tag: instance.tag }),
                        success: false,
                    });
                    errors.push(
                        new ComponentDeleteFailedError(
                            compType,
                            instance.tag,
                            { cause: err }
                        )
                    );
                }
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "状态组件清理失败");
        }
    }

    protected subscribe<T extends EventSignal<any>>(
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
        return this.eventManager.subscribe(this, event, ...args);
    }

    /** 进入一个新的子状态 */
    protected pushState<S extends gameStateConstructor<P, C, any>>(
        stateType: S,
        config?: ExtractConfig<S>
    ) {
        this.engine.pushState(stateType, config);
    }

    /** 返回到父状态 */
    protected popState() {
        this.engine.popState();
    }

    /**将当前状态及其所有子状态，替换为一个新状态。*/
    protected transitionTo<T>(
        stateType: gameStateConstructor<P, C, T>,
        config?: T
    ) {
        this.engine.replaceFrom(this, stateType, config);
    }

    private _onExit() {
        this.logger.debug(`onExit`);
        this.cleanup(true);
    }

    private cleanup(callOnExit: boolean) {
        const errors: unknown[] = [];

        if (callOnExit) {
            try {
                this.onExit();
            } catch (err) {
                errors.push(err);
            }
        }

        try {
            this.deleteAllComponents();
        } catch (err) {
            errors.push(err);
        }
        try {
            this.eventManager.dispose();
        } catch (err) {
            this.trace.debug("event manager cleanup failed", {
                error: traceError(err),
            });
            errors.push(err);
        }
        try {
            this.runner.dispose();
        } catch (err) {
            errors.push(err);
        }

        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                `State ${this.constructor.name} 清理失败`
            );
        }
    }

    protected onExit() {}

    /**返回基本信息 */
    stats() {
        const stateName = this.constructor.name;
        const componentNames = [...this.components.values()]
            .map((l) =>
                l.map(
                    (c) =>
                        c.constructor.name +
                        (c.tag != undefined ? `(tag=${c.tag})` : "")
                )
            )
            .flat();

        return `§b${stateName}§r(${componentNames.length}): §i${
            componentNames.length ? componentNames.join(",") : "<none>"
        }`;
    }
}
