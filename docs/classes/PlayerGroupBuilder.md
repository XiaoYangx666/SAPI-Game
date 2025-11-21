[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / PlayerGroupBuilder

# Class: PlayerGroupBuilder\<T\>

玩家组构建器

## Type Parameters

### T

`T` *extends* [`GamePlayer`](GamePlayer.md) = [`GamePlayer`](GamePlayer.md)

## Constructors

### Constructor

> **new PlayerGroupBuilder**\<`T`\>(`manager`): `PlayerGroupBuilder`\<`T`\>

#### Parameters

##### manager

[`GamePlayerManager`](GamePlayerManager.md)\<`T`\>

#### Returns

`PlayerGroupBuilder`\<`T`\>

## Properties

### playerManager

> **playerManager**: [`GamePlayerManager`](GamePlayerManager.md)\<`T`\>

## Methods

### emptyGroup()

> **emptyGroup**\<`TData`\>(...`rest`): [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

创建空的玩家组

#### Type Parameters

##### TData

`TData` = `undefined`

#### Parameters

##### rest

...`TData` *extends* `undefined` ? \[\] : \[`TData`\]

#### Returns

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

***

### fromAll()

> **fromAll**\<`TData`\>(...`rest`): [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

从所有玩家创建

#### Type Parameters

##### TData

`TData` = `unknown`

#### Parameters

##### rest

...`TData` *extends* `undefined` ? \[\] : \[`TData`\]

#### Returns

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

***

### fromGroup()

> **fromGroup**\<`TData`\>(`group`, ...`rest`): [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

从已有 PlayerGroup 创建 engine PlayerGroup

#### Type Parameters

##### TData

`TData` = `undefined`

#### Parameters

##### group

[`PlayerGroup`](PlayerGroup.md)\<`any`\>

##### rest

...`TData` *extends* `undefined` ? \[\] : \[`TData`\]

#### Returns

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

***

### fromPlayers()

> **fromPlayers**\<`TData`\>(`players`, ...`rest`): [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

从原生 Player 创建 PlayerGroup 并映射到 playerManager

#### Type Parameters

##### TData

`TData` = `undefined`

#### Parameters

##### players

`Player`[]

##### rest

...`TData` *extends* `undefined` ? \[\] : \[`TData`\]

#### Returns

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

***

### fromRegion()

> **fromRegion**\<`TData`\>(`dim`, `region`, ...`rest`): [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

从某个区域创建

#### Type Parameters

##### TData

`TData` = `unknown`

#### Parameters

##### dim

[`DimensionIds`](../SAPI-Game/namespaces/Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

##### region

[`GameRegion`](GameRegion.md)

##### rest

...`TData` *extends* `undefined` ? \[\] : \[`TData`\]

#### Returns

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>
