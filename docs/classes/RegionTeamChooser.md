[**BEGame**](../README.md)

***

# Class: RegionTeamChooser<P, S>

区域选队组件。

## Options

- `config: RegionTeamChooserData<P>[]`
  - `region: GameRegion`
  - `team: PlayerGroup<P>`
  - `onEnter?: (player: P) => void`
  - `onJoin?: (player: P) => void`
- `removeOnLeave?: boolean` — 离开单个选队区域时是否退出该队，默认 false
- `membershipRegion?: GameRegion` — 整个选队/等待大厅；离开时从本 Chooser 管理的所有队伍移除
- `allowSpectator?: boolean` — 默认 false

只有真正的 Enter 才会尝试 `playerManager.join()`；Leave 不会反向创建 participation。旁观者校验也发生在 join 前。
