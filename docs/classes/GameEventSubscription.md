[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / GameEventSubscription

# Class: GameEventSubscription\<T\>

游戏订阅句柄

## Type Parameters

### T

`T`

## Implements

- [`Subscription`](../interfaces/Subscription.md)

## Constructors

### Constructor

> **new GameEventSubscription**\<`T`\>(`event`, `callback`): `GameEventSubscription`\<`T`\>

#### Parameters

##### event

[`VanillaEventSignal`](../interfaces/VanillaEventSignal.md)\<`T`\>

##### callback

[`EventCallBack`](../type-aliases/EventCallBack.md)\<`T`\>

#### Returns

`GameEventSubscription`\<`T`\>

## Properties

### callback

> **callback**: [`EventCallBack`](../type-aliases/EventCallBack.md)\<`T`\>

***

### event

> **event**: [`VanillaEventSignal`](../interfaces/VanillaEventSignal.md)\<`T`\>

## Methods

### unsubscribe()

> **unsubscribe**(): `void`

取消订阅事件

#### Returns

`void`

#### Implementation of

[`Subscription`](../interfaces/Subscription.md).[`unsubscribe`](../interfaces/Subscription.md#unsubscribe)
