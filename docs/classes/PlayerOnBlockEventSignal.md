[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / PlayerOnBlockEventSignal

# Class: PlayerOnBlockEventSignal

## Implements

- [`CustomEventSignal`](../interfaces/CustomEventSignal.md)\<[`PlayerOnBlockEvent`](../interfaces/PlayerOnBlockEvent.md)\>

## Constructors

### Constructor

> **new PlayerOnBlockEventSignal**(`tickEvent`): `PlayerOnBlockEventSignal`

#### Parameters

##### tickEvent

[`IntervalEventSignal`](IntervalEventSignal.md)

#### Returns

`PlayerOnBlockEventSignal`

## Methods

### subscribe()

> **subscribe**(`callback`, `options?`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### callback

(`arg0`) => `void`

##### options?

[`PlayerOnBlockEventOption`](../interfaces/PlayerOnBlockEventOption.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

#### Implementation of

[`CustomEventSignal`](../interfaces/CustomEventSignal.md).[`subscribe`](../interfaces/CustomEventSignal.md#subscribe)
