[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / SignClickEventSignal

# Class: SignClickEventSignal

## Extends

- `BaseMapEventSignal`\<`string`, `PlayerInteractWithBlockBeforeEvent`, `SignClickData`, [`SignClickEventOptions`](../interfaces/SignClickEventOptions.md)\>

## Constructors

### Constructor

> **new SignClickEventSignal**(): `SignClickEventSignal`

#### Returns

`SignClickEventSignal`

#### Inherited from

`BaseMapEventSignal< string, PlayerInteractWithBlockBeforeEvent, SignClickData, SignClickEventOptions >.constructor`

## Properties

### logger

> `protected` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

#### Inherited from

`BaseMapEventSignal.logger`

***

### map

> `protected` **map**: `Map`\<`string`, `Set`\<`SignClickData`\>\>

#### Inherited from

`BaseMapEventSignal.map`

***

### totalCount

> `protected` **totalCount**: `number` = `0`

#### Inherited from

`BaseMapEventSignal.totalCount`

## Methods

### buildData()

> `protected` **buildData**(`callback`, `options`): `SignClickData`

子类实现：如何从订阅 options 构造 data

#### Parameters

##### callback

(`event`) => `void`

##### options

[`SignClickEventOptions`](../interfaces/SignClickEventOptions.md)

#### Returns

`SignClickData`

#### Overrides

`BaseMapEventSignal.buildData`

***

### buildKey()

> `protected` **buildKey**(`options`): `string`

子类实现：如何从订阅 options 构造 key

#### Parameters

##### options

[`SignClickEventOptions`](../interfaces/SignClickEventOptions.md)

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

> `protected` **eventWrapper**(`event`): `PlayerInteractWithBlockBeforeEvent`

自定义事件返回

#### Parameters

##### event

`PlayerInteractWithBlockBeforeEvent`

#### Returns

`PlayerInteractWithBlockBeforeEvent`

#### Inherited from

`BaseMapEventSignal.eventWrapper`

***

### extractKey()

> `protected` **extractKey**(`event`): `string`

子类实现：如何从原生事件提取 key

#### Parameters

##### event

`PlayerInteractWithBlockBeforeEvent`

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

`SignClickData`

##### event

`PlayerInteractWithBlockBeforeEvent`

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

`PlayerInteractWithBlockBeforeEvent`

#### Returns

`boolean`

#### Overrides

`BaseMapEventSignal.isTargetEvent`

***

### subscribe()

> **subscribe**(`callback`, `options`): [`Subscription`](../interfaces/Subscription.md)

#### Parameters

##### callback

(`event`) => `void`

##### options

[`SignClickEventOptions`](../interfaces/SignClickEventOptions.md)

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

`PlayerInteractWithBlockBeforeEvent`

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
