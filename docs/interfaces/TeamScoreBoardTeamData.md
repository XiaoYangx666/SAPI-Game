[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / TeamScoreBoardTeamData

# Interface: TeamScoreBoardTeamData\<T\>

## Type Parameters

### T

`T` *extends* [`GamePlayer`](../classes/GamePlayer.md) = [`GamePlayer`](../classes/GamePlayer.md)

## Properties

### buildName()?

> `optional` **buildName**: (`player`) => `string`

自定义方法，会覆盖前缀

#### Parameters

##### player

`T`

#### Returns

`string`

***

### prefix?

> `optional` **prefix**: `string`

前缀

***

### showInvalid?

> `optional` **showInvalid**: `boolean`

展示失效玩家(默认否)

***

### team

> **team**: [`PlayerGroup`](../classes/PlayerGroup.md)\<`T`\>

队伍对象

***

### teamFilter()?

> `optional` **teamFilter**: (`p`) => `boolean`

组内过滤

#### Parameters

##### p

`T`

#### Returns

`boolean`

***

### teamSort()?

> `optional` **teamSort**: (`p1`, `p2`) => `number`

同组排序方法

#### Parameters

##### p1

`T`

##### p2

`T`

#### Returns

`number`
