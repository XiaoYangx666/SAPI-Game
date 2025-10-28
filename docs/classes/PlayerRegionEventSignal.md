[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / PlayerRegionEventSignal

# Class: PlayerRegionEventSignal

## Implements

- [`CustomEventSignal`](../interfaces/CustomEventSignal.md)\<[`PlayerRegionEvent`](../interfaces/PlayerRegionEvent.md)\>

## Constructors

### Constructor

> **new PlayerRegionEventSignal**(`tickEvent`): `PlayerRegionEventSignal`

#### Parameters

##### tickEvent

[`IntervalEventSignal`](IntervalEventSignal.md)

#### Returns

`PlayerRegionEventSignal`

## Methods

### dispose()

> **dispose**(): `void`

#### Returns

`void`

***

### subscribe()

> **subscribe**(`callback`, `region`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### callback

(`event`) => `void`

##### region

[`GameRegion`](../SAPI-Game/namespaces/Region/classes/GameRegion.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

#### Implementation of

[`CustomEventSignal`](../interfaces/CustomEventSignal.md).[`subscribe`](../interfaces/CustomEventSignal.md#subscribe)
