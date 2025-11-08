[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GameComponent

# Abstract Class: GameComponent\<S, O\>

## Extended by

- [`InfoScoreboard`](InfoScoreboard.md)
- [`LazyLoader`](LazyLoader.md)
- [`Timer`](Timer.md)
- [`StopWatch`](StopWatch.md)
- [`BlockInteractionBlocker`](BlockInteractionBlocker.md)
- [`EntityInteractionBlocker`](EntityInteractionBlocker.md)
- [`RegionProtector`](RegionProtector.md)
- [`RegionTeamChooser`](RegionTeamChooser.md)
- [`RegionTeamCleaner`](RegionTeamCleaner.md)
- [`TeamScoreBoard`](TeamScoreBoard.md)
- [`PlayerHealthIndicator`](PlayerHealthIndicator.md)
- [`PlayerRegionMonitor`](PlayerRegionMonitor.md)

## Type Parameters

### S

`S` *extends* [`GameState`](GameState.md)\<`any`, `any`\>

### O

`O` = `unknown`

## Constructors

### Constructor

> **new GameComponent**\<`S`, `O`\>(`state`, `options?`, `tag?`): `GameComponent`\<`S`, `O`\>

#### Parameters

##### state

`S`

##### options?

`O`

##### tag?

`string`

#### Returns

`GameComponent`\<`S`, `O`\>

## Properties

### options?

> `protected` `optional` **options**: `O`

***

### state

> `protected` `readonly` **state**: `S`

***

### tag?

> `readonly` `optional` **tag**: `string`

tag

## Accessors

### context

#### Get Signature

> **get** `protected` **context**(): `InferContext`\<`S`\>

##### Returns

`InferContext`\<`S`\>

***

### isAttached

#### Get Signature

> **get** **isAttached**(): `Readonly`\<`boolean`\>

是否已经attach

##### Returns

`Readonly`\<`boolean`\>

***

### runner

#### Get Signature

> **get** `protected` **runner**(): [`RunnerManager`](RunnerManager.md)

##### Returns

[`RunnerManager`](RunnerManager.md)

## Methods

### onAttach()

> `abstract` `protected` **onAttach**(): `void`

#### Returns

`void`

***

### onDetach()

> `protected` **onDetach**(): `void`

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
