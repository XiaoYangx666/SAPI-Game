[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / PlayerGroupSet

# Class: PlayerGroupSet\<T, TData\>

玩家组集合

## Type Parameters

### T

`T` *extends* [`GamePlayer`](GamePlayer.md) = [`GamePlayer`](GamePlayer.md)

### TData

`TData` = `any`

## Constructors

### Constructor

> **new PlayerGroupSet**\<`T`, `TData`\>(`groups?`): `PlayerGroupSet`\<`T`, `TData`\>

#### Parameters

##### groups?

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>[]

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

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

### addGroup()

> **addGroup**(`group`): `PlayerGroupSet`\<`T`, `TData`\>

#### Parameters

##### group

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

***

### clear()

> **clear**(): `PlayerGroupSet`\<`T`, `TData`\>

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

***

### clearInvalid()

> **clearInvalid**(): `void`

#### Returns

`void`

***

### clone()

> **clone**(): `PlayerGroupSet`\<`T`\>

#### Returns

`PlayerGroupSet`\<`T`\>

***

### filter()

> **filter**(`predicate`): `T`[]

#### Parameters

##### predicate

(`p`) => `boolean`

#### Returns

`T`[]

***

### findById()

> **findById**(`id`): \{ `group`: [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>; `player`: `T`; \} \| `undefined`

根据玩家 ID 查找玩家及其所在组

#### Parameters

##### id

`string`

#### Returns

\{ `group`: [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>; `player`: `T`; \} \| `undefined`

***

### forEach()

> **forEach**(`func`): `PlayerGroupSet`\<`T`, `TData`\>

对所有有效玩家执行操作

#### Parameters

##### func

(`p`) => `void`

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

***

### forEachGroup()

> **forEachGroup**(`func`): `void`

#### Parameters

##### func

(`g`) => `void`

#### Returns

`void`

***

### getAllPlayers()

> **getAllPlayers**(): `T`[]

获取所有玩家，包括invalid的

#### Returns

`T`[]

***

### getAllValidPlayers()

> **getAllValidPlayers**(): [`ValidGamePlayer`](../type-aliases/ValidGamePlayer.md)\<`T`\>[]

获取所有有效玩家

#### Returns

[`ValidGamePlayer`](../type-aliases/ValidGamePlayer.md)\<`T`\>[]

***

### getGroups()

> **getGroups**(): readonly [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>[]

#### Returns

readonly [`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>[]

***

### has()

> **has**(`id`): `boolean`

判断玩家是否在内

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### removeGroup()

> **removeGroup**(`group`): `PlayerGroupSet`\<`T`, `TData`\>

#### Parameters

##### group

[`PlayerGroup`](PlayerGroup.md)\<`T`, `TData`\>

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

***

### runCommand()

> **runCommand**(`command`): `PlayerGroupSet`\<`T`, `TData`\>

让所有玩家执行命令

#### Parameters

##### command

`string`

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

***

### runCommands()

> **runCommands**(`commands`): `void`

#### Parameters

##### commands

`string`[]

#### Returns

`void`

***

### sendMessage()

> **sendMessage**(`mes`): `PlayerGroupSet`\<`T`, `TData`\>

向所有玩家发送消息

#### Parameters

##### mes

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>

***

### title()

> **title**(`title`, `subtitle?`, `options?`): `PlayerGroupSet`\<`T`, `TData`\>

对所有玩家显示标题

#### Parameters

##### title

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

##### subtitle?

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

##### options?

`TitleDisplayOptions`

#### Returns

`PlayerGroupSet`\<`T`, `TData`\>
