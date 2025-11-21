[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / LazyLoader

# Class: LazyLoader

用于懒加载区块

## Extends

- [`GameComponent`](GameComponent.md)\<[`GameState`](GameState.md)\<`any`, `any`\>, [`LazyLoadOptions`](../interfaces/LazyLoadOptions.md)\>

## Constructors

### Constructor

> **new LazyLoader**(`state`, `options?`, `tag?`): `LazyLoader`

#### Parameters

##### state

[`GameState`](GameState.md)

##### options?

[`LazyLoadOptions`](../interfaces/LazyLoadOptions.md)

##### tag?

`string`

#### Returns

`LazyLoader`

#### Inherited from

[`GameComponent`](GameComponent.md).[`constructor`](GameComponent.md#constructor)

## Properties

### options?

> `protected` `optional` **options**: [`LazyLoadOptions`](../interfaces/LazyLoadOptions.md)

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

### isActive

#### Get Signature

> **get** **isActive**(): `boolean`

##### Returns

`boolean`

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

### addComponent()

> **addComponent**\<`C`\>(`component`, `options?`): `LazyLoader`

#### Type Parameters

##### C

`C` *extends* `GameComponentType`\<`any`, `any`\>

#### Parameters

##### component

`C`

##### options?

`ConstructorParameters`\<`C`\>\[`1`\]

#### Returns

`LazyLoader`

***

### onAttach()

> **onAttach**(): `void`

#### Returns

`void`

#### Overrides

[`GameComponent`](GameComponent.md).[`onAttach`](GameComponent.md#onattach)

***

### onDetach()

> `protected` **onDetach**(): `void`

随便重写

#### Returns

`void`

#### Inherited from

[`GameComponent`](GameComponent.md).[`onDetach`](GameComponent.md#ondetach)

***

### reload()

> **reload**(): `void`

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
