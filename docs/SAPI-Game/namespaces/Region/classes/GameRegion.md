[**SAPI-Game**](../../../../README.md)

***

[SAPI-Game](../../../../README.md) / [Region](../README.md) / GameRegion

# Abstract Class: GameRegion

游戏区域

## Extended by

- [`CubeRegion`](CubeRegion.md)
- [`SphereRegion`](SphereRegion.md)
- [`CylinderRegion`](CylinderRegion.md)
- [`PlaneRegion`](PlaneRegion.md)

## Constructors

### Constructor

> **new GameRegion**(`dimId`): `GameRegion`

#### Parameters

##### dimId

[`DimensionIds`](../../Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

#### Returns

`GameRegion`

## Properties

### dimensionId

> **dimensionId**: [`DimensionIds`](../../Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

## Methods

### forEachPlayer()

> **forEachPlayer**(`callbackfn`): `void`

对每个玩家执行操作

#### Parameters

##### callbackfn

(`value`) => `void`

#### Returns

`void`

***

### getEntitesInRegion()

> **getEntitesInRegion**(`options?`): `Entity`[]

获取区域内实体

#### Parameters

##### options?

`EntityQueryOptions`

#### Returns

`Entity`[]

***

### getEntityQueryOption()

> `abstract` **getEntityQueryOption**(): `EntityQueryOptions`

#### Returns

`EntityQueryOptions`

***

### getPlayersInRegion()

> **getPlayersInRegion**(): `Player`[]

获取区域内的玩家

#### Returns

`Player`[]

***

### isBlockInside()

> `abstract` **isBlockInside**(`loc`): `boolean`

#### Parameters

##### loc

`any`

#### Returns

`boolean`

***

### isInside()

> `abstract` **isInside**(`loc`): `boolean`

#### Parameters

##### loc

`any`

#### Returns

`boolean`

***

### runCommandOnPlayers()

> **runCommandOnPlayers**(`commandString`): `void`

在区域内的玩家执行命令

#### Parameters

##### commandString

`string`

#### Returns

`void`
