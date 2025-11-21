[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / PlayerRegionMonitorOptions

# Interface: PlayerRegionMonitorOptions\<P\>

## Type Parameters

### P

`P` *extends* [`GamePlayer`](../classes/GamePlayer.md)

## Properties

### groups

> **groups**: [`PlayerGroupSet`](../classes/PlayerGroupSet.md)\<`P`\>

玩家组集合

***

### interval

> **interval**: [`Duration`](../SAPI-Game/namespaces/Utils/classes/Duration.md)

检测间隔

***

### onLeave()

> **onLeave**: (`player`) => `void`

区域外的玩家执行

#### Parameters

##### player

`P`

#### Returns

`void`

***

### region

> **region**: [`GameRegion`](../classes/GameRegion.md)

区域
