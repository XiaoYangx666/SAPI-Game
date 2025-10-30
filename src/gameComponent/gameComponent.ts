import { EventSubscription } from "@sapi-game/gameEvent/eventManager";
import { EventSignal } from "../gameEvent/eventSignal";
import { GameState } from "../gameState/gameState";

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
    }

    private _onAttach() {
        this.onAttach();
        this._isAttached = true;
    }

    protected abstract onAttach(): void;

    private _onDetach() {
        this.state.eventManager.unsubscribeBySubscriber(this);
        this.onDetach();
        this._isAttached = false;
    }

    /**随便重写 */
    protected onDetach() {}

    /**订阅事件 */
    protected subscribe<T extends EventSignal<any>>(
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
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
