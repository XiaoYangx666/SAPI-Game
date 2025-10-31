[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GamePlayerManager

# Class: GamePlayerManager\<T\>

游戏玩家管理器

## Type Parameters

### T

`T` *extends* [`GamePlayer`](GamePlayer.md) = [`GamePlayer`](GamePlayer.md)

## Constructors

### Constructor

> **new GamePlayerManager**\<`T`\>(`playerConstructor`, `gameKey`, `isDaemon`): `GamePlayerManager`\<`T`\>

#### Parameters

##### playerConstructor

[`GamePlayerConstructor`](../type-aliases/GamePlayerConstructor.md)\<`T`\>

##### gameKey

`string`

##### isDaemon

`boolean`

#### Returns

`GamePlayerManager`\<`T`\>

## Properties

### groupBuilder

> `readonly` **groupBuilder**: [`PlayerGroupBuilder`](PlayerGroupBuilder.md)\<`T`\>

玩家组构建器

***

### playerConstructor

> `readonly` **playerConstructor**: [`GamePlayerConstructor`](../type-aliases/GamePlayerConstructor.md)\<`T`\>

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

***

### validSize

#### Get Signature

> **get** **validSize**(): `number`

##### Returns

`number`

## Methods

### deactivate()

> **deactivate**(`p`): `void`

让玩家失活

#### Parameters

##### p

`Player`

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

#### Returns

`void`

***

### get()

> **get**(`p`): `T`

获取游戏玩家(若玩家已分配，返回无效玩家)

#### Parameters

##### p

`Player`

#### Returns

`T`

***

### getAll()

> **getAll**(): `T`[]

#### Returns

`T`[]
