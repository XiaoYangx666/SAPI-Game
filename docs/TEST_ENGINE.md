# SAPIGame 无头测试引擎

`experiment/test-engine` 引入了一套可以在 **Node.js 中直接运行真实 SAPIGame 游戏代码** 的测试环境，用于在不启动 Minecraft Bedrock 的情况下回归游戏生命周期。

## 目标

测试引擎主要验证：

- Game `created -> starting -> running -> stopping -> disposed` 生命周期；
- GameState 的 push / pop / reset / replace 与 `onEnter/onExit`；
- GameComponent 的 `onAttach/onDetach`；
- EventManager / RunnerManager 在 State 退出时是否正确清理；
- Participation / GamePlayer 的加入、退出与在线状态；
- 玩家掉线、重连、掉线超时；
- Script reload 后由游戏自己的 snapshot 重建运行时；
- 生命周期异常时的 rollback 与资源释放。

它的目标不是模拟 Minecraft 的完整物理、渲染、红石或实体 AI，而是提供 **确定性的 ScriptAPI 宿主**，让游戏状态机和 SAPIGame 生命周期可以在 CI 中快速运行。

## 工作方式

测试运行前先加载：

```bash
node --import sapi-game/testing/register --test
```

`testing/register` 会在 Node 模块解析阶段把：

```text
@minecraft/server
@minecraft/server-ui
```

重定向到 SAPIGame 自带的虚拟 ScriptAPI 实现。

因此被测试的仍然是生产构建中的：

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

而不是另外复制的一套 Fake GameEngine。

## 基本示例

```ts
import { SAPIGameTestEngine } from "sapi-game/testing";
import { MyGame } from "../src/MyGame.js";

const env = new SAPIGameTestEngine();

env.reset();

const alice = env.connectPlayer("alice", "Alice");
const game = env.startGame(MyGame, {
    players: [alice],
});

await env.advanceTicks(20);

env.disconnectPlayer("alice");
await env.advanceTicks(600);

// 对 game.lifecycle / participation / context / trace 等做断言
```

`advanceTicks()` 是确定性的虚拟时间推进。推进 600 tick 不会真的等待 30 秒。

## 玩家掉线与重连

虚拟玩家按 `playerId` 保持稳定 wrapper：

```ts
const before = env.connectPlayer("alice");

env.disconnectPlayer("alice");
await env.advanceTicks(10);

const after = env.connectPlayer("alice");

assert.equal(before, after);
```

这与 SAPIGame 当前的玩家模型一致：

- `GamePlayer.isOnline` 反映 ScriptAPI Player 当前是否有效；
- 掉线本身不释放 Participation；
- 是否在超时后 leave，由游戏挂载的 `DisconnectTimeoutComponent` 等策略决定。

## Script reload

SAPIGame 不序列化 State 栈。游戏自己的 MatchState / GameSnapshot 才应该是权威状态。

测试引擎通过：

```ts
const restoredGame = await env.reload({
    snapshot: () => game.snapshot(),
    restore: (snapshot) => restoreGame(snapshot),
});
```

模拟一次脚本重载：

1. 获取游戏权威 snapshot；
2. 静默 dispose 所有 Game（包括 daemon），不调用正常 `onStop()`；
3. 清空 State / Component / Event / Runner 以及虚拟 ScriptAPI 的订阅和调度任务；
4. 保留虚拟世界和当前在线 Player wrapper；
5. 调用游戏提供的 `restore()` 创建新的运行时对象。

这可以验证“状态事实能否从 snapshot 恢复”，但不会重新加载当前 Node 进程里的 ESM 模块本身。因此如果游戏把重要可变状态放在模块级全局变量里，这类状态不应该被视为可恢复的权威状态。

## TestEngine API

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

`env.trace` 还会记录测试驱动侧的重要操作（connect / disconnect / advance / start-game / stop-game / reload）。具体游戏可以在自己的 Context 中增加更细的 trace，用于断言生命周期顺序。

## 虚拟 ScriptAPI 的边界

目前虚拟实现重点覆盖 SAPIGame 自身和典型小游戏流程需要的接口：

- `system.run/runTimeout/runInterval/waitTicks/runJob`；
- world / system event signal；
- Player 在线状态、消息、命令、效果、基础 inventory；
- Dimension / Block / Entity 的基础占位行为；
- scoreboard；
- forms response queue；
- 常用 ScriptAPI enums / registries。

以下内容不应依赖无头测试给出 Minecraft 级正确性保证：

- 实体物理与碰撞；
- 红石；
- 区块真实加载行为；
- 游戏原生寻路；
- 方块更新链；
- 客户端渲染/UI 表现；
- Minecraft 引擎自身的边缘行为。

这些仍需要少量真实游戏内集成测试。

## 推荐的测试层级

```text
纯游戏 Core 测试
    ↓
SAPIGame Headless Test Engine
    ↓
少量 Minecraft 真机/专服集成测试
```

大多数状态机、回合流程、掉线、超时、重载和资源清理问题应该在第二层就被 CI 捕获，减少每次都进入游戏人工测试的成本。
