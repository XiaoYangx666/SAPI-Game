import { GameComponent } from "./gameComponent/gameComponent";
import { GameContext } from "./gameContext";
import { GameEngine } from "./gameEngine";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GameState } from "./gameState";
import { classConstructor } from "./utils/interfaces";

export function createGameModule<
    P extends GamePlayer = GamePlayer,
    C extends GameContext = GameContext
>(options: {
    playerClass?: classConstructor<P>;
    contextClass?: classConstructor<C>;
}) {
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
        S extends State = State
    > extends GameComponent<S, O> {}

    return {
        Engine,
        State,
        Component,
    } as const;
}
