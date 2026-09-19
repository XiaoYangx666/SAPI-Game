# BEGame

Minecraft Bedrock 小游戏生命周期框架。

BEGame 关注 **GameEngine → GameState → GameComponent** 的运行时生命周期、玩家参与关系、事件与 Runner 资源管理，以及服务器集成。它不试图替代 Minecraft ScriptAPI，而是为基岩版小游戏提供稳定、可测试的游戏运行时。

## Packages

```text
@begame/core         游戏运行时
@begame/test         无头生命周期测试引擎
@begame/trace-core   平台无关的 Trace 格式、编解码与会话模型
@begame/trace-tools  Content Log / .begtrace 离线解析工具
@begame/observatory  本地 Trace 分析工作台与服务（private，不发布）
```

### @begame/core

```bash
npm i @begame/core
```

核心使用：

```ts
import { initBEGame, GameEngine, GameState } from "@begame/core";

initBEGame();
```

完整小游戏服务器/地图集成：

```ts
import { initBEGameServer } from "@begame/core/server";

initBEGameServer({
    onJoin(player) {},
    hub(player) {},
});
```

旧的 `initSAPIGame` / `initSAPIGameServer` 暂时保留为 deprecated 兼容别名，新代码请使用 BEGame 命名。

### @begame/test

```bash
npm i -D @begame/test vitest
```

`vitest.config.ts`：

```ts
import { defineBEGameTestConfig } from "@begame/test/vitest";

export default defineBEGameTestConfig({
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
```

测试中：

```ts
import { expect, test } from "vitest";
import { BEGameTestEngine } from "@begame/test";

const env = new BEGameTestEngine();

test("玩家掉线与重连", async () => {
    const alice = env.connectPlayer("alice");
    const game = env.startGame(MyGame, { player: alice });

    env.disconnectPlayer("alice");
    await env.advanceTicks(20);
    env.connectPlayer("alice");

    expect(game.lifecycle).toBe("running");
});
```

测试引擎只模拟框架生命周期和必要的 ScriptAPI 宿主能力，不模拟 Minecraft 物理、红石、渲染或实体 AI。详见 [无头测试引擎文档](./docs/TEST_ENGINE.md)。

### Trace / Observatory

每个 `GameEngine` 实例可以把自己完整的一次执行导出成 `.begtrace`。`@begame/trace-core` 负责平台无关的格式与编解码，`@begame/trace-tools` 负责离线解析 Minecraft Content Log，`@begame/observatory` 把这个能力包装成本地分析工作台：

```bash
npm run observatory   # 打开 http://127.0.0.1:8787
```

工作台围绕会话与数据源组织，提供分析概览、活动流和事件检索三个视图，可粘贴 Content Log 或拖入 `.log` / `.txt` / `.begtrace` 文件。详见 [Game Trace 文档](./docs/game-trace.md)。

Trace 是**按需引入**的：`@begame/core` 本身不依赖 `@begame/trace-core`，只有显式加载 trace 入口时才启用，不用的项目不会把它打进产物。

```ts
import "@begame/core/trace";   // 不使用 trace 就完全不用写这一行
```

## Packaging

包按「未使用即不打包」设计：`sideEffects` 精确声明到文件级，可选能力（`@begame/core/server`、`@begame/core/trace`）通过**引入入口**而不是调用开关来启用，所以不用的功能不会进入产物。`npm run test:treeshake` 会真的打包单符号消费者并断言结果，在 CI 中运行。详见[打包与 tree-shaking](./docs/packaging.md)。

## Runtime architecture

```text
BEGame Core
├─ GameManager
│  ├─ GameEngine instances
│  └─ ParticipationManager
│
├─ GameEngine
│  ├─ GameContext
│  ├─ GamePlayerManager
│  ├─ GameParticipation
│  └─ GameState stack
│     ├─ EventManager
│     ├─ RunnerManager
│     └─ GameComponent
│
└─ optional @begame/core/server
   ├─ ServerPlayerTracker
   ├─ Hub integration
   └─ /game commands
```

默认 Participation policy 为排他模式：同一个 Script runtime 中，一个玩家只能参加一个普通游戏。独立 Addon 拥有独立 runtime，因此互不影响。

## Lifecycle

Game：

```text
created → starting → running → stopping → disposed
```

State：

```text
push
→ onEnter
→ active
→ onExit
→ detach components
→ dispose events
→ dispose runners
```

`onEnter` 失败时会回滚本次 enter 创建的整个 State 子树和资源。

## Testing philosophy

推荐的测试层级：

```text
纯游戏 Core 测试
    ↓
@begame/test Headless lifecycle tests
    ↓
少量 Minecraft 真机 / 专服集成测试
```

大多数状态机、玩家进入退出、掉线重连、超时、Script reload 和资源清理问题都应在第二层由 CI 捕获。

## Example

PartyGames：<https://gitee.com/ykxyx666_admin/partygames>

## License

MIT
