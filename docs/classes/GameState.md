[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GameState

# Abstract Class: GameState\<P, C, TConfig, E\>

游戏状态

## Type Parameters

### P

`P` *extends* [`GamePlayer`](GamePlayer.md) = `any`

### C

`C` *extends* [`GameContext`](GameContext.md) = `any`

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

> **get** **playerManager**(): [`GamePlayerManager`](GamePlayerManager.md)\<`P`\>

玩家管理器

##### Returns

[`GamePlayerManager`](GamePlayerManager.md)\<`P`\>

## Methods

### addComponent()

> **addComponent**\<`C`\>(`component`, `options?`, `tag?`): `GameState`\<`P`, `C`, `TConfig`, `E`\>

添加组件到当前状态

#### Type Parameters

##### C

`C` *extends* `GameComponentType`\<`any`, `any`\>

#### Parameters

##### component

`C`

组件类型

##### options?

`ConstructorParameters`\<`C`\>\[`1`\]

组件参数

##### tag?

`string`

组件标签(唯一)

#### Returns

`GameState`\<`P`, `C`, `TConfig`, `E`\>

#### Throws

组件已存在时抛出

#### Throws

组件加载失败时抛出

***

### addComponents()

> **addComponents**(`components`): `void`

添加多个components(不能带参数和tag)

#### Parameters

##### components

`GameComponentType`\<`any`\>[]

#### Returns

`void`

***

### deleteComponent()

> **deleteComponent**(`component`, `tag?`): `GameState`\<`P`, `C`, `TConfig`, `E`\>

删除当前状态中的组件

#### Parameters

##### component

`GameComponentType`\<`any`\>

##### tag?

`string`

#### Returns

`GameState`\<`P`, `C`, `TConfig`, `E`\>

#### Throws

组件删除失败时

***

### getComponent()

> **getComponent**\<`C`\>(`type`, `tag?`): `InstanceType`\<`C`\>

获取当前状态中的组件

#### Type Parameters

##### C

`C` *extends* `GameComponentType`\<`any`, `any`\>

#### Parameters

##### type

`C`

组件类型

##### tag?

`string`

组件标签

#### Returns

`InstanceType`\<`C`\>

#### Throws

若组件不存在，则抛出

***

### onEnter()

> `abstract` `protected` **onEnter**(): `void`

进入

#### Returns

`void`

***

### onExit()

> `protected` **onExit**(): `void`

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

> `protected` **subscribe**\<`T`\>(`event`, ...`args`): [`EventSubscription`](EventSubscription.md) \| `undefined`

#### Type Parameters

##### T

`T` *extends* [`EventSignal`](../type-aliases/EventSignal.md)\<`any`\>

#### Parameters

##### event

`T`

##### args

...`Parameters`\<`T`\[`"subscribe"`\]\>

#### Returns

[`EventSubscription`](EventSubscription.md) \| `undefined`

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
