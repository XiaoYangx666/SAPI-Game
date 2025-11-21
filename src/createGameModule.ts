import { GameComponent } from "./gameComponent/gameComponent";
import { GameContext } from "./gameContext";
import { GameEngine } from "./gameEngine";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GameState } from "./gameState/gameState";
import { classConstructor } from "./utils/interfaces";

export interface GameModule<P extends GamePlayer, C extends GameContext> {
    Engine: abstract new <O = unknown>(key: string, config?: O) => GameEngine<
        P,
        C,
        O
    >;
    State: abstract new <
        TConfig = unknown,
        E extends GameEngine<P, C> = GameEngine<P, C, unknown>
    >(
        engine: E,
        config?: TConfig
    ) => GameState<P, C, TConfig, E>;
    Component: abstract new <
        O = unknown,
        S extends GameState<P, C, any> = GameState<P, C, unknown>
    >(
        state: S,
        options?: O,
        tag?: string
    ) => GameComponent<S, O>;
}

export function createGameModule<
    P extends GamePlayer = GamePlayer,
    C extends GameContext = GameContext
>(options: {
    playerClass?: classConstructor<P>;
    contextClass?: classConstructor<C>;
}): GameModule<P, C> {
    const playerClass =
        options.playerClass ?? (GamePlayer as classConstructor<P>);
    abstract class Engine<O = unknown> extends GameEngine<P, C, O> {
        constructor(key: string, config?: O) {
            super(playerClass, key, config);
        }
    }

    abstract class State<Tconfig = unknown> extends GameState<P, C, Tconfig> {}

    abstract class Component<
        O = unknown,
        S extends GameState<P, C, any> = GameState<P, C, unknown>
    > extends GameComponent<S, O> {}

    return {
        Engine,
        State,
        Component,
    } as const as any as GameModule<P, C>;
}
