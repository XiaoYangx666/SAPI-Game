[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / ItemUseEventSignal

# Class: ItemUseEventSignal

## Extends

- `BaseMapEventSignal`\<`string`, `ItemUseAfterEvent`, `itemData`, [`itemEventOptions`](../interfaces/itemEventOptions.md)\>

## Constructors

### Constructor

> **new ItemUseEventSignal**(): `ItemUseEventSignal`

#### Returns

`ItemUseEventSignal`

#### Inherited from

`BaseMapEventSignal< string, ItemUseAfterEvent, itemData, itemEventOptions >.constructor`

## Properties

### logger

> `protected` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

#### Inherited from

`BaseMapEventSignal.logger`

***

### map

> `protected` **map**: `Map`\<`string`, `Set`\<`itemData`\>\>

#### Inherited from

`BaseMapEventSignal.map`

***

### totalCount

> `protected` **totalCount**: `number` = `0`

#### Inherited from

`BaseMapEventSignal.totalCount`

## Methods

### buildData()

> `protected` **buildData**(`callback`, `options`): `itemData`

子类实现：如何从订阅 options 构造 data

#### Parameters

##### callback

(`e`) => `void`

##### options

`itemData`

#### Returns

`itemData`

#### Overrides

`BaseMapEventSignal.buildData`

***

### buildKey()

> `protected` **buildKey**(`options`): `string`

子类实现：如何从订阅 options 构造 key

#### Parameters

##### options

`itemData`

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

> `protected` **eventWrapper**(`event`): `ItemUseAfterEvent`

自定义事件返回

#### Parameters

##### event

`ItemUseAfterEvent`

#### Returns

`ItemUseAfterEvent`

#### Inherited from

`BaseMapEventSignal.eventWrapper`

***

### extractKey()

> `protected` **extractKey**(`event`): `string` \| `null`

子类实现：如何从原生事件提取 key

#### Parameters

##### event

`ItemUseAfterEvent`

#### Returns

`string` \| `null`

#### Overrides

`BaseMapEventSignal.extractKey`

***

### filter()

> `protected` **filter**(`data`, `event`): `boolean`

子类实现：是否触发回调

#### Parameters

##### data

`itemData`

##### event

`ItemUseAfterEvent`

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

`ItemUseAfterEvent`

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

[`itemEventOptions`](../interfaces/itemEventOptions.md)

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

`ItemUseAfterEvent`

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
