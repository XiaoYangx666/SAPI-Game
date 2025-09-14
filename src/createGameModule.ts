import { GameComponent } from "./gameComponent/gameComponent";
import { GameContext } from "./gameContext";
import { GameEngine } from "./gameEngine";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GamePlayerManager } from "./gamePlayer/playerManager";
import { GameState } from "./gameState";
import { classConstructor } from "./utils/interfaces";

export function createGameModule<
    P extends GamePlayer = GamePlayer,
    C extends GameContext = GameContext
>(config: {
    playerClass?: classConstructor<P>;
    contextClass?: classConstructor<C>;
}) {
    abstract class Engine extends GameEngine<P, C> {
        constructor(context?: C) {
            const playerManager = new GamePlayerManager(
                config.playerClass ?? (GamePlayer as classConstructor<P>)
            );
            super(
                context ??
                    new (config.contextClass ??
                        (GameContext as classConstructor<C>))(),
                playerManager
            );
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
    };
}
