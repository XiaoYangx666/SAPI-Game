[**BEGame**](../README.md)

***

# Interface: TeamScoreboardTeamData<T>

单个队伍在 `teamScoreboard()` 中的展示配置。

- `team: PlayerGroup<T>`
- `prefix?: string`
- `buildName?: (player: T) => string`
- `teamSort?: (p1: T, p2: T) => number`
- `teamFilter?: (player: T) => boolean`
- `showInvalid?: boolean`
