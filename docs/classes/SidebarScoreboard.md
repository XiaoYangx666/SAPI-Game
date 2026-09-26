[**BEGame**](../README.md)

***

# Class: SidebarScoreboard

统一侧边栏 Component。支持命令式 `updateLines()`，也支持声明式 `lines + refreshOn`。

## Options

- `scoreboardName?: string` — 推荐
- `scoreBoardName?: string` — deprecated 旧拼写
- `displayName: string`
- `paddingLeft?: number`
- `header?: () => readonly string[]`
- `footer?: () => readonly string[]`
- `showOnAttach?: boolean`
- `lines?: () => readonly string[]`
- `refreshOn?: readonly EventSignal[]`
- `score?: (index, total) => number`

## Methods

- `show()`
- `hide()`
- `refresh()`
- `updateLines(lines)`

同一运行时内，同一个 objective ID 只能由一个 `SidebarScoreboardView` owner 占用。并行游戏实例应使用带 `engine.key` 等实例标识的 objective ID。

> `InfoScoreboard` 是 deprecated 兼容别名。
>
> `TeamScoreBoard` 是 deprecated 兼容适配器；新代码使用 `SidebarScoreboard + teamScoreboard(options)`。
