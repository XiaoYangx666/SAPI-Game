[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / GamePlayer

# Class: GamePlayer

游戏玩家基类

## Extended by

- [`TTLPlayer`](TTLPlayer.md)

## Constructors

### Constructor

> **new GamePlayer**(`player`): `GamePlayer`

#### Parameters

##### player

`Player`

#### Returns

`GamePlayer`

## Properties

### id

> `readonly` **id**: `string`

***

### isActive

> `protected` **isActive**: `boolean` = `true`

是否仍然在当前游戏（调用/hub等会为false）

***

### name

> `readonly` **name**: `string`

## Accessors

### isValid

#### Get Signature

> **get** **isValid**(): `Readonly`\<`boolean`\>

##### Returns

`Readonly`\<`boolean`\>

***

### player

#### Get Signature

> **get** **player**(): `Player` \| `undefined`

获取player
若玩家下线或失效返回undefined

##### Returns

`Player` \| `undefined`

## Methods

### actionbar()

> **actionbar**(`text`): `void`

设置actionbar文字

#### Parameters

##### text

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`void`

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

***

### clear()

> **clear**(`itemId?`): `void`

清除(使用命令)

#### Parameters

##### itemId?

`string`

#### Returns

`void`

***

### giveItem()

> **giveItem**(`item`): `void`

给物品

#### Parameters

##### item

`ItemStack`

#### Returns

`void`

***

### runCommand()

> **runCommand**(`cmd`): `CommandResult` \| `undefined`

运行命令

#### Parameters

##### cmd

`string`

#### Returns

`CommandResult` \| `undefined`

***

### sendMessage()

> **sendMessage**(`mes`): `void`

发送消息

#### Parameters

##### mes

`string` | `RawMessage` | (`string` \| `RawMessage`)[]

#### Returns

`void`

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
