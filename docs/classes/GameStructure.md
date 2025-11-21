[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / GameStructure

# Class: GameStructure

游戏结构

## Constructors

### Constructor

> **new GameStructure**(`id`, `loc`, `dim`): `GameStructure`

构造一个游戏结构

#### Parameters

##### id

`string`

结构id

##### loc

`Vector3`

结构放置坐标

##### dim

[`DimensionIds`](../SAPI-Game/namespaces/Utils/namespaces/vanilaData/enumerations/DimensionIds.md) = `DimensionIds.Overworld`

结构维度(默认主世界)

#### Returns

`GameStructure`

## Properties

### dim

> `readonly` **dim**: [`DimensionIds`](../SAPI-Game/namespaces/Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

***

### id

> `readonly` **id**: `string`

***

### loc

> `readonly` **loc**: `Vector3`

## Methods

### get()

> **get**(): `Structure` \| `undefined`

获取结构

#### Returns

`Structure` \| `undefined`

***

### place()

> **place**(`options?`): `void`

放在默认的位置

#### Parameters

##### options?

`StructurePlaceOptions`

#### Returns

`void`

***

### placeOn()

> **placeOn**(`loc`, `dim`, `options?`): `void`

放在指定地点

#### Parameters

##### loc

`Vector3`

##### dim

`Dimension`

##### options?

`StructurePlaceOptions`

#### Returns

`void`
