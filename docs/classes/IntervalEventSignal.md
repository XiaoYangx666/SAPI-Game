[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / IntervalEventSignal

# Class: IntervalEventSignal

间隔时间事件

## Implements

- [`CustomEventSignal`](../interfaces/CustomEventSignal.md)\<`void`\>

## Constructors

### Constructor

> **new IntervalEventSignal**(): `IntervalEventSignal`

#### Returns

`IntervalEventSignal`

## Methods

### dispose()

> **dispose**(): `void`

#### Returns

`void`

***

### subscribe()

> **subscribe**(`callback`, `interval?`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### callback

() => `void`

##### interval?

[`Duration`](../SAPI-Game/namespaces/Utils/classes/Duration.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

#### Implementation of

[`CustomEventSignal`](../interfaces/CustomEventSignal.md).[`subscribe`](../interfaces/CustomEventSignal.md#subscribe)
