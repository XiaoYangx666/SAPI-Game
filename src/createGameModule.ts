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
        constructor(config?: O) {
            super(playerClass, config);
        }
    }

    abstract class State extends GameState<P, C> {}

    abstract class Component<
        S extends State = State,
        O = unknown
    > extends GameComponent<S, O> {}

    return {
        Engine,
        State,
        Component,
    } as const;
}
