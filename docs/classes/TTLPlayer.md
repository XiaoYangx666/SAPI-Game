[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / TTLPlayer

# Class: TTLPlayer

带寿命的player

## Extends

- [`GamePlayer`](GamePlayer.md)

## Constructors

### Constructor

> **new TTLPlayer**(`player`): `TTLPlayer`

#### Parameters

##### player

`Player`

#### Returns

`TTLPlayer`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`constructor`](GamePlayer.md#constructor)

## Properties

### id

> `readonly` **id**: `string`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`id`](GamePlayer.md#id)

***

### initialTTL

> `readonly` **initialTTL**: `number` = `30`

初始TTL，可override

***

### isActive

> `protected` **isActive**: `boolean` = `true`

是否仍然在当前游戏（调用/hub等会为false）

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`isActive`](GamePlayer.md#isactive)

***

### name

> `readonly` **name**: `string`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`name`](GamePlayer.md#name)

## Accessors

### isValid

#### Get Signature

> **get** **isValid**(): `Readonly`\<`boolean`\>

##### Returns

`Readonly`\<`boolean`\>

#### Overrides

[`GamePlayer`](GamePlayer.md).[`isValid`](GamePlayer.md#isvalid)

***

### player

#### Get Signature

> **get** **player**(): `Player` \| `undefined`

获取player
若玩家下线或失效返回undefined

##### Returns

`Player` \| `undefined`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`player`](GamePlayer.md#player)

***

### ttl

#### Get Signature

> **get** **ttl**(): `number`

获取玩家剩余存活时间

##### Returns

`number`

#### Set Signature

> **set** **ttl**(`value`): `void`

剩余寿命(自动处理isActive)

##### Parameters

###### value

`number`

##### Returns

`void`

## Methods

### actionbar()

> **actionbar**(`text`): `void`

设置actionbar文字

#### Parameters

##### text

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`void`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`actionbar`](GamePlayer.md#actionbar)

***

### addEffect()

> **addEffect**(`effectType`, `duration`, `amplifier?`, `showParticles?`): `void`

为玩家添加效果

#### Parameters

##### effectType

`string` | `EffectType`

##### duration

`number`

##### amplifier?

`number`

##### showParticles?

`boolean`

是否显示粒子，默认为false

#### Returns

`void`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`addEffect`](GamePlayer.md#addeffect)

***

### clear()

> **clear**(`itemId?`): `void`

清除(使用命令)

#### Parameters

##### itemId?

`string`

#### Returns

`void`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`clear`](GamePlayer.md#clear)

***

### giveItem()

> **giveItem**(`item`): `void`

给物品

#### Parameters

##### item

`ItemStack`

#### Returns

`void`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`giveItem`](GamePlayer.md#giveitem)

***

### runCommand()

> **runCommand**(`cmd`): `CommandResult` \| `undefined`

运行命令

#### Parameters

##### cmd

`string`

#### Returns

`CommandResult` \| `undefined`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`runCommand`](GamePlayer.md#runcommand)

***

### sendMessage()

> **sendMessage**(`mes`): `void`

发送消息

#### Parameters

##### mes

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`void`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`sendMessage`](GamePlayer.md#sendmessage)

***

### title()

> **title**(`title`, `subtitle?`, `options?`): `void`

展示title

#### Parameters

##### title

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

##### subtitle?

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

##### options?

`TitleDisplayOptions`

#### Returns

`void`

#### Inherited from

[`GamePlayer`](GamePlayer.md).[`title`](GamePlayer.md#title)
