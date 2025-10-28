[**SAPI-Game**](../../../../README.md)

***

[SAPI-Game](../../../../README.md) / [Region](../README.md) / PlaneRegion

# Class: PlaneRegion

平面区域

## Extends

- [`GameRegion`](GameRegion.md)

## Constructors

### Constructor

> **new PlaneRegion**(`dimId`, `pos1`, `pos2`): `PlaneRegion`

#### Parameters

##### dimId

[`DimensionIds`](../../Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

##### pos1

`Vector2`

##### pos2

`Vector2`

#### Returns

`PlaneRegion`

#### Overrides

[`GameRegion`](GameRegion.md).[`constructor`](GameRegion.md#constructor)

## Properties

### dimensionId

> **dimensionId**: [`DimensionIds`](../../Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

#### Inherited from

[`GameRegion`](GameRegion.md).[`dimensionId`](GameRegion.md#dimensionid)

***

### pos1

> **pos1**: `Vector2`

***

### pos2

> **pos2**: `Vector2`

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

### getPlayersInRegion()

> **getPlayersInRegion**(): `Player`[]

获取区域内的玩家

#### Returns

`Player`[]

#### Inherited from

[`GameRegion`](GameRegion.md).[`getPlayersInRegion`](GameRegion.md#getplayersinregion)

***

### isInside()

> **isInside**(`loc`): `boolean`

#### Parameters

##### loc

`Vector2`

#### Returns

`boolean`

#### Overrides

[`GameRegion`](GameRegion.md).[`isInside`](GameRegion.md#isinside)

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
