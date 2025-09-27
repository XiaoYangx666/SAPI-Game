import { EventSubscription } from "@sapi-game/gameEvent/eventManager";
import { EventSignal } from "../gameEvent/eventSignal";
import { GameState } from "../gameState";

type InferContext<S> = S extends GameState<any, infer C, any> ? C : never;

export abstract class GameComponent<S extends GameState<any, any>, O = unknown> {
    protected get context(): InferContext<S> {
        return this.state.context;
    }

    protected get runner() {
        return this.state.runner;
    }

    constructor(protected state: S, protected options?: O) {}

    abstract onAttach(): void;

    onDetach() {}

    /**订阅事件 */
    subscribe<T extends EventSignal<any>>(event: T, ...args: Parameters<T["subscribe"]>) {
        return this.state.eventManager.subscribe(this.constructor, event, ...args);
    }

    /**取消订阅 */
    unsubscribe(sub: EventSubscription) {
        this.state.eventManager.unsubscribe(sub);
    }
}

export type GameComponentType<S extends GameState<any, any>, O = any> = new (
    state: S,
    options?: O
) => GameComponent<S, O>;
