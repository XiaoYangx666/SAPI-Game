[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / BasicCustomEventSignal

# Abstract Class: BasicCustomEventSignal\<T, U\>

自定义事件

## Type Parameters

### T

`T`

### U

`U`

## Constructors

### Constructor

> **new BasicCustomEventSignal**\<`T`, `U`\>(): `BasicCustomEventSignal`\<`T`, `U`\>

#### Returns

`BasicCustomEventSignal`\<`T`, `U`\>

## Properties

### logger

> `protected` **logger**: [`Logger`](../SAPI-Game/namespaces/Utils/classes/Logger.md)

***

### set

> `protected` **set**: `Set`\<`T`\>

## Methods

### publish()

> **publish**(`data`): `void`

#### Parameters

##### data

`U`

#### Returns

`void`

***

### runCallback()

> `abstract` `protected` **runCallback**(`item`, `data`): `void`

#### Parameters

##### item

`T`

##### data

`U`

#### Returns

`void`

***

### unsubscribe()

> `protected` **unsubscribe**(`item`): `void`

#### Parameters

##### item

`T`

#### Returns

`void`
