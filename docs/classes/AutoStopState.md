[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / AutoStopState

# Class: AutoStopState\<T\>

自动在groupSet所有玩家寄了之后停止游戏

## Extends

- [`GameState`](GameState.md)\<`T`, `any`, `AutoStopStateConfig`\<`T`\>\>

## Type Parameters

### T

`T` *extends* [`TTLPlayer`](TTLPlayer.md) = `any`

## Constructors

### Constructor

> **new AutoStopState**\<`T`\>(`engine`, `config?`): `AutoStopState`\<`T`\>

#### Parameters

##### engine

[`GameEngine`](GameEngine.md)

##### config?

`AutoStopStateConfig`\<`T`\>

#### Returns

`AutoStopState`\<`T`\>

#### Inherited from

[`GameState`](GameState.md).[`constructor`](GameState.md#constructor)

## Properties

### config?

> `readonly` `optional` **config**: `AutoStopStateConfig`\<`T`\>

#### Inherited from

[`GameState`](GameState.md).[`config`](GameState.md#config)

***

### engine

> `protected` `readonly` **engine**: [`GameEngine`](GameEngine.md)

#### Inherited from

[`GameState`](GameState.md).[`engine`](GameState.md#engine)

***

### eventManager

> `readonly` **eventManager**: [`EventManager`](EventManager.md)

#### Inherited from

[`GameState`](GameState.md).[`eventManager`](GameState.md#eventmanager)

***

### logger

> `protected` `readonly` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

#### Inherited from

[`GameState`](GameState.md).[`logger`](GameState.md#logger)

***

### runner

> `readonly` **runner**: [`RunnerManager`](RunnerManager.md)

#### Inherited from

[`GameState`](GameState.md).[`runner`](GameState.md#runner)

## Accessors

### context

#### Get Signature

> **get** **context**(): `C`

全局上下文

##### Returns

`C`

#### Inherited from

[`GameState`](GameState.md).[`context`](GameState.md#context)

***

### gameKey

#### Get Signature

> **get** **gameKey**(): `string`

##### Returns

`string`

#### Inherited from

[`GameState`](GameState.md).[`gameKey`](GameState.md#gamekey)

***

### lastState

#### Get Signature

> **get** **lastState**(): [`GameState`](GameState.md)\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

##### Returns

[`GameState`](GameState.md)\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

#### Inherited from

[`GameState`](GameState.md).[`lastState`](GameState.md#laststate)

***

### nextState

#### Get Signature

> **get** **nextState**(): [`GameState`](GameState.md)\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

获取子状态

##### Returns

[`GameState`](GameState.md)\<`P`, `C`, `unknown`, [`GameEngine`](GameEngine.md)\<`P`, `C`, `unknown`\>\> \| `undefined`

#### Inherited from

[`GameState`](GameState.md).[`nextState`](GameState.md#nextstate)

***

### playerManager

#### Get Signature

> **get** **playerManager**(): [`GamePlayerManager`](GamePlayerManager.md)\<`P`\>

玩家管理器

##### Returns

[`GamePlayerManager`](GamePlayerManager.md)\<`P`\>

#### Inherited from

[`GameState`](GameState.md).[`playerManager`](GameState.md#playermanager)

## Methods

### addComponent()

> **addComponent**\<`C`\>(`component`, `options?`, `tag?`): `AutoStopState`\<`T`\>

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

`AutoStopState`\<`T`\>

#### Throws

组件已存在时抛出

#### Throws

组件加载失败时抛出

#### Inherited from

[`GameState`](GameState.md).[`addComponent`](GameState.md#addcomponent)

***

### addComponents()

> **addComponents**(`components`): `void`

添加多个components(不能带参数和tag)

#### Parameters

##### components

`GameComponentType`\<`any`\>[]

#### Returns

`void`

#### Inherited from

[`GameState`](GameState.md).[`addComponents`](GameState.md#addcomponents)

***

### deleteComponent()

> **deleteComponent**(`component`, `tag?`): `AutoStopState`\<`T`\>

删除当前状态中的组件

#### Parameters

##### component

`GameComponentType`\<`any`\>

##### tag?

`string`

#### Returns

`AutoStopState`\<`T`\>

#### Throws

组件删除失败时

#### Inherited from

[`GameState`](GameState.md).[`deleteComponent`](GameState.md#deletecomponent)

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

#### Inherited from

[`GameState`](GameState.md).[`getComponent`](GameState.md#getcomponent)

***

### onEnter()

> **onEnter**(): `void`

进入

#### Returns

`void`

#### Overrides

[`GameState`](GameState.md).[`onEnter`](GameState.md#onenter)

***

### onExit()

> `protected` **onExit**(): `void`

#### Returns

`void`

#### Inherited from

[`GameState`](GameState.md).[`onExit`](GameState.md#onexit)

***

### popState()

> `protected` **popState**(): `void`

返回到父状态

#### Returns

`void`

#### Inherited from

[`GameState`](GameState.md).[`popState`](GameState.md#popstate)

***

### pushState()

> `protected` **pushState**\<`S`\>(`stateType`, `config?`): `void`

进入一个新的子状态

#### Type Parameters

##### S

`S` *extends* `gameStateConstructor`\<`T`, `any`, `any`\>

#### Parameters

##### stateType

`S`

##### config?

`ExtractConfig`\<`S`\>

#### Returns

`void`

#### Inherited from

[`GameState`](GameState.md).[`pushState`](GameState.md#pushstate)

***

### stats()

> **stats**(): `string`

返回基本信息

#### Returns

`string`

#### Inherited from

[`GameState`](GameState.md).[`stats`](GameState.md#stats)

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

#### Inherited from

[`GameState`](GameState.md).[`subscribe`](GameState.md#subscribe)

***

### tick()

> **tick**(): `void`

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

`gameStateConstructor`\<`T`, `any`, `T`\>

##### config?

`T`

#### Returns

`void`

#### Inherited from

[`GameState`](GameState.md).[`transitionTo`](GameState.md#transitionto)
