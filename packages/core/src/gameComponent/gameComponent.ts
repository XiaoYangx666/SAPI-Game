import { EventSubscription } from "../gameEvent/eventManager";
import { EventSignal } from "../gameEvent/eventSignal";
import { GameState } from "../gameState/gameState";
import { TraceScope } from "../trace/session";

type InferContext<S> = S extends GameState<any, infer C, any> ? C : never;

export abstract class GameComponent<
    S extends GameState<any, any>,
    O = unknown
> {
    private _isAttached = false;
    /**是否已经attach */
    get isAttached(): Readonly<boolean> {
        return this._isAttached;
    }
    protected readonly state: S;
    /**当前 Component 的结构化 Trace scope。*/
    public readonly trace: TraceScope;
    /**tag */
    readonly tag?: string;
    protected get context(): InferContext<S> {
        return this.state.context;
    }

    protected get runner() {
        return this.state.runner;
    }

    constructor(state: S, protected options?: O, tag?: string) {
        this.state = state;
        this.tag = tag;
        this.trace = state.createComponentTraceScope(
            this,
            this.constructor.name,
            tag
        );
    }

    private _onAttach() {
        if (this._isAttached) return;
        this._isAttached = true;
        try {
            this.onAttach();
        } catch (err) {
            try {
                this.state.eventManager.unsubscribeBySubscriber(this);
            } finally {
                this._isAttached = false;
            }
            throw err;
        }
    }

    protected abstract onAttach(): void;

    private _onDetach() {
        if (!this._isAttached) return;
        const errors: unknown[] = [];
        try {
            this.state.eventManager.unsubscribeBySubscriber(this);
        } catch (err) {
            errors.push(err);
        }
        try {
            this.onDetach();
        } catch (err) {
            errors.push(err);
        } finally {
            this._isAttached = false;
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, `组件 ${this.constructor.name} 卸载失败`);
        }
    }

    /**随便重写 */
    protected onDetach() {}

    /**订阅事件 */
    protected subscribe<T extends EventSignal<any>>(
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
        if (!this.isAttached) return;
        return this.state.eventManager.subscribe(this, event, ...args);
    }

    /**取消订阅 */
    protected unsubscribe(sub: EventSubscription) {
        this.state.eventManager.unsubscribe(sub);
    }
}

export type GameComponentType<S extends GameState<any, any>, O = any> = new (
    state: S,
    options?: O,
    tag?: string
) => GameComponent<S, O>;
