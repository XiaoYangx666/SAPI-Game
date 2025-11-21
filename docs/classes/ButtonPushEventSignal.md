[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / ButtonPushEventSignal

# Class: ButtonPushEventSignal

## Extends

- `BaseMapEventSignal`\<`string`, `ButtonPushAfterEvent`, `ButtonData`, [`ButtonPushEventOptions`](../interfaces/ButtonPushEventOptions.md)\>

## Constructors

### Constructor

> **new ButtonPushEventSignal**(): `ButtonPushEventSignal`

#### Returns

`ButtonPushEventSignal`

#### Inherited from

`BaseMapEventSignal< string, ButtonPushAfterEvent, ButtonData, ButtonPushEventOptions >.constructor`

## Properties

### logger

> `protected` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

#### Inherited from

`BaseMapEventSignal.logger`

***

### map

> `protected` **map**: `Map`\<`string`, `Set`\<`ButtonData`\>\>

#### Inherited from

`BaseMapEventSignal.map`

***

### totalCount

> `protected` **totalCount**: `number` = `0`

#### Inherited from

`BaseMapEventSignal.totalCount`

## Methods

### buildData()

> `protected` **buildData**(`callback`, `options`): `ButtonData`

子类实现：如何从订阅 options 构造 data

#### Parameters

##### callback

(`event`) => `void`

##### options

[`ButtonPushEventOptions`](../interfaces/ButtonPushEventOptions.md)

#### Returns

`ButtonData`

#### Overrides

`BaseMapEventSignal.buildData`

***

### buildKey()

> `protected` **buildKey**(`options`): `string`

子类实现：如何从订阅 options 构造 key

#### Parameters

##### options

[`ButtonPushEventOptions`](../interfaces/ButtonPushEventOptions.md)

#### Returns

`string`

#### Overrides

`BaseMapEventSignal.buildKey`

***

### cleanup()

> **cleanup**(): `void`

#### Returns

`void`

#### Inherited from

`BaseMapEventSignal.cleanup`

***

### eventWrapper()

> `protected` **eventWrapper**(`event`): `ButtonPushAfterEvent`

自定义事件返回

#### Parameters

##### event

`ButtonPushAfterEvent`

#### Returns

`ButtonPushAfterEvent`

#### Inherited from

`BaseMapEventSignal.eventWrapper`

***

### extractKey()

> `protected` **extractKey**(`event`): `string`

子类实现：如何从原生事件提取 key

#### Parameters

##### event

`ButtonPushAfterEvent`

#### Returns

`string`

#### Overrides

`BaseMapEventSignal.extractKey`

***

### filter()

> `protected` **filter**(`data`, `event`): `boolean`

子类实现：是否触发回调

#### Parameters

##### data

`ButtonData`

##### event

`ButtonPushAfterEvent`

#### Returns

`boolean`

#### Overrides

`BaseMapEventSignal.filter`

***

### init()

> `protected` **init**(): `void`

#### Returns

`void`

#### Inherited from

`BaseMapEventSignal.init`

***

### isTargetEvent()

> `protected` **isTargetEvent**(`event`): `boolean`

子类可重写：是否为需要的事件

#### Parameters

##### event

`ButtonPushAfterEvent`

#### Returns

`boolean`

#### Inherited from

`BaseMapEventSignal.isTargetEvent`

***

### subscribe()

> **subscribe**(`callback`, `options`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### callback

(`event`) => `void`

##### options

[`ButtonPushEventOptions`](../interfaces/ButtonPushEventOptions.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

#### Inherited from

`BaseMapEventSignal.subscribe`

***

### subscribeNative()

> `protected` **subscribeNative**(`cb`): (`e`) => `void`

子类实现：订阅原生事件

#### Parameters

##### cb

(`e`) => `void`

#### Returns

> (`e`): `void`

##### Parameters

###### e

`ButtonPushAfterEvent`

##### Returns

`void`

#### Overrides

`BaseMapEventSignal.subscribeNative`

***

### unsubscribeNative()

> `protected` **unsubscribeNative**(`cb`): `void`

子类实现：取消原生事件

#### Parameters

##### cb

(`e`) => `void`

#### Returns

`void`

#### Overrides

`BaseMapEventSignal.unsubscribeNative`
