# 组件一览（GameComponent）

`@begame/core/gameComponent` 提供的通用组件。这里只说明「有哪些、大致做什么」，
具体参数、默认值和用法请直接看源码或类型定义：

```text
packages/core/src/gameComponent/**
```

更详细的分组件教程见 [`tutorial/组件大全.md`](../tutorial/组件大全.md)。

所有组件都通过 `state.addComponent(Component, options?, tag?)` 挂载，生命周期跟随
所属 State；卸载时自动退订事件、清理自身创建的资源。可同时挂载同名组件的多个实例
（用 `tag` 区分）。

## 生命周期 / 基础设施

| 组件 | 说明 |
| --- | --- |
| `GameComponent` | 组件抽象基类：`onAttach` / `onDetach` 钩子，`subscribe` 自动退订。 |
| `LazyLoader` | 检测目标方块所在区块是否加载，加载时挂载子组件、卸载时移除（命令方块式的按需加载）。 |
| `Timer` | 倒计时，带 `tick` / `onTime` 事件，可暂停/续时。 |
| `StopWatch` | 正计时秒表。 |
| `DisconnectTimeoutComponent` | 每个玩家独立的掉线宽限计时，重连取消，超时释放参与关系。 |
| `AutoStopComponent` | 房间无人后自动停止游戏（参与关系或自定义成员来源）。 |

## 玩家交互限制

| 组件 | 说明 |
| --- | --- |
| `BlockInteractionBlocker` | 阻止指定玩家组与方块交互，可按方块 ID / 方块组件过滤。 |
| `EntityInteractionBlocker` | 阻止指定玩家组与实体交互，可按实体 ID / 组件过滤。 |
| `SpawnPointProtector` | 设置并循环保护玩家的出生点区域。 |
| `PlayerRegionMonitor` | 定时检测玩家是否离开区域，触发回调。 |

## 战斗 / PvP

| 组件 | 说明 |
| --- | --- |
| `PvpController` | 用 `beforeEvents.entityHurt` 控制玩家互相伤害。可按 `players`（玩家范围）和/或 `region`（区域范围，配 `regionScope`）限定生效范围，并支持运行时 `enable()` / `disable()`。大厅挂 `{ region }` 即可禁止该区域内 PvP。 |
| `FriendlyFireProtector` | 取消同一队伍（同一个 `PlayerGroup`）内的互相伤害，即友伤保护。 |

## 区域与队伍

| 组件 | 说明 |
| --- | --- |
| `RegionProtector` | 阻止区域外的破坏/交互等行为。 |
| `RegionTeamChooser` | 玩家进入指定区域时自动加入对应队伍。 |
| `RegionTeamCleaner` | 玩家离开区域时自动移出对应队伍。 |

## 视图 / 展示

| 组件 | 说明 |
| --- | --- |
| `PlayerTextPrimitive` | 通用玩家文本：给一批玩家各挂一个 `TextPrimitive`（可跟随玩家），按间隔刷新文本。可配置 `offset` / `scale` / `rotation` / `depthTest` / `visibleTo` / `refreshInterval` 等。 |
| `playerHealthText()` / `playerNameText()` | `PlayerTextPrimitive` 的预设配置工厂，分别用于头顶血量、名字。 |
| `InfoScoreboard` | 侧边栏信息计分板（header / footer / `updateLines`）。 |
| `TeamScoreBoard` | 侧边栏队伍计分板。 |

## 最近变更

- 新增 `PlayerTextPrimitive` 与 `playerHealthText` / `playerNameText` 预设；
  旧的 `PlayerHealthIndicator`（计分板方案）已删除。
- 新增 `PvpController`（可按玩家/区域范围控制 PvP）与 `FriendlyFireProtector`（友伤保护）。
