# 斗地主联合开发基线

本文件记录 `feat/ddz-support` 分支的开发边界。斗地主不是作为一个固定版 SAPI-Game 的外部适配项目，而是作为真实项目驱动 SAPI-Game 演进；框架新增能力必须是可复用于其他游戏的通用能力。

## 目标

- 斗地主规则与 Minecraft / SAPI-Game 完全解耦，可在普通 TypeScript 环境独立测试。
- SAPI-Game 负责游戏实例、玩家分配、生命周期、运行时状态、组件、事件和 Runner。
- 斗地主表现层独立于规则核心，现有 `visual_controller` 只作为视觉投影，不作为权威牌局状态。
- 支持同类多实例、多局 Session、脚本重载恢复，并为后续掉线重绑定保留空间。

## 依赖方向

```text
Minecraft / SAPI-Game
        |
        v
Doudizhu Adapter + Presentation
        |
        v
DDZ Core (pure TypeScript)
```

`DDZ Core` 不允许依赖：

- `@minecraft/server`
- `sapi-game`
- Entity / Player / GameState / GameComponent
- 动画、音效、Viewer、按钮和 UI 临时状态

## 两类状态

必须区分运行时状态和权威牌局状态。

### SAPI GameState

用于表达运行阶段和管理运行时资源，例如：

- Waiting
- Bidding
- Playing
- Settlement
- 对应阶段的 GameComponent、EventSubscription、Runner

这些对象不要求可序列化，也不直接作为对局存档。

### DDZ MatchState / RoundState

用于表达游戏事实，例如：

- 三家手牌
- 地主
- 当前行动座位
- 上一手牌
- 连续 Pass 次数
- 倍数
- 当前局数和累计比分

这些数据必须从一开始就保持 JSON 可序列化，并作为 Snapshot / Restore 的基础。

恢复时由权威状态重新构造 SAPI GameState，而不是序列化 GameState 实例。

## GameEngine 生命周期约定

一个 `DoudizhuGameEngine` 表示一张牌桌上的一次 Session，而不是单独一局牌。

```text
DoudizhuGameEngine
  -> Round 1
  -> Settlement
  -> Round 2
  -> Settlement
  -> ...
  -> players leave / session ends
```

因此单局结束不调用 `stopGame()`。

## SAPI-Game 预计由斗地主验证的通用能力

以下能力只在真实需求出现并验证后下沉，不提前做棋牌专用抽象：

1. Stable Game Type：持久化时不依赖 class name 作为稳定标识。
2. Snapshot / Restore：保存和恢复长期 Game Session。
3. Player Reservation / Rebind：长生命周期游戏的离线与重新绑定能力。

不计划加入 `CardGameEngine`、`PokerGame` 等棋牌专用框架层。

## 当前阶段（Phase 0）

- 联合开发分支：`feat/ddz-support`。
- GitHub `master` 仍是旧基线；本分支先同步 Gitee 最新构建相关变更，再继续开发。
- 斗地主现有视觉 Demo 暂不改行为，先建立回归基线。
- 下一阶段从纯 TypeScript 的 Card / Deck / Rule Core 开始，不先接 Minecraft。
