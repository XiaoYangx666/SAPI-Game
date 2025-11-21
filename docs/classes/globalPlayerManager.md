[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / globalPlayerManager

# Class: globalPlayerManager

## Constructors

### Constructor

> **new globalPlayerManager**(): `globalPlayerManager`

#### Returns

`globalPlayerManager`

## Methods

### allocatePlayerToGame()

> `protected` **allocatePlayerToGame**(`playerId`, `gameKey`): `boolean`

请求分配玩家
系统调用

#### Parameters

##### playerId

`string`

##### gameKey

`string`

#### Returns

`boolean`

boolean 是否成功分配

***

### forceReleaseFromGame()

> **forceReleaseFromGame**(`playerId`): `void`

强制释放玩家

#### Parameters

##### playerId

`string`

#### Returns

`void`

***

### getFreePlayers()

> **getFreePlayers**(): `Player`[]

获取所有在线且没有分配游戏的玩家

#### Returns

`Player`[]

***

### isPlayerAllocated()

> **isPlayerAllocated**(`playerId`): `boolean`

玩家是否已被分配（不修改状态）

#### Parameters

##### playerId

`string`

#### Returns

`boolean`

***

### releaseAllPlayerFromGame()

> `protected` **releaseAllPlayerFromGame**(`gameKey`): `void`

将玩家从指定游戏释放
系统调用

#### Parameters

##### gameKey

`string`

#### Returns

`void`

***

### releasePlayerFromGame()

> **releasePlayerFromGame**(`playerId`, `gameKey`): `void`

将玩家从指定游戏释放

#### Parameters

##### playerId

`string`

##### gameKey

`string`

#### Returns

`void`

***

### status()

> **status**(): `string`

#### Returns

`string`
