[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / PlayerGroup

# Class: PlayerGroup\<T, TData\>

玩家组

## Type Parameters

### T

`T` *extends* [`GamePlayer`](GamePlayer.md) = [`GamePlayer`](GamePlayer.md)

### TData

`TData` = `undefined`

## Constructors

### Constructor

> **new PlayerGroup**\<`T`, `TData`\>(`playerClass`, `players?`): `PlayerGroup`\<`T`, `TData`\>

创建新的玩家组

#### Parameters

##### playerClass

[`GamePlayerConstructor`](../type-aliases/GamePlayerConstructor.md)\<`T`\>

##### players?

`T`[]

#### Returns

`PlayerGroup`\<`T`, `TData`\>

### Constructor

> **new PlayerGroup**\<`T`, `TData`\>(`playerClass`, `players`, `data?`): `PlayerGroup`\<`T`, `TData`\>

#### Parameters

##### playerClass

[`GamePlayerConstructor`](../type-aliases/GamePlayerConstructor.md)\<`T`\>

##### players

`T`[]

##### data?

`TData`

#### Returns

`PlayerGroup`\<`T`, `TData`\>

## Properties

### data

> `readonly` **data**: `TData`

***

### playerConstructor

> `readonly` **playerConstructor**: [`GamePlayerConstructor`](../type-aliases/GamePlayerConstructor.md)\<`T`\>

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

组中玩家数量(包含下线玩家)

##### Returns

`number`

***

### validSize

#### Get Signature

> **get** **validSize**(): `number`

组中玩家数量(不包含下线玩家)

##### Returns

`number`

## Methods

### actionbar()

> **actionbar**(`text`): `PlayerGroup`\<`T`, `TData`\>

#### Parameters

##### text

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### add()

> **add**(`player`): `PlayerGroup`\<`T`, `TData`\>

#### Parameters

##### player

`T`

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### clear()

> **clear**(): `PlayerGroup`\<`T`, `TData`\>

清空组

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### clearInvalid()

> **clearInvalid**(): `PlayerGroup`\<`T`, `TData`\>

清除无效玩家

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### clone()

> **clone**(): `PlayerGroup`\<`T`\>

克隆一份新的 PlayerGroup

#### Returns

`PlayerGroup`\<`T`\>

***

### delete()

> **delete**(`player`): `PlayerGroup`\<`T`, `TData`\>

#### Parameters

##### player

`Player` | `T`

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### filter()

> **filter**(`func`): `T`[]

#### Parameters

##### func

(`p`) => `boolean`

#### Returns

`T`[]

***

### find()

> **find**(`predicate`): `T` \| `undefined`

查找符合条件的玩家

#### Parameters

##### predicate

(`p`) => `boolean`

#### Returns

`T` \| `undefined`

***

### findIndex()

> **findIndex**(`predicate`): `number`

#### Parameters

##### predicate

(`p`) => `boolean`

#### Returns

`number`

***

### forEach()

> **forEach**(`func`): `void`

对所有有效玩家执行操作

#### Parameters

##### func

(`p`) => `void`

#### Returns

`void`

***

### getAll()

> **getAll**(): `T`[]

获取组中全部玩家的拷贝

#### Returns

`T`[]

***

### getAllPlayers()

> **getAllPlayers**(): `Player`[]

获取所有原生 Player 对象

#### Returns

`Player`[]

***

### getById()

> **getById**(`id`): `T` \| `undefined`

根据 id 查找玩家

#### Parameters

##### id

`string`

#### Returns

`T` \| `undefined`

***

### has()

> **has**(`player`): `boolean`

是否包含玩家

#### Parameters

##### player

`Player` | `T`

#### Returns

`boolean`

***

### map()

> **map**\<`U`\>(`func`): `U`[]

#### Type Parameters

##### U

`U`

#### Parameters

##### func

(`p`) => `U`

#### Returns

`U`[]

***

### playSound()

> **playSound**(`soundId`, `soundOptions?`): `PlayerGroup`\<`T`, `TData`\>

向组内所有玩家播放音效

#### Parameters

##### soundId

`string`

##### soundOptions?

`PlayerSoundOptions`

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### random()

> **random**(): `T` \| `undefined`

获取随机在线玩家

#### Returns

`T` \| `undefined`

***

### removeWhere()

> **removeWhere**(`func`): `T`[]

#### Parameters

##### func

(`player`) => `boolean`

#### Returns

`T`[]

***

### runCommand()

> **runCommand**(`commandString`): `PlayerGroup`\<`T`, `TData`\>

组内所有玩家执行命令

#### Parameters

##### commandString

`string`

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### sendMessage()

> **sendMessage**(`mes`): `PlayerGroup`\<`T`, `TData`\>

向组内所有玩家发送消息

#### Parameters

##### mes

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`PlayerGroup`\<`T`, `TData`\>

***

### title()

> **title**(`title`, `subtitle?`, `options?`): `PlayerGroup`\<`T`, `TData`\>

向组内所有玩家显示标题

#### Parameters

##### title

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

##### subtitle?

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

##### options?

`TitleDisplayOptions`

#### Returns

`PlayerGroup`\<`T`, `TData`\>
