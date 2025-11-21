[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / EventManager

# Class: EventManager

## Constructors

### Constructor

> **new EventManager**(): `EventManager`

#### Returns

`EventManager`

## Methods

### debug()

> **debug**(): `void`

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

#### Returns

`void`

***

### subscribe()

> **subscribe**\<`T`\>(`subscriber`, `event`, ...`args`): [`EventSubscription`](EventSubscription.md) \| `undefined`

订阅事件

#### Type Parameters

##### T

`T` *extends* [`EventSignal`](../type-aliases/EventSignal.md)\<`any`\>

#### Parameters

##### subscriber

`object`

##### event

`T`

##### args

...`Parameters`\<`T`\[`"subscribe"`\]\>

#### Returns

[`EventSubscription`](EventSubscription.md) \| `undefined`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

取消订阅

#### Parameters

##### subscription

[`EventSubscription`](EventSubscription.md)

#### Returns

`void`

***

### unsubscribeByEvent()

> **unsubscribeByEvent**(`event`): `void`

#### Parameters

##### event

[`EventSignal`](../type-aliases/EventSignal.md)\<`any`\>

#### Returns

`void`

***

### unsubscribeBySubscriber()

> **unsubscribeBySubscriber**(`subscriber`): `void`

取消订阅指定object的所有事件

#### Parameters

##### subscriber

`object`

#### Returns

`void`
