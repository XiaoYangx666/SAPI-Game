[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / CubeRegion

# Class: CubeRegion

立方体区域

## Extends

- [`GameRegion`](GameRegion.md)

## Constructors

### Constructor

> **new CubeRegion**(`dimId`, `pos1`, `pos2`): `CubeRegion`

#### Parameters

##### dimId

[`DimensionIds`](../SAPI-Game/namespaces/Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

##### pos1

`Vector3`

##### pos2

`Vector3`

#### Returns

`CubeRegion`

#### Overrides

[`GameRegion`](GameRegion.md).[`constructor`](GameRegion.md#constructor)

## Properties

### dimensionId

> **dimensionId**: [`DimensionIds`](../SAPI-Game/namespaces/Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

#### Inherited from

[`GameRegion`](GameRegion.md).[`dimensionId`](GameRegion.md#dimensionid)

***

### pos1

> `readonly` **pos1**: `Vector3`

***

### pos2

> `readonly` **pos2**: `Vector3`

## Methods

### forEachPlayer()

> **forEachPlayer**(`callbackfn`): `void`

对每个玩家执行操作

#### Parameters

##### callbackfn

(`value`) => `void`

#### Returns

`void`

#### Inherited from

[`GameRegion`](GameRegion.md).[`forEachPlayer`](GameRegion.md#foreachplayer)

***

### getBounds()

> **getBounds**(): `object`

获取范围

#### Returns

`object`

##### x1

> **x1**: `number`

##### x2

> **x2**: `number`

##### y1

> **y1**: `number`

##### y2

> **y2**: `number`

##### z1

> **z1**: `number`

##### z2

> **z2**: `number`

***

### getCapacity()

> **getCapacity**(): `number`

获取大小

#### Returns

`number`

***

### getEntitesInRegion()

> **getEntitesInRegion**(`options?`): `Entity`[]

获取区域内实体

#### Parameters

##### options?

`EntityQueryOptions`

#### Returns

`Entity`[]

#### Inherited from

[`GameRegion`](GameRegion.md).[`getEntitesInRegion`](GameRegion.md#getentitesinregion)

***

### getEntityQueryOption()

> **getEntityQueryOption**(): `EntityQueryOptions`

#### Returns

`EntityQueryOptions`

#### Overrides

[`GameRegion`](GameRegion.md).[`getEntityQueryOption`](GameRegion.md#getentityqueryoption)

***

### getMax()

> **getMax**(): `Vector3`

获取区域最大点坐标

#### Returns

`Vector3`

***

### getMin()

> **getMin**(): `Vector3`

获取区域最小点坐标

#### Returns

`Vector3`

***

### getPlayersInRegion()

> **getPlayersInRegion**(): `Player`[]

获取区域内的玩家

#### Returns

`Player`[]

#### Inherited from

[`GameRegion`](GameRegion.md).[`getPlayersInRegion`](GameRegion.md#getplayersinregion)

***

### inSet()

> **inSet**(`distance`): `CubeRegion` \| `undefined`

向内收缩区域（若收缩后无体积则返回 undefined）

#### Parameters

##### distance

`Vector3`

#### Returns

`CubeRegion` \| `undefined`

***

### isBlockInside()

> **isBlockInside**(`loc`): `boolean`

判断方块是否在区域内

#### Parameters

##### loc

`Vector3`

#### Returns

`boolean`

#### Overrides

[`GameRegion`](GameRegion.md).[`isBlockInside`](GameRegion.md#isblockinside)

***

### isInside()

> **isInside**(`loc`): `boolean`

判断是否在区域内

#### Parameters

##### loc

`Vector3`

#### Returns

`boolean`

#### Overrides

[`GameRegion`](GameRegion.md).[`isInside`](GameRegion.md#isinside)

***

### outSet()

> **outSet**(`distance`): `CubeRegion`

向外扩张区域

#### Parameters

##### distance

`Vector3`

#### Returns

`CubeRegion`

***

### runCommandOnPlayers()

> **runCommandOnPlayers**(`commandString`): `void`

在区域内的玩家执行命令

#### Parameters

##### commandString

`string`

#### Returns

`void`

#### Inherited from

[`GameRegion`](GameRegion.md).[`runCommandOnPlayers`](GameRegion.md#runcommandonplayers)

***

### toVolume()

> **toVolume**(): `BlockVolume`

转换为BlockVolume

#### Returns

`BlockVolume`
