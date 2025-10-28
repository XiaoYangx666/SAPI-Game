[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GameComponent

# Abstract Class: GameComponent\<S, O\>

## Type Parameters

### S

`S` *extends* [`GameState`](GameState.md)\<`any`, `any`\>

### O

`O` = `unknown`

## Constructors

### Constructor

> **new GameComponent**\<`S`, `O`\>(`state`, `options?`): `GameComponent`\<`S`, `O`\>

#### Parameters

##### state

`S`

##### options?

`O`

#### Returns

`GameComponent`\<`S`, `O`\>

## Properties

### options?

> `protected` `optional` **options**: `O`

***

### state

> `protected` **state**: `S`

## Accessors

### context

#### Get Signature

> **get** `protected` **context**(): `InferContext`\<`S`\>

##### Returns

`InferContext`\<`S`\>

***

### runner

#### Get Signature

> **get** `protected` **runner**(): [`RunnerManager`](RunnerManager.md)

##### Returns

[`RunnerManager`](RunnerManager.md)

## Methods

### onAttach()

> `abstract` **onAttach**(): `void`

#### Returns

`void`

***

### onDetach()

> **onDetach**(): `void`

随便重写

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

***

### unsubscribe()

> `protected` **unsubscribe**(`sub`): `void`

取消订阅

#### Parameters

##### sub

[`EventSubscription`](EventSubscription.md)

#### Returns

`void`
