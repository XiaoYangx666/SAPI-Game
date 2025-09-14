import { gameEvents } from "./gameEvent/gameEvent";
import { GameManager } from "./gameManager";

export const Game = {
    events: new gameEvents(),
    manager: new GameManager(),
} as const;
