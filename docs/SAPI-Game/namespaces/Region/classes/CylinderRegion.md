[**SAPI-Game**](../../../../README.md)

***

[SAPI-Game](../../../../README.md) / [Region](../README.md) / CylinderRegion

# Class: CylinderRegion

游戏区域

## Extends

- [`GameRegion`](GameRegion.md)

## Constructors

### Constructor

> **new CylinderRegion**(`dimId`): `CylinderRegion`

#### Parameters

##### dimId

[`DimensionIds`](../../Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

#### Returns

`CylinderRegion`

#### Inherited from

[`GameRegion`](GameRegion.md).[`constructor`](GameRegion.md#constructor)

## Properties

### dimensionId

> **dimensionId**: [`DimensionIds`](../../Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

#### Inherited from

[`GameRegion`](GameRegion.md).[`dimensionId`](GameRegion.md#dimensionid)

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

`any`

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
