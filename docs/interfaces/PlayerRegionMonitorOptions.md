[**BEGame**](../README.md)

***

# Type: PlayerRegionMonitorOptions<P>

> **Deprecated:** 新代码使用 [RegionBoundaryOptions](RegionBoundaryOptions.md)。

兼容适配器仍支持以下二选一来源：

- `players: PlayerSource<P>`
- `groups: PlayerSource<P>`（旧字段）

并保留 `region`、`interval?`、`onLeave(player)`。
