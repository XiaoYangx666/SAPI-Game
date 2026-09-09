import { Game } from "@begame/core";
import type { GameEngine, ManagedGameConstructor } from "@begame/core";
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

/** Node 环境下的 BEGame 无头生命周期测试驱动。 */
export class BEGameTestEngine {
    readonly trace: TestTraceEntry[] = [];

    constructor() {
        // Core / SAPI-Pro modules subscribe during import. Creating a test
        // environment represents a loaded world, so finish that initialization.
        virtualMinecraft.emitWorldLoad();
    }

    get tick() {
        return virtualMinecraft.system.currentTick;
    }

    get nowMs() {
        return virtualMinecraft.system.currentTimeMs;
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

    async reload<TSnapshot, TResult>(
        scenario: ReloadScenario<TSnapshot, TResult>
    ): Promise<TResult> {
        const snapshot = await scenario.snapshot();
        this.manager.disposeAll({ includeDaemon: true });
        virtualMinecraft.resetScriptResources();
        virtualMinecraftUi.clearResponses();
        virtualMinecraft.emitWorldLoad();
        this.record("reload");
        return await scenario.restore(snapshot);
    }

    reset() {
        this.manager.disposeAll({ includeDaemon: true });
        virtualMinecraft.resetWorld();
        virtualMinecraftUi.clearResponses();
        virtualMinecraft.emitWorldLoad();
        this.trace.length = 0;
        this.record("reset");
    }

    private record(type: TestTraceEntry["type"], detail?: string) {
        this.trace.push({ tick: this.tick, type, ...(detail ? { detail } : {}) });
    }
}

/** @deprecated 使用 BEGameTestEngine。 */
export const SAPIGameTestEngine = BEGameTestEngine;
