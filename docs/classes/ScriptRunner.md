[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / ScriptRunner

# Class: ScriptRunner

## Constructors

### Constructor

> **new ScriptRunner**(`id`, `onFinish`): `ScriptRunner`

#### Parameters

##### id

`string`

##### onFinish

(`id`) => `void`

#### Returns

`ScriptRunner`

## Properties

### id

> `readonly` **id**: `string`

## Methods

### cancel()

> **cancel**(): `void`

#### Returns

`void`

***

### do()

#### Call Signature

> **do**\<`T`\>(`fn`): `T`

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `T`

##### Returns

`T`

#### Call Signature

> **do**\<`T`\>(`fn`): `Promise`\<`T`\>

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `Promise`\<`T`\>

##### Returns

`Promise`\<`T`\>

***

### doDelay()

> **doDelay**\<`T`\>(`fn`, `ticks`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T` \| `Promise`\<`T`\>

##### ticks

`number`

#### Returns

`Promise`\<`T`\>

***

### isCancelled()

> **isCancelled**(): `boolean`

#### Returns

`boolean`

***

### run()

> **run**(`script`): `Promise`\<`void`\>

#### Parameters

##### script

(`r`) => `void` \| `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### runSteps()

> **runSteps**(`steps`): `Promise`\<`void`\>

#### Parameters

##### steps

() => `void` \| `Promise`\<`void`\>[]

#### Returns

`Promise`\<`void`\>

***

### wait()

> **wait**(`ticks`): `Promise`\<`void`\>

#### Parameters

##### ticks

`number`

#### Returns

`Promise`\<`void`\>
