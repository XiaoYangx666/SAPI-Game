import { GameContext } from "./gameContext";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GamePlayerManager } from "./gamePlayer/playerManager";
import {
    ExtractConfig,
    GameState,
    gameStateConstructor,
} from "./gameState/gameState";
import { ParticipationManager } from "./participation/participationManager";
import { GameEngineError } from "./utils/GameError";
import { classConstructor } from "./utils/interfaces";
import { Logger } from "./utils/logger";

interface GameStateInternal {
    _onExit: () => void;
    onEnter: () => void;
}

/**
 * GameEngine 的创建者只需要提供游戏停止能力与共享的 participation 服务。
 * GameEngine 不再依赖全局 Game 单例。
 */
export interface GameEngineOwner {
    readonly participation: ParticipationManager;
    stopGameByKey(key: string): void;
}

export abstract class GameEngine<
    P extends GamePlayer = any,
    C extends GameContext = any,
    O = unknown
> {
    private readonly stateStack: GameState<P, C>[] = [];
    protected readonly logger: Logger;
    protected readonly owner: GameEngineOwner;
    public readonly context: C;
    public readonly playerManager: GamePlayerManager<P>;
    public readonly key: string;
    private _isActive = false;

    /**是否是常驻游戏（常驻游戏不会被game end结束) */
    get isDaemon() {
        return false;
    }

    get isActive() {
        return this._isActive;
    }

    /**玩家组构建器 */
    get groupBuilder() {
        return this.playerManager.groupBuilder;
    }

    constructor(
        playerClass: classConstructor<P>,
        owner: GameEngineOwner,
        key: string,
        config?: O
    ) {
        this.owner = owner;
        this.key = key;
        this.playerManager = new GamePlayerManager(
            playerClass,
            key,
            owner.participation,
            this.isDaemon
        );
        this.context = this.buildContext(config ?? ({} as O));
        this.logger = new Logger(this.constructor.name);
        this._isActive = true;
    }

    protected abstract buildContext(config: O): C;

    /**游戏开始 */
    protected abstract onStart(): void;

    /**游戏结束(dispose前调用) */
    protected abstract onStop(): void;

    /** 在栈顶添加一个新的子状态 */
    pushState<S extends gameStateConstructor<P, C, any>>(
        stateType: S,
        config?: ExtractConfig<S>
    ) {
        if (!this.isActive) return this;
        this.logger.debug(`Pushing state: ${stateType.name}`);
        const stateInstance = new stateType(this, config);
        this.stateStack.push(stateInstance);
        (stateInstance as any as GameStateInternal).onEnter();
        return this;
    }

    /** 移除栈顶的状态，返回到父状态 */
    popState() {
        const topState = this.stateStack.pop();
        if (topState) this.removeState(topState);
    }

    /** 清空所有状态，并设置一个新的根状态 */
    resetState<S extends gameStateConstructor<P, C, any>>(
        stateType: S,
        config?: ExtractConfig<S>
    ) {
        this.logger.debug(`Setting root state to: ${stateType.name}`);
        this.clearStateStack();
        this.pushState(stateType, config);
    }

    /** 从指定的状态实例开始替换状态分支。*/
    replaceFrom<S extends gameStateConstructor<P, C, any>>(
        stateToReplace: GameState<P, C>,
        newStateType: S,
        config?: ExtractConfig<S>
    ) {
        this.logger.debug(
            `Replacing from ${stateToReplace.constructor.name} with ${newStateType.name}`
        );

        const index = this.stateStack.indexOf(stateToReplace);
        if (index === -1) {
            this.logger.error(
                `无法找到要替换的状态实例:${stateToReplace.constructor.name}`
            );
            throw new GameEngineError("State to replace not found in stack.");
        }

        while (this.stateStack.length > index) {
            const removed = this.stateStack.pop()!;
            this.removeState(removed);
        }
        this.pushState(newStateType, config);
    }

    private clearStateStack() {
        while (this.stateStack.length > 0) this.popState();
    }

    private removeState(state: GameState<P, C>) {
        this.logger.debug(`Removing state: ${state.constructor.name}`);
        (state as any as GameStateInternal)._onExit();
    }

    getNextState(state: GameState<P, C>): GameState<P, C> | undefined {
        const index = this.stateStack.findIndex((s) => s === state);
        if (index != -1 && this.stateStack.length > index + 1) {
            return this.stateStack[index + 1];
        }
    }

    getLastState(state: GameState<P, C>): GameState<P, C> | undefined {
        const index = this.stateStack.findIndex((s) => s === state);
        if (index > 0) return this.stateStack[index - 1];
    }

    getState<T extends GameState<P, C, any>>(stateType: classConstructor<T>) {
        const state = this.stateStack.find((s) => s.constructor == stateType);
        if (state) return state as T;
    }

    deleteState(stateType: gameStateConstructor<P, C, any>) {
        const idx = this.stateStack.findIndex(
            (s) => s.constructor == stateType
        );
        if (idx != -1) {
            const [removed] = this.stateStack.splice(idx, 1);
            this.removeState(removed);
        }
    }

    stats(detail: boolean = false): string {
        let stateLine: string;
        const stateNames = this.stateStack.map((s) => s.constructor.name);
        const playersLine = `§ePlayers§r: §a${this.playerManager.validSize}§r / §7${this.playerManager.size}`;
        if (detail) {
            const stateStats = this.stateStack.map((s) => s.stats());
            stateLine =
                stateNames.length > 0
                    ? `§eStates§r(${stateNames.length}): \n    ${stateStats.join("\n    ")}`
                    : `§eStates§r: §7<empty>`;
        } else {
            stateLine =
                stateNames.length > 0
                    ? `§eStates§r(${stateNames.length}): §b${stateNames.join(
                          " §7| §b"
                      )}`
                    : `§eStates§r: §7<empty>`;
        }
        return ["", playersLine, stateLine].join("\n  ");
    }

    stopGame() {
        this.owner.stopGameByKey(this.key);
    }

    private onDispose() {
        this.logger?.debug("dispose");
        this.playerManager.dispose();
        this._isActive = false;
        this.clearStateStack();
    }
}

export interface GameEngineInternal {
    onDispose(): void;
    onStart(): void;
    onStop(): void;
}
