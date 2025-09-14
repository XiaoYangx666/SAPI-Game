import { EventSignal } from "../gameEvent/eventSignal";
import { GameState } from "../gameState";

export abstract class GameComponent<
    S extends GameState<any, any>,
    O = unknown
> {
    constructor(protected state: S, protected options?: O) {}

    abstract onAttach(): void;

    onDetach() {
        this.state.eventManager.unsubscribeBySubscriber(this.constructor);
    }

    /**订阅事件 */
    subscribe<T extends EventSignal<any>>(
        event: T,
        ...args: Parameters<T["subscribe"]>
    ) {
        this.state.eventManager.subscribe(this.constructor, event, ...args);
    }
}

export type GameComponentType<S extends GameState<any, any>, O = any> = new (
    state: S,
    options?: O
) => GameComponent<S, O>;
