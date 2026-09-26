[**BEGame**](../README.md)

***

# Interface: SidebarScoreboardOptions

- `scoreboardName?: string` — 推荐
- `scoreBoardName?: string` — deprecated 旧拼写
- `displayName: string`
- `paddingLeft?: number`
- `header?: () => readonly string[]`
- `footer?: () => readonly string[]`
- `showOnAttach?: boolean`
- `lines?: () => readonly string[]`
- `refreshOn?: readonly EventSignal[]`
- `score?: (index: number, total: number) => number`
