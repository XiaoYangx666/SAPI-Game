import { GameContext } from "./gameContext";
import { GamePlayer } from "./gamePlayer/gamePlayer";
import { GamePlayerManager } from "./gamePlayer/playerManager";
import {
    ExtractConfig,
    GameState,
    gameStateConstructor,
} from "./gameState/gameState";
import {
    GameParticipation,
    ParticipationManager,
} from "./participation/participationManager";
import { GameEngineError } from "./utils/GameError";
import { classConstructor } from "./utils/interfaces";
import { Logger } from "./utils/logger";

interface GameStateInternal {
    _onEnter: () => void;
    _onEnterFailed: () => void;
    _onExit: () => void;
}

export type GameLifecycleState =
    | "created"
    | "starting"
    | "running"
    | "stopping"
    | "disposed";

/**GameEngine 的创建者只需要提供停止能力与共享的 participation 服务。*/
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
    /**当前游戏实例自己的 participation 视图，可仅凭稳定 playerId 建立参与关系。*/
    public readonly participation: GameParticipation;
    public readonly key: string;
    private _lifecycle: GameLifecycleState = "created";

    /**是否是常驻游戏（常驻游戏不会被game end结束) */
    get isDaemon() {
        return false;
    }

    get lifecycle(): Readonly<GameLifecycleState> {
        return this._lifecycle;
    }

    /**只有 starting/running 阶段允许继续创建运行时资源。*/
    get isActive() {
        return this._lifecycle === "starting" || this._lifecycle === "running";
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
        this.participation = new GameParticipation(
            owner.participation,
            key,
            !this.isDaemon
        );
        this.playerManager = new GamePlayerManager(
            playerClass,
            this.participation
        );
        this.context = this.buildContext(config ?? ({} as O));
        this.logger = new Logger(this.constructor.name);
    }

    protected abstract buildContext(config: O): C;

    /**游戏开始 */
    protected abstract onStart(): void;

    /**游戏结束(dispose前调用) */
    protected abstract onStop(): void;

    /** 在栈顶添加一个新的子状态。onEnter 失败时自动回滚该 State 的资源。 */
    pushState<S extends gameStateConstructor<P, C, any>>(
        stateType: S,
        config?: ExtractConfig<S>
    ) {
        if (!this.isActive) return this;
        this.logger.debug(`Pushing state: ${stateType.name}`);
        const stateInstance = new stateType(this, config);
        this.stateStack.push(stateInstance);

        try {
            (stateInstance as any as GameStateInternal)._onEnter();
        } catch (enterError) {
            const index = this.stateStack.lastIndexOf(stateInstance);
            if (index !== -1) this.stateStack.splice(index, 1);

            try {
                (stateInstance as any as GameStateInternal)._onEnterFailed();
            } catch (cleanupError) {
                throw new AggregateError(
                    [enterError, cleanupError],
                    `State ${stateType.name} 进入失败且回滚异常`
                );
            }
            throw enterError;
        }
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
        if (!this.isActive) return this;
        this.logger.debug(`Setting root state to: ${stateType.name}`);
        this.clearStateStack();
        this.pushState(stateType, config);
        return this;
    }

    /** 从指定的状态实例开始替换状态分支。*/
    replaceFrom<S extends gameStateConstructor<P, C, any>>(
        stateToReplace: GameState<P, C>,
        newStateType: S,
        config?: ExtractConfig<S>
    ) {
        if (!this.isActive) return this;
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

        const errors: unknown[] = [];
        while (this.stateStack.length > index) {
            const removed = this.stateStack.pop()!;
            try {
                this.removeState(removed);
            } catch (err) {
                errors.push(err);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, "替换 State 分支时清理失败");
        }
        this.pushState(newStateType, config);
        return this;
    }

    private clearStateStack() {
        const errors: unknown[] = [];
        while (this.stateStack.length > 0) {
            const state = this.stateStack.pop()!;
            try {
                this.removeState(state);
            } catch (err) {
                errors.push(err);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, "State 栈清理失败");
        }
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
        const playersLine = `§ePlayers§r: §a${this.playerManager.validSize}§r / §7${this.playerManager.activeSize} active / ${this.playerManager.size} wrappers §8(participants ${this.participation.size})`;
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
        if (this._lifecycle === "stopping" || this._lifecycle === "disposed") {
            return;
        }
        this.owner.stopGameByKey(this.key);
    }

    /** @internal */
    private _onStart() {
        if (this._lifecycle !== "created") {
            throw new GameEngineError(
                `不能从 ${this._lifecycle} 状态启动游戏 ${this.key}`
            );
        }
        this._lifecycle = "starting";
        this.onStart();
        if (this._lifecycle === "starting") {
            this._lifecycle = "running";
        }
    }

    /** @internal */
    private _onStop() {
        if (this._lifecycle === "stopping" || this._lifecycle === "disposed") {
            return;
        }
        this._lifecycle = "stopping";
        this.onStop();
    }

    /** @internal */
    private _onDispose() {
        if (this._lifecycle === "disposed") return;
        if (this._lifecycle !== "stopping") this._lifecycle = "stopping";

        const errors: unknown[] = [];
        try {
            this.clearStateStack();
        } catch (err) {
            errors.push(err);
        }
        try {
            this.playerManager.dispose();
        } catch (err) {
            errors.push(err);
        } finally {
            this._lifecycle = "disposed";
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, `Game ${this.key} 清理失败`);
        }
    }
}

export interface GameEngineInternal {
    _onStart(): void;
    _onStop(): void;
    _onDispose(): void;
}
