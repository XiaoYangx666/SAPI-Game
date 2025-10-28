[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / PlayerItemInSlotEventSignal

# Class: PlayerItemInSlotEventSignal

当玩家指定槽位出现指定物品时触发

## Implements

- [`CustomEventSignal`](../interfaces/CustomEventSignal.md)\<[`PlayerItemInSlotEvent`](../interfaces/PlayerItemInSlotEvent.md)\>

## Constructors

### Constructor

> **new PlayerItemInSlotEventSignal**(`intervalEvent`): `PlayerItemInSlotEventSignal`

#### Parameters

##### intervalEvent

[`IntervalEventSignal`](IntervalEventSignal.md)

#### Returns

`PlayerItemInSlotEventSignal`

## Methods

### cleanUp()

> **cleanUp**(): `void`

#### Returns

`void`

***

### subscribe()

> **subscribe**(`callback`, `options`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### callback

(`arg0`) => `void`

##### options

[`PlayerItemInSlotOption`](../interfaces/PlayerItemInSlotOption.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

#### Implementation of

[`CustomEventSignal`](../interfaces/CustomEventSignal.md).[`subscribe`](../interfaces/CustomEventSignal.md#subscribe)

***

### tick()

> **tick**(): `void`

#### Returns

`void`

***

### wrapUnsubscribe()

> **wrapUnsubscribe**(`data`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### data

`PlayerItemInSlotData`

#### Returns

[`Subscription`](../interfaces/Subscription.md)
