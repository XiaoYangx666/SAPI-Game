# BEGame 无头测试引擎

`@begame/test` 用于在 **不启动 Minecraft Bedrock** 的情况下测试 BEGame 游戏的完整运行时生命周期。

它的职责是验证：

- GameEngine 从创建到销毁；
- GameState push / pop / reset / replace 与 `onEnter/onExit`；
- GameComponent `onAttach/onDetach`；
- EventManager / RunnerManager 是否随 State 正确清理；
- Participation / GamePlayer 加入、退出与在线状态；
- 玩家掉线、重连和超时；
- Script reload 后根据游戏自己的 snapshot 重建运行时；
- 生命周期异常时 rollback 和资源释放。

它**不模拟** Minecraft 物理、红石、寻路、渲染、真实区块加载或客户端 UI。

## 安装

```bash
npm i @begame/core
npm i -D @begame/test vitest
```

## Vitest 配置

```ts
// vitest.config.ts
import { defineBEGameTestConfig } from "@begame/test/vitest";

export default defineBEGameTestConfig({
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
```

`defineBEGameTestConfig()` 会自动把：

```text
@minecraft/server
@minecraft/server-ui
```

重定向到 `@begame/test` 提供的虚拟 ScriptAPI runtime。

因此测试执行的仍然是实际 `@begame/core` 中的：

```text
GameManager
GameEngine
GameState
GameComponent
GamePlayer
ParticipationManager
EventManager
RunnerManager
DisconnectTimeoutComponent
```

而不是另一套 Fake GameEngine。

## 基本用法

```ts
import { expect, test } from "vitest";
import { BEGameTestEngine } from "@begame/test";
import { MyGame } from "../src/MyGame";

const env = new BEGameTestEngine();

test("完整生命周期", async () => {
    env.reset();

    const alice = env.connectPlayer("alice", "Alice");
    const game = env.startGame(MyGame, { player: alice });

    await env.advanceTicks(20);

    env.disconnectPlayer("alice");
    await env.advanceTicks(10);
    env.connectPlayer("alice");

    expect(game.lifecycle).toBe("running");
});
```

`advanceTicks()` 使用确定性的虚拟 tick。推进 600 tick 不需要真的等待 30 秒。

## 玩家连接模型

虚拟玩家按 `playerId` 保持稳定 wrapper：

```ts
const before = env.connectPlayer("alice");
env.disconnectPlayer("alice");
const after = env.connectPlayer("alice");

expect(after).toBe(before);
```

掉线只影响在线状态，不会自动释放 Participation。是否超时 leave 由游戏自己的策略（例如 `DisconnectTimeoutComponent`）决定。

## Script reload

BEGame 不序列化 State 栈。具体游戏自己的 MatchState / GameSnapshot 才应该是权威状态。

```ts
const restored = await env.reload({
    snapshot: () => game.snapshot(),
    restore: (snapshot) => restoreGame(snapshot),
});
```

`reload()` 会：

1. 获取游戏 snapshot；
2. 静默 dispose 所有 Game，包括 daemon；
3. 销毁 State / Component / Event / Runner / Participation；
4. 清空虚拟 ScriptAPI 的订阅和调度任务；
5. 保留虚拟世界与当前在线 Player wrapper；
6. 调用 `restore(snapshot)` 创建新的游戏运行时。

它不会真正重新加载 Node ESM 模块，所以模块级可变全局变量不应被当作可恢复的权威游戏状态。

## API

```ts
env.connectPlayer(id, name?)
env.disconnectPlayer(id)
env.getPlayer(id)

env.startGame(GameClass, config?, tag?)
env.stopGame(GameClass, tag?)
env.getGame(GameClass, tag?)

env.advanceTicks(ticks)

env.emitAfterEvent(name, payload)
env.emitBeforeEvent(name, payload)
env.emitSystemBeforeEvent(name, payload)

env.queueFormResponse(response)

env.reload({ snapshot, restore })
env.reset()
```

`env.trace` 记录测试驱动侧的 connect / disconnect / advance / start-game / stop-game / reload / reset。具体游戏可以在自己的 Context 中记录更细粒度生命周期 trace。

## 普通 Node 环境

不使用 Vitest 时，也可以预加载：

```bash
node --import @begame/test/register your-test.js
```

`@begame/test/register` 会在 Node 模块解析阶段重定向 Minecraft ScriptAPI。

## 推荐测试层级

```text
纯游戏 Core 测试
    ↓
@begame/test Headless lifecycle tests
    ↓
少量 Minecraft 真机 / 专服集成测试
```

目标是让绝大多数生命周期、状态切换、玩家进入退出、掉线、重载和资源泄漏问题在 CI 中直接暴露。
