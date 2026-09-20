# BEGame

Minecraft Bedrock 小游戏生命周期框架。

BEGame 关注 **GameEngine → GameState → GameComponent** 的运行时生命周期、玩家参与关系、事件与 Runner 资源管理，以及服务器集成。它不试图替代 Minecraft ScriptAPI，而是为基岩版小游戏提供稳定、可测试的游戏运行时。

## Packages

```text
@begame/core         游戏运行时
@begame/test         无头生命周期测试引擎
@begame/trace-spec   Trace 词汇表：事件 ID、值/schema 类型、错误标记（零依赖）
@begame/trace        全部 trace：编解码 + 会话 + 历史存储 + 日志解析（根入口平台无关）
                     @begame/trace/minecraft ← Minecraft 绑定（唯一碰 MC 的入口）
@begame/observatory  本地 Trace 分析工作台与服务（private，不发布）
```

> **尚未发布到 npm。** 下面的 `npm i` 命令目前会失败（registry 上还没有 `@begame/*`）。
> 现阶段请从本地引用：`npm run pack` 会产出 tarball 到 `artifacts/`，或者直接用
> `"@begame/core": "file:../begame/packages/core"` 这类路径依赖。
>
> 用 `file:` 引用时注意：被引用的包在 package.json 里写的是**版本号**（如
> `@begame/trace-spec: 0.0.2`），npm 会去 registry 找它。所以这类兄弟包必须在顶层
> 一并声明，否则 `npm install` 会**静默成功**但装出一棵缺依赖的树，运行时才报错。

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

### 玩家离线与空房自动回收

临时小游戏的常见配置（组件挂在游戏的常驻根 State，而非随回合替换的子 State）：

```ts
import { AutoStopComponent, DisconnectTimeoutComponent } from "@begame/core/gameComponent";
import { Duration } from "@begame/core/utils";

this.addComponent(DisconnectTimeoutComponent, {
    timeout: Duration.fromSeconds(30),
    releaseOnTimeout: true,
});
this.addComponent(AutoStopComponent);
```

`DisconnectTimeoutComponent` 对每个掉线玩家独立计时，重连取消超时；
它不会把网络掉线直接等同于主动退房。对普通小游戏，超时释放
Participation 后，`AutoStopComponent` 自动处理最后成员离开；
在线执行 `playerManager.leave()` 同样能够触发空房回收。
已有的 `stopGameWhenEmpty` 仅为兼容保留，新代码不要再使用。

AutoStop 默认观察当前 Game 的 Participation。成员变化时延迟一个 tick
重新读取成员，避免在退房流程内部重入或误删同 tick 有新玩家加入的房间；
另每 10 秒（200 ticks）检查一次，作为漏事件或 `canStop` 条件变化的兜底。
从未有成员加入的空房也会在首次 10 秒检查时被回收，不会永久残留。
对初始化完成前可能空置超过 10 秒的游戏，应在入座准备就绪后才挂载
AutoStop；需要永久空房待人的大厅则不要启用自动停止。
`canStop` 可阻止结算期间停局，条件变化后既可主动调用 `reconcile()`
立即重新检查，也会在下一次 10 秒兜底检查中自动重新评估。

若确实需要按组范围停止，可传入 `{ groupSet }`。此时作用域是该 groupSet
当前成员与 Game Participation 的交集，既订阅 group 变化也订阅参与资格变化。
自定义成员资格时，必须**同时**提供 `getMemberIds` 和 `memberChanged`；
不要将自定义成员资格与 `groupSet` 混用，以免漏掉成员变化通知。
注意 `PlayerGroup.clearInvalid()` 会真正移除组成员（事件原因 `invalid-purge`），
但不会释放 Participation。**有掉线重连宽限的房间不要用会清理离线成员的 group
作为 AutoStop scope**；使用默认 Participation，或让该 group 保留离线成员资格。
`PlayerGroupSet.clear()` 只移除包含的 group，不等于清空各组成员。

连接状态实时使用 `Game.server.getPlayer(id)` / `isOnline(id)` 查询服务器在线玩家；
`Game.events.connection` 仅广播变化，不维护第二份在线快照。
Participation 的 `changed` 只在真正加入、离开时通知，Game teardown 的清理保持静默。

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

每个 `GameEngine` 实例可以把自己完整的一次执行导出成 `.begtrace`。`@begame/trace-spec` 是共享词汇表，`@begame/trace` 承载其余全部（编解码、会话、历史存储、Content Log 解析），`@begame/observatory` 把这个能力包装成本地分析工作台：

```bash
npm run build                # 先构建（前端 bundle + 服务端），与启动分离
npm run observatory          # 默认只开 HTTP 工作台：http://127.0.0.1:8787
npm run observatory:net      # 额外开启 BDS server-net 桥（18790）
npm run observatory:connect  # 额外开启 /connect 桥（18789），与 --net 互斥
```

工作台是通用的：只认识 BEGame 内置事件族，以及「自定义事件把具体类型放在 `payload.type`」这一约定，不针对任何具体游戏。视图包括概览（事件族分布/诊断/参与者）、事件流（按状态分段、事件族筛选、默认折叠内部事件）、结构（状态树/组件生命周期）、参与者、原始（事件表 + 分析 JSON）。可粘贴 Content Log 或拖入 `.log` / `.txt` / `.begtrace` 文件。端口按需开启，默认不占用 `/connect` 与 BDS 端口；面向 agent 的结构化接口见 [Game Trace 文档](./docs/game-trace.md)。

Trace 是**自己组装后注入**的：`@begame/core` 既不含 trace 实现也不依赖它，只有显式引入 Minecraft 入口并传进去才会启用，不用的项目不会把它打进产物。根入口是平台无关的，所以纯 Node 工具（如 observatory）不会碰到 Minecraft。

```ts
import { initBEGame } from "@begame/core";
import { createTraceRuntime } from "@begame/trace/minecraft";

initBEGame({ trace: createTraceRuntime(), traceStore: true });
```

### BDS 远程导出（server-net）

BDS 不支持客户端的 `/connect` 命令。服务端改用 `@minecraft/server-net` 的
WebSocket 桥：行为包把历史对局交给本机 Observatory，Observatory 反过来列出、
下载、删除并管理这些对局。集成方式（双 bepack 配置、依赖隔离、API 与运行要点）
见 [BDS server-net 导出](./docs/server-net-export.md)。

## Packaging

包按「未使用即不打包」设计：`sideEffects` 精确声明到文件级，可选能力要么走独立入口（`@begame/core/server`），要么由使用方自己组装后注入（`@begame/trace`），所以不用的功能不会进入产物。`npm run test:treeshake` 会真的打包单符号消费者并断言结果，在 CI 中运行。详见[打包与 tree-shaking](./docs/packaging.md)。

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
