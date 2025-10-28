[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GameState

# Abstract Class: GameState\<P, C, TConfig, E\>

游戏状态

## Type Parameters

### P

`P` *extends* `GamePlayer` = `any`

### C

`C` *extends* `GameContext` = `any`

### TConfig

`TConfig` = `unknown`

### E

`E` *extends* [`GameEngine`](GameEngine.md)\<`P`, `C`\> = [`GameEngine`](GameEngine.md)\<`P`, `C`\>

## Constructors

### Constructor

> **new GameState**\<`P`, `C`, `TConfig`, `E`\>(`engine`, `config?`): `GameState`\<`P`, `C`, `TConfig`, `E`\>

#### Parameters

##### engine

`E`

##### config?

`TConfig`

#### Returns

`GameState`\<`P`, `C`, `TConfig`, `E`\>

## Properties

### config?

> `readonly` `optional` **config**: `TConfig`

***

### engine

> `protected` `readonly` **engine**: `E`

***

### eventManager

> `readonly` **eventManager**: [`EventManager`](EventManager.md)

***

### logger

> `protected` `readonly` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

***

### runner

> `readonly` **runner**: [`RunnerManager`](RunnerManager.md)

## Accessors

### context

#### Get Signature

> **get** **context**(): `C`

全局上下文

##### Returns

`C`

***

### gameKey

#### Get Signature

> **get** **gameKey**(): `string`

##### Returns

`string`

***

### lastState

#### Get Signature

> **get** **lastState**(): `GameState`\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

##### Returns

`GameState`\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

***

### nextState

#### Get Signature

> **get** **nextState**(): `GameState`\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

获取子状态

##### Returns

`GameState`\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

***

### playerManager

#### Get Signature

> **get** **playerManager**(): `GamePlayerManager`\<`P`\>

玩家管理器

##### Returns

`GamePlayerManager`\<`P`\>

## Methods

### \_onExit()

> **\_onExit**(): `void`

系统调用，不要重写！

#### Returns

`void`

***

### addComponent()

> **addComponent**\<`C`\>(`component`, `options?`): `GameState`\<`P`, `C`, `TConfig`, `E`\>

添加组件到当前状态

#### Type Parameters

##### C

`C` *extends* `GameComponentType`\<`any`, `any`\>

#### Parameters

##### component

`C`

##### options?

`ConstructorParameters`\<`C`\>\[`1`\]

#### Returns

`GameState`\<`P`, `C`, `TConfig`, `E`\>

#### Throws

GameStateError 若状态已存在

***

### addComponents()

> **addComponents**(`components`): `void`

添加多个components(不能带参数)

#### Parameters

##### components

`GameComponentType`\<`any`\>[]

#### Returns

`void`

***

### deleteComponent()

> **deleteComponent**(`component`): `GameState`\<`P`, `C`, `TConfig`, `E`\>

删除当前状态中的组件

#### Parameters

##### component

`GameComponentType`\<`any`\>

#### Returns

`GameState`\<`P`, `C`, `TConfig`, `E`\>

***

### getComponent()

> **getComponent**\<`C`\>(`type`): `InstanceType`\<`C`\>

获取当前状态中的组件

#### Type Parameters

##### C

`C` *extends* `GameComponentType`\<`any`, `any`\>

#### Parameters

##### type

`C`

#### Returns

`InstanceType`\<`C`\>

#### Throws

GameStateError 若组件不存在，则抛出

***

### onEnter()

> `abstract` **onEnter**(): `void`

进入

#### Returns

`void`

***

### onExit()

> **onExit**(): `void`

#### Returns

`void`

***

### popState()

> `protected` **popState**(): `void`

返回到父状态

#### Returns

`void`

***

### pushState()

> `protected` **pushState**\<`S`\>(`stateType`, `config?`): `void`

进入一个新的子状态

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

> **stats**(): `string`

返回基本信息

#### Returns

`string`

***

### subscribe()

> `protected` **subscribe**\<`T`\>(`event`, ...`args`): `void`

#### Type Parameters

##### T

`T` *extends* [`EventSignal`](../type-aliases/EventSignal.md)\<`any`\>

#### Parameters

##### event

`T`

##### args

...`Parameters`\<`T`\[`"subscribe"`\]\>

#### Returns

`void`

***

### transitionTo()

> `protected` **transitionTo**\<`T`\>(`stateType`, `config?`): `void`

将当前状态及其所有子状态，替换为一个新状态。

#### Type Parameters

##### T

`T`

#### Parameters

##### stateType

`gameStateConstructor`\<`P`, `C`, `T`\>

##### config?

`T`

#### Returns

`void`
