[**BEGame**](../README.md)

***

# Function: teamScoreboard()

将 `PlayerGroup[]` 转换为 `SidebarScoreboardOptions`。

支持每队：

- `prefix`
- `buildName(player)`
- `teamSort(a, b)`
- `teamFilter(player)`
- `showInvalid`

preset 会监听各 `PlayerGroup.changed` 自动刷新 membership 变化。若展示内容依赖普通业务字段（如 `player.no`、`status`），字段变化后需要显式调用 `SidebarScoreboard.refresh()`。
