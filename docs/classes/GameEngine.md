[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GameEngine

# Abstract Class: GameEngine\<P, C, O\>

## Type Parameters

### P

`P` *extends* [`GamePlayer`](GamePlayer.md) = `any`

### C

`C` *extends* [`GameContext`](GameContext.md) = `any`

### O

`O` = `unknown`

## Constructors

### Constructor

> **new GameEngine**\<`P`, `C`, `O`\>(`playerClass`, `key`, `config?`): `GameEngine`\<`P`, `C`, `O`\>

#### Parameters

##### playerClass

`classConstructor`\<`P`\>

##### key

`string`

##### config?

`O`

#### Returns

`GameEngine`\<`P`, `C`, `O`\>

## Properties

### context

> `readonly` **context**: `C`

***

### key

> `readonly` **key**: `string`

***

### logger

> `protected` `readonly` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

***

### playerManager

> `readonly` **playerManager**: [`GamePlayerManager`](GamePlayerManager.md)\<`P`\>

## Accessors

### groupBuilder

#### Get Signature

> **get** **groupBuilder**(): [`PlayerGroupBuilder`](PlayerGroupBuilder.md)\<`P`\>

玩家组构建器

##### Returns

[`PlayerGroupBuilder`](PlayerGroupBuilder.md)\<`P`\>

***

### isActive

#### Get Signature

> **get** **isActive**(): `boolean`

##### Returns

`boolean`

***

### isDaemon

#### Get Signature

> **get** **isDaemon**(): `boolean`

是否是常驻游戏（常驻游戏不会被game end结束)

##### Returns

`boolean`

## Methods

### buildContext()

> `abstract` `protected` **buildContext**(`config`): `C`

#### Parameters

##### config

`O`

#### Returns

`C`

***

### deleteState()

> **deleteState**(`stateType`): `void`

删除指定state

#### Parameters

##### stateType

`gameStateConstructor`\<`P`, `C`, `any`\>

#### Returns

`void`

***

### getLastState()

> **getLastState**(`state`): [`GameState`](GameState.md)\<`P`, `C`, `unknown`, `GameEngine`\<`P`, `C`, `unknown`\>\> \| `undefined`

获取上一个state

#### Parameters

##### state

[`GameState`](GameState.md)\<`P`, `C`\>

#### Returns

[`GameState`](GameState.md)\<`P`, `C`, `unknown`, `GameEngine`\<`P`, `C`, `unknown`\>\> \| `undefined`

***

### getNextState()

> **getNextState**(`state`): [`GameState`](GameState.md)\<`P`, `C`, `unknown`, `GameEngine`\<`P`, `C`, `unknown`\>\> \| `undefined`

获取下一个state

#### Parameters

##### state

[`GameState`](GameState.md)\<`P`, `C`\>

#### Returns

[`GameState`](GameState.md)\<`P`, `C`, `unknown`, `GameEngine`\<`P`, `C`, `unknown`\>\> \| `undefined`

***

### getState()

> **getState**\<`T`\>(`stateType`): `T` \| `undefined`

获取指定state

#### Type Parameters

##### T

`T` *extends* [`GameState`](GameState.md)\<`P`, `C`, `any`, `GameEngine`\<`P`, `C`, `unknown`\>\>

#### Parameters

##### stateType

`classConstructor`\<`T`\>

#### Returns

`T` \| `undefined`

***

### onStart()

> `abstract` `protected` **onStart**(): `void`

游戏开始

#### Returns

`void`

***

### onStop()

> `abstract` `protected` **onStop**(): `void`

游戏结束(dispose前调用)

#### Returns

`void`

***

### popState()

> **popState**(): `void`

移除栈顶的状态，返回到父状态

#### Returns

`void`

***

### pushState()

> **pushState**\<`S`\>(`stateType`, `config?`): `GameEngine`\<`P`, `C`, `O`\>

在栈顶添加一个新的子状态

#### Type Parameters

##### S

`S` *extends* `gameStateConstructor`\<`P`, `C`, `any`\>

#### Parameters

##### stateType

`S`

##### config?

`ExtractConfig`\<`S`\>

#### Returns

`GameEngine`\<`P`, `C`, `O`\>

***

### replaceFrom()

> **replaceFrom**\<`S`\>(`stateToReplace`, `newStateType`, `config?`): `void`

从指定的状态实例开始替换状态分支。

#### Type Parameters

##### S

`S` *extends* `gameStateConstructor`\<`P`, `C`, `any`\>

#### Parameters

##### stateToReplace

[`GameState`](GameState.md)\<`P`, `C`\>

##### newStateType

`S`

##### config?

`ExtractConfig`\<`S`\>

#### Returns

`void`

***

### resetState()

> **resetState**\<`S`\>(`stateType`, `config?`): `void`

清空所有状态，并设置一个新的根状态

#### Type Parameters

##### S

`S` *extends* `gameStateConstructor`\<`P`, `C`, `any`\>

#### Parameters

##### stateType

`S`

##### config?

`ExtractConfig`\<`S`\>

#### Returns

`void`

***

### stats()

> **stats**(`detail`): `string`

显示engine信息

#### Parameters

##### detail

`boolean` = `false`

#### Returns

`string`

***

### stopGame()

> **stopGame**(): `void`

#### Returns

`void`
