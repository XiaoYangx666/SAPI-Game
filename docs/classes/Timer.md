[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / Timer

# Class: Timer

## Extends

- [`GameComponent`](GameComponent.md)\<[`GameState`](GameState.md)\<`any`\>, [`TimerOptions`](../interfaces/TimerOptions.md)\>

## Constructors

### Constructor

> **new Timer**(`state`, `options?`, `tag?`): `Timer`

#### Parameters

##### state

[`GameState`](GameState.md)

##### options?

[`TimerOptions`](../interfaces/TimerOptions.md)

##### tag?

`string`

#### Returns

`Timer`

#### Inherited from

[`GameComponent`](GameComponent.md).[`constructor`](GameComponent.md#constructor)

## Properties

### events

> `readonly` **events**: `object`

#### onTime

> `readonly` **onTime**: `TimerOnTimeEventSignal`

#### tick

> `readonly` **tick**: `TimerTickEventSignal`

***

### options?

> `protected` `optional` **options**: [`TimerOptions`](../interfaces/TimerOptions.md)

#### Inherited from

[`GameComponent`](GameComponent.md).[`options`](GameComponent.md#options)

***

### state

> `protected` `readonly` **state**: [`GameState`](GameState.md)

#### Inherited from

[`GameComponent`](GameComponent.md).[`state`](GameComponent.md#state)

***

### tag?

> `readonly` `optional` **tag**: `string`

tag

#### Inherited from

[`GameComponent`](GameComponent.md).[`tag`](GameComponent.md#tag)

## Accessors

### context

#### Get Signature

> **get** `protected` **context**(): `InferContext`\<`S`\>

##### Returns

`InferContext`\<`S`\>

#### Inherited from

[`GameComponent`](GameComponent.md).[`context`](GameComponent.md#context)

***

### isAttached

#### Get Signature

> **get** **isAttached**(): `Readonly`\<`boolean`\>

是否已经attach

##### Returns

`Readonly`\<`boolean`\>

#### Inherited from

[`GameComponent`](GameComponent.md).[`isAttached`](GameComponent.md#isattached)

***

### isRunning

#### Get Signature

> **get** **isRunning**(): `Readonly`\<`boolean`\>

获取计时器是否正在运行

##### Returns

`Readonly`\<`boolean`\>

***

### runner

#### Get Signature

> **get** `protected` **runner**(): [`RunnerManager`](RunnerManager.md)

##### Returns

[`RunnerManager`](RunnerManager.md)

#### Inherited from

[`GameComponent`](GameComponent.md).[`runner`](GameComponent.md#runner)

***

### time

#### Get Signature

> **get** **time**(): `number`

获取当前剩余时间

##### Returns

`number`

## Methods

### onAttach()

> **onAttach**(): `void`

组件被附加到游戏对象时调用

#### Returns

`void`

#### Overrides

[`GameComponent`](GameComponent.md).[`onAttach`](GameComponent.md#onattach)

***

### onDetach()

> **onDetach**(): `void`

随便重写

#### Returns

`void`

#### Overrides

[`GameComponent`](GameComponent.md).[`onDetach`](GameComponent.md#ondetach)

***

### set()

> **set**(`time`): `void`

设置计时器的当前时间

#### Parameters

##### time

`number`

#### Returns

`void`

***

### start()

> **start**(): `void`

启动计时器

#### Returns

`void`

***

### stop()

> **stop**(): `void`

停止计时器

#### Returns

`void`

***

### subscribe()

> `protected` **subscribe**\<`T`\>(`event`, ...`args`): [`EventSubscription`](EventSubscription.md) \| `undefined`

订阅事件

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

[`GameComponent`](GameComponent.md).[`subscribe`](GameComponent.md#subscribe)

***

### unsubscribe()

> `protected` **unsubscribe**(`sub`): `void`

取消订阅

#### Parameters

##### sub

[`EventSubscription`](EventSubscription.md)

#### Returns

`void`

#### Inherited from

[`GameComponent`](GameComponent.md).[`unsubscribe`](GameComponent.md#unsubscribe)
