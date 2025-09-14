import { GameContext } from "./gameContext";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GamePlayerManager } from "./gamePlayer/playerManager";
import { GameState, gameStateConstructor } from "./gameState";
import { Logger } from "./utils/logger";

export abstract class GameEngine<
    P extends GamePlayer = any,
    C extends GameContext = any
> {
    private readonly stateStack: GameState<P, C>[] = [];
    protected readonly logger: Logger;
    public readonly context: C;
    public readonly playerManager: GamePlayerManager<P>;

    /**玩家组构建器 */
    get groupBuilder() {
        return this.playerManager.groupBuilder;
    }

    constructor(context: C, playerManager: GamePlayerManager<P>) {
        this.playerManager = playerManager;
        this.context = context;
        this.logger = new Logger(this.constructor.name);
    }

    /**初始化 */
    abstract onInit(): void;

    /** 在栈顶添加一个新的子状态 */
    pushState(stateType: gameStateConstructor<P, C>) {
        this.logger.debug(`Pushing state: ${stateType.name}`);
        const stateInstance = new stateType(this);
        this.stateStack.push(stateInstance);
        stateInstance.onEnter();
    }

    /** 移除栈顶的状态，返回到父状态 */
    popState() {
        const currentState = this.stateStack.pop();
        if (currentState) {
            this.logger.debug(
                `Popping state: ${currentState.constructor.name}`
            );
            currentState.onExit();
        }
    }

    /** 清空所有状态，并设置一个新的根状态 */
    setState(stateType: gameStateConstructor<P, C>) {
        this.logger.debug(`Setting root state to: ${stateType.name}`);
        this.clearStack();
        this.pushState(stateType);
    }

    /** 从指定的状态实例开始替换状态分支。*/
    replaceFrom(
        stateToReplace: GameState<P, C>,
        newStateType: gameStateConstructor<P, C>
    ) {
        this.logger.debug(
            `Replacing from ${stateToReplace.constructor.name} with ${newStateType.name}`
        );

        const index = this.stateStack.indexOf(stateToReplace);
        if (index === -1) {
            this.logger.error(
                `无法找到要替换的状态实例:${stateToReplace.constructor.name}`
            );
            throw new Error("State to replace not found in stack.");
        }

        // 弹出并销毁从 stateToReplace 开始的所有状态
        const statesToPop = this.stateStack.length - index;
        for (let i = 0; i < statesToPop; i++) {
            this.popState();
        }

        // 在现在的位置上推入新状态
        this.pushState(newStateType);
    }

    private clearStack() {
        while (this.stateStack.length > 0) {
            this.popState();
        }
    }

    getChild(state: GameState<P, C>): GameState<P, C> | undefined {
        const index = this.stateStack.findIndex((s) => s === state);
        if (index != -1 && this.stateStack.length > index + 1) {
            return this.stateStack[index + 1];
        }
    }

    onDispose() {
        this.logger?.debug("dispose");
        this.clearStack();
    }
}
