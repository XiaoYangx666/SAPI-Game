[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / InfoScoreboard

# Class: InfoScoreboard

信息侧边栏

## Extends

- [`GameComponent`](GameComponent.md)\<[`GameState`](GameState.md), [`infoScoreboardOptions`](../interfaces/infoScoreboardOptions.md)\>

## Constructors

### Constructor

> **new InfoScoreboard**(`state`, `options?`, `tag?`): `InfoScoreboard`

#### Parameters

##### state

[`GameState`](GameState.md)

##### options?

[`infoScoreboardOptions`](../interfaces/infoScoreboardOptions.md)

##### tag?

`string`

#### Returns

`InfoScoreboard`

#### Inherited from

[`GameComponent`](GameComponent.md).[`constructor`](GameComponent.md#constructor)

## Properties

### options?

> `protected` `optional` **options**: [`infoScoreboardOptions`](../interfaces/infoScoreboardOptions.md)

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

### runner

#### Get Signature

> **get** `protected` **runner**(): [`RunnerManager`](RunnerManager.md)

##### Returns

[`RunnerManager`](RunnerManager.md)

#### Inherited from

[`GameComponent`](GameComponent.md).[`runner`](GameComponent.md#runner)

## Methods

### onAttach()

> **onAttach**(): `void`

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

### show()

> **show**(): `void`

手动显示计分板

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

***

### updateLines()

> **updateLines**(`lines`): `void`

更新计分板内容

#### Parameters

##### lines

`string`[]

#### Returns

`void`
