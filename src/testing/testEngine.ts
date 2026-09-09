import { Game } from "../main";
import type { GameEngine } from "../gameEngine";
import type { ManagedGameConstructor } from "../system/gameManager";
import { virtualMinecraft, Player } from "./virtualMinecraft";
import { virtualMinecraftUi } from "./virtualMinecraftUi";

export interface TestTraceEntry {
    readonly tick: number;
    readonly type:
        | "connect"
        | "disconnect"
        | "advance"
        | "start-game"
        | "stop-game"
        | "reload"
        | "reset";
    readonly detail?: string;
}

export interface ReloadScenario<TSnapshot, TResult> {
    snapshot: () => TSnapshot | Promise<TSnapshot>;
    restore: (snapshot: TSnapshot) => TResult | Promise<TResult>;
}

/**
 * Node 环境下的 SAPIGame 无头测试驱动。
 *
 * 使用时必须先加载 `sapi-game/testing/register`，让 @minecraft/server 指向
 * virtualMinecraft。测试驱动本身调用的仍然是真实 GameManager/GameEngine。
 */
export class SAPIGameTestEngine {
    readonly trace: TestTraceEntry[] = [];

    get tick() {
        return virtualMinecraft.system.currentTick;
    }

    get manager() {
        return Game.manager;
    }

    connectPlayer(id: string, name = id): Player {
        const player = virtualMinecraft.connectPlayer(id, name);
        this.record("connect", id);
        return player;
    }

    disconnectPlayer(id: string) {
        const disconnected = virtualMinecraft.disconnectPlayer(id);
        if (disconnected) this.record("disconnect", id);
        return disconnected;
    }

    getPlayer(id: string) {
        return virtualMinecraft.getPlayer(id);
    }

    startGame<T extends GameEngine<any, any, any>>(
        game: ManagedGameConstructor<T>,
        config?: T extends GameEngine<any, any, infer O> ? O : unknown,
        tag?: string
    ): T {
        const instance = this.manager.startGame(game, config as any, tag);
        this.record("start-game", instance.key);
        return instance;
    }

    stopGame<T extends GameEngine<any, any>>(game: Function, tag?: string) {
        const key = this.manager.buildKey(game, tag);
        this.manager.stopGameByKey(key);
        this.record("stop-game", key);
    }

    getGame<T extends GameEngine<any, any>>(game: Function, tag?: string) {
        return this.manager.getGameByKey(this.manager.buildKey(game, tag)) as
            | T
            | undefined;
    }

    async advanceTicks(ticks: number) {
        await virtualMinecraft.advanceTicks(ticks);
        this.record("advance", String(ticks));
    }

    emitAfterEvent(name: string, event: unknown) {
        virtualMinecraft.emitAfterEvent(name, event);
    }

    emitBeforeEvent(name: string, event: unknown) {
        virtualMinecraft.emitBeforeEvent(name, event);
    }

    emitSystemBeforeEvent(name: string, event: unknown) {
        virtualMinecraft.emitSystemBeforeEvent(name, event);
    }

    queueFormResponse(response: {
        canceled?: boolean;
        selection?: number;
        formValues?: unknown[];
    }) {
        virtualMinecraftUi.queueResponse(response);
    }

    /**
     * 模拟 Script reload：
     * 1. 先由游戏导出权威 snapshot；
     * 2. 静默销毁全部普通 Game/State/Component/Runner/Participation；
     * 3. 清空虚拟 ScriptAPI 的订阅和调度任务，但保留世界与在线玩家；
     * 4. 调用 restore 创建新的游戏运行时对象。
     *
     * SAPIGame 不序列化 State 栈；恢复内容由具体游戏 snapshot 决定。
     */
    async reload<TSnapshot, TResult>(
        scenario: ReloadScenario<TSnapshot, TResult>
    ): Promise<TResult> {
        const snapshot = await scenario.snapshot();
        this.manager.disposeAll();
        virtualMinecraft.resetScriptResources();
        virtualMinecraftUi.clearResponses();
        this.record("reload");
        return await scenario.restore(snapshot);
    }

    /**清空普通游戏、脚本资源和虚拟世界，用于测试用例之间完全隔离。*/
    reset() {
        this.manager.disposeAll();
        virtualMinecraft.resetWorld();
        virtualMinecraftUi.clearResponses();
        this.trace.length = 0;
        this.record("reset");
    }

    private record(type: TestTraceEntry["type"], detail?: string) {
        this.trace.push({ tick: this.tick, type, ...(detail ? { detail } : {}) });
    }
}
