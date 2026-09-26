[**BEGame**](../README.md)

***

# Class: PlayerGroupSet<T, TData>

玩家组集合。集合本身不强制一个玩家只能属于一个组，但所有聚合玩家操作按 `playerId` 去重。

## 关键方法

- `addGroup(group)` / `removeGroup(group)`
- `getGroups(): readonly PlayerGroup<T, TData>[]`
- `getAllPlayers(): T[]` — 按 playerId 去重，保留首个组顺序
- `getAllValidPlayers()`
- `forEach(func)` — 每个有效 playerId 至多执行一次
- `filter(predicate)`
- `some(predicate)` — 命中即返回，不构造临时玩家数组
- `findGroupById(id)` — 首个所属组
- `findById(id)` — 玩家 + 首个所属组
- `areInSameGroup(firstId, secondId)`
- `removePlayer(player, reason?)` — 从所有重复 membership 中删除
- `clearInvalid()`
- `clone(): PlayerGroupSet<T, TData>` — 保留组 data
- `sendMessage / title / runCommand / runCommands`

## Accessors

- `size` — 去重后的玩家数
- `validSize` — 去重后的有效玩家数
- `changed` — 聚合各组 membership 变化
