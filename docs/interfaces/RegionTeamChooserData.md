[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / RegionTeamChooserData

# Interface: RegionTeamChooserData\<P\>

## Type Parameters

### P

`P` *extends* [`GamePlayer`](../classes/GamePlayer.md)

## Properties

### onEnter()?

> `optional` **onEnter**: (`player`) => `void`

玩家进入区域时执行

#### Parameters

##### player

`P`

#### Returns

`void`

***

### onJoin()?

> `optional` **onJoin**: (`player`) => `void`

玩家首次加入本队时执行

#### Parameters

##### player

`P`

#### Returns

`void`

***

### region

> **region**: [`GameRegion`](../classes/GameRegion.md)

指定范围

***

### team

> **team**: [`PlayerGroup`](../classes/PlayerGroup.md)\<`P`\>

指定队伍
